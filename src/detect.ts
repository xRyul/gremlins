import { GREMLIN_DEFINITIONS_BY_CODE_POINT } from './characters.ts';
import type { GremlinsSettings } from './settings-model.ts';
import type {
  GremlinDefinition,
  GremlinMatch,
  MarkdownListContext,
} from './types.ts';

const DEFAULT_INDENT_SIZE = 4;
const MARKDOWN_LIST_ITEM = /^([\t ]+)(?=(?:[-+*]|\d+[.)])(?:[\t ]|$))/;
const MARKDOWN_LIST_LINE =
  /^([\t ]*)(?:[-+*]|\d+[.)])(?:[\t ]|$)/;
const MARKDOWN_UNORDERED_LIST_LINE = /^([\t ]*)([-+*])(?:[\t ]|$)/;
const PARSERLESS_LIST_CONTEXT: MarkdownListContext = 'nested-list-item';

export function detectGremlins(
  text: string,
  settings: GremlinsSettings,
  indentSize = DEFAULT_INDENT_SIZE,
): GremlinMatch[] {
  const matches: GremlinMatch[] = [];
  const lines = text.split('\n');
  let lineFrom = 0;

  for (let line = 0; line < lines.length; line += 1) {
    const lineText = lines[line] ?? '';
    matches.push(
      ...detectLineGremlins(
        lineText,
        lineFrom,
        line,
        settings,
        indentSize,
        PARSERLESS_LIST_CONTEXT,
        lines[line - 1],
        lines[line + 1],
      ),
    );
    lineFrom += lineText.length + 1;
  }

  return matches;
}

export function detectLineGremlins(
  text: string,
  lineFrom: number,
  line: number,
  settings: GremlinsSettings,
  indentSize: number,
  listContext: MarkdownListContext,
  previousLine?: string,
  nextLine?: string,
): GremlinMatch[] {
  const matches: GremlinMatch[] = [];
  const effectiveIndentSize = normalizeIndentSize(indentSize);

  if (settings.showMixedIndentation) {
    const indentation = /^[\t ]+/.exec(text)?.[0];
    if (indentation?.includes('\t') && indentation.includes(' ')) {
      matches.push({
        codePoint: null,
        count: indentation.length,
        from: lineFrom,
        kind: 'mixed-indentation',
        line,
        name: 'mixed indentation',
        severity: 'warning',
        to: lineFrom + indentation.length,
        zeroWidth: false,
      });
    }
  }

  if (settings.showListIndentation) {
    const indentation = MARKDOWN_LIST_ITEM.exec(text)?.[1];
    const reason = listIndentationReason(
      indentation,
      listContext,
      effectiveIndentSize,
    );

    if (indentation && reason) {
      matches.push({
        codePoint: null,
        count: indentation.length,
        from: lineFrom,
        kind: 'list-indentation',
        line,
        name: 'list indentation',
        reason,
        severity: 'warning',
        to: lineFrom + indentation.length,
        zeroWidth: false,
      });
    }
  }

  if (settings.showMissingListMarkers) {
    const missingListMarker = detectMissingListMarker(
      previousLine,
      text,
      nextLine,
      lineFrom,
      line,
      effectiveIndentSize,
    );
    if (missingListMarker) {
      matches.push(missingListMarker);
    }
  }

  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) {
      break;
    }

    const character = String.fromCodePoint(codePoint);
    const definition = GREMLIN_DEFINITIONS_BY_CODE_POINT.get(codePoint);
    if (!definition || !isDefinitionEnabled(definition, settings)) {
      index += character.length;
      continue;
    }

    let count = 1;
    let groupEnd = index + character.length;
    while (text.codePointAt(groupEnd) === codePoint) {
      count += 1;
      groupEnd += character.length;
    }

    matches.push({
      codePoint,
      count,
      from: lineFrom + index,
      kind: 'character',
      line,
      name: definition.name,
      severity: definition.severity,
      to: lineFrom + groupEnd,
      zeroWidth: definition.zeroWidth,
    });
    index = groupEnd;
  }

  return matches.sort((left, right) => left.from - right.from);
}

function listIndentationReason(
  indentation: string | undefined,
  context: MarkdownListContext,
  indentSize: number,
) {
  if (!indentation) {
    return null;
  }

  if (
    context === 'indented-code' ||
    context === 'plain-text' ||
    context === 'root-list-item'
  ) {
    return 'orphaned' as const;
  }

  return context === 'nested-list-item' &&
    !indentation.includes('\t') &&
    indentation.length % indentSize !== 0
    ? ('misaligned' as const)
    : null;
}

function detectMissingListMarker(
  previousLine: string | undefined,
  text: string,
  nextLine: string | undefined,
  lineFrom: number,
  line: number,
  indentSize: number,
): GremlinMatch | null {
  const indentation = /^([\t ]+)(?=\S)/.exec(text)?.[1];
  const previousIndentation = MARKDOWN_LIST_LINE.exec(previousLine ?? '')?.[1];
  const nextListItem = MARKDOWN_UNORDERED_LIST_LINE.exec(nextLine ?? '');

  if (!indentation || previousIndentation === undefined || !nextListItem) {
    return null;
  }

  const content = text.slice(indentation.length);
  if (MARKDOWN_LIST_LINE.test(content)) {
    return null;
  }

  const nextIndentation = nextListItem[1];
  const marker = nextListItem[2];
  if (
    nextIndentation === undefined ||
    (marker !== '-' && marker !== '+' && marker !== '*')
  ) {
    return null;
  }
  const currentWidth = indentationWidth(indentation, indentSize);
  const previousWidth = indentationWidth(previousIndentation, indentSize);
  const nextWidth = indentationWidth(nextIndentation, indentSize);

  if (
    currentWidth !== previousWidth - indentSize ||
    nextWidth !== previousWidth + indentSize
  ) {
    return null;
  }

  return {
    codePoint: null,
    count: indentation.length,
    from: lineFrom,
    kind: 'missing-list-marker',
    line,
    marker,
    name: 'missing list marker',
    severity: 'warning',
    targetIndentation: nextIndentation,
    to: lineFrom + indentation.length,
    zeroWidth: false,
  };
}

function isDefinitionEnabled(
  definition: GremlinDefinition,
  settings: GremlinsSettings,
) {
  return definition.category === 'typographic'
    ? settings.showTypographicCharacters
    : settings.showDangerousCharacters;
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

function normalizeIndentSize(indentSize: number) {
  return Number.isInteger(indentSize) && indentSize > 0
    ? indentSize
    : DEFAULT_INDENT_SIZE;
}
