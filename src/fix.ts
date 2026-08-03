import { GREMLIN_DEFINITIONS_BY_CODE_POINT } from './characters.ts';
import type { GremlinMatch } from './types.ts';

const DEFAULT_INDENT_SIZE = 4;
const MARKDOWN_LIST_MARKER = /^(?:[-+*]|\d+[.)])(?:[\t ]|$)/;

interface DocumentLine {
  from: number;
  indentation: string | null;
  text: string;
}

export interface GremlinFixChange {
  from: number;
  insert: string;
  to: number;
}

export function isGremlinFixable(match: GremlinMatch) {
  if (
    match.kind === 'ambiguous-empty-list-marker' ||
    match.kind === 'duplicate-list-marker' ||
    match.kind === 'list-indentation' ||
    match.kind === 'list-item-line-ending' ||
    match.kind === 'list-item-punctuation' ||
    match.kind === 'list-marker-spacing' ||
    match.kind === 'missing-list-marker'
  ) {
    return true;
  }

  return (
    match.kind === 'mixed-indentation' ||
    GREMLIN_DEFINITIONS_BY_CODE_POINT.has(match.codePoint)
  );
}

export function buildGremlinFixChanges(
  matches: readonly GremlinMatch[],
  lineText: string,
  lineFrom: number,
  indentSize = DEFAULT_INDENT_SIZE,
): GremlinFixChange[] {
  const changes: GremlinFixChange[] = [];
  const effectiveIndentSize = normalizeIndentSize(indentSize);
  const lineEndingMatches = matches.filter(
    (match) => match.kind === 'list-item-line-ending',
  );

  for (const match of matches) {
    if (match.kind === 'character') {
      if (
        lineEndingMatches.some(
          (ending) =>
            ending.replacementFrom < ending.replacementTo &&
            ending.replacementFrom <= match.from &&
            ending.replacementTo >= match.to,
        )
      ) {
        continue;
      }

      const definition = GREMLIN_DEFINITIONS_BY_CODE_POINT.get(match.codePoint);
      if (!definition) {
        continue;
      }

      changes.push({
        from: match.from,
        insert: definition.replacement.repeat(match.count),
        to: match.to,
      });
      continue;
    }

    if (match.kind === 'missing-list-marker') {
      changes.push({
        from: match.from,
        insert: `${match.targetIndentation}${match.marker} `,
        to: match.to,
      });
      continue;
    }

    if (match.kind === 'ambiguous-empty-list-marker') {
      changes.push({
        from: match.to,
        insert: ' ',
        to: match.to,
      });
      continue;
    }

    if (match.kind === 'duplicate-list-marker') {
      changes.push({
        from: match.from,
        insert: '',
        to: match.to,
      });
      continue;
    }

    if (match.kind === 'list-marker-spacing') {
      changes.push({
        from: match.from,
        insert: ' ',
        to: match.to,
      });
      continue;
    }

    if (
      match.kind === 'list-item-line-ending' ||
      match.kind === 'list-item-punctuation'
    ) {
      changes.push({
        from: match.replacementFrom,
        insert: match.replacement,
        to: match.replacementTo,
      });
      continue;
    }

    if (
      match.kind === 'list-indentation' &&
      match.reason === 'orphaned'
    ) {
      continue;
    }

    const indentation = lineText.slice(
      match.from - lineFrom,
      match.to - lineFrom,
    );
    changes.push({
      from: match.from,
      insert:
        match.kind === 'mixed-indentation'
          ? normalizeMixedIndentation(indentation, effectiveIndentSize)
          : normalizeListIndentation(indentation, effectiveIndentSize),
      to: match.to,
    });
  }

  return mergeConcurrentInsertions(changes);
}

export function buildGremlinFixChangesForDocument(
  matches: readonly GremlinMatch[],
  documentText: string,
  lineText: string,
  lineFrom: number,
  line: number,
  indentSize = DEFAULT_INDENT_SIZE,
): GremlinFixChange[] {
  const orphanedListMatch = matches.find(
    (match) =>
      match.kind === 'list-indentation' &&
      match.reason === 'orphaned',
  );
  const missingListMarkerMatch = matches.find(
    (match) => match.kind === 'missing-list-marker',
  );
  const directMatches = orphanedListMatch
    ? matches.filter(
        (match) =>
          match.kind === 'ambiguous-empty-list-marker' ||
          match.kind === 'character' ||
          match.kind === 'duplicate-list-marker' ||
          match.kind === 'list-item-line-ending' ||
          match.kind === 'list-item-punctuation' ||
          match.kind === 'list-marker-spacing',
      )
    : missingListMarkerMatch
      ? matches.filter(
          (match) =>
            match.kind === 'character' ||
            match.kind === 'missing-list-marker',
        )
      : matches;
  const changes = buildGremlinFixChanges(
    directMatches,
    lineText,
    lineFrom,
    indentSize,
  );

  if (orphanedListMatch) {
    changes.push(
      ...buildOrphanedListBlockFixChanges(
        documentText,
        line,
        indentSize,
      ),
    );
  }

  return changes.sort((left, right) => left.from - right.from);
}

export function buildOrphanedListBlockFixChanges(
  documentText: string,
  targetLine: number,
  indentSize = DEFAULT_INDENT_SIZE,
): GremlinFixChange[] {
  const effectiveIndentSize = normalizeIndentSize(indentSize);
  const lines = documentLines(documentText);
  const target = lines[targetLine];

  if (
    !target?.indentation ||
    !MARKDOWN_LIST_MARKER.test(
      target.text.slice(target.indentation.length),
    )
  ) {
    return [];
  }

  let blockStart = targetLine;
  while (blockStart > 0 && lines[blockStart - 1]?.indentation) {
    blockStart -= 1;
  }

  let blockEnd = targetLine;
  while (
    blockEnd + 1 < lines.length &&
    lines[blockEnd + 1]?.indentation
  ) {
    blockEnd += 1;
  }

  const blockLines = lines.slice(blockStart, blockEnd + 1);
  const sharedIndentationWidth = Math.min(
    ...blockLines.map((line) =>
      indentationWidth(line.indentation ?? '', effectiveIndentSize),
    ),
  );

  if (sharedIndentationWidth <= 0) {
    return [];
  }

  return blockLines.map((line) => {
    const indentation = line.indentation ?? '';
    const remainingWidth =
      indentationWidth(indentation, effectiveIndentSize) -
      sharedIndentationWidth;

    return {
      from: line.from,
      insert: indentationForWidth(
        remainingWidth,
        indentation.startsWith('\t'),
        effectiveIndentSize,
      ),
      to: line.from + indentation.length,
    };
  });
}

function normalizeMixedIndentation(
  indentation: string,
  indentSize: number,
) {
  const normalizedWidth = normalizeIndentationWidth(
    indentationWidth(indentation, indentSize),
    indentSize,
  );

  return indentation.startsWith('\t')
    ? '\t'.repeat(normalizedWidth / indentSize)
    : ' '.repeat(normalizedWidth);
}

function normalizeListIndentation(
  indentation: string,
  indentSize: number,
) {
  const normalizedWidth = normalizeIndentationWidth(
    indentationWidth(indentation, indentSize),
    indentSize,
  );
  return ' '.repeat(normalizedWidth);
}

function normalizeIndentationWidth(width: number, indentSize: number) {
  return Math.round(width / indentSize) * indentSize;
}

function indentationWidth(indentation: string, indentSize: number) {
  let width = 0;

  for (const character of indentation) {
    width =
      character === '\t'
        ? width + indentSize - (width % indentSize)
        : width + 1;
  }

  return width;
}

function documentLines(documentText: string): DocumentLine[] {
  let from = 0;

  return documentText.split('\n').map((text) => {
    const indentation = leadingIndentation(text);
    const line = { from, indentation, text };
    from += text.length + 1;
    return line;
  });
}

function leadingIndentation(text: string) {
  const indentation = /^[\t ]+/.exec(text)?.[0];
  return indentation && text.slice(indentation.length).trim().length > 0
    ? indentation
    : null;
}

function indentationForWidth(
  width: number,
  preferTabs: boolean,
  indentSize: number,
) {
  if (!preferTabs) {
    return ' '.repeat(width);
  }

  return (
    '\t'.repeat(Math.floor(width / indentSize)) +
    ' '.repeat(width % indentSize)
  );
}

function mergeConcurrentInsertions(
  changes: readonly GremlinFixChange[],
) {
  const merged: GremlinFixChange[] = [];

  for (const change of changes) {
    const existing =
      change.from === change.to
        ? merged.find(
            (candidate) =>
              candidate.from === change.from &&
              candidate.to === change.to,
          )
        : undefined;

    if (existing) {
      existing.insert += change.insert;
    } else {
      merged.push({ ...change });
    }
  }

  return merged;
}

function normalizeIndentSize(indentSize: number) {
  return Number.isInteger(indentSize) && indentSize > 0
    ? indentSize
    : DEFAULT_INDENT_SIZE;
}
