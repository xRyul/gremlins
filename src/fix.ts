import { GREMLIN_DEFINITIONS_BY_CODE_POINT } from './characters.ts';
import type { GremlinMatch } from './types.ts';

const DEFAULT_INDENT_SIZE = 4;

export interface GremlinFixChange {
  from: number;
  insert: string;
  to: number;
}

export function isGremlinFixable(match: GremlinMatch) {
  return (
    match.kind !== 'character' ||
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

  for (const match of matches) {
    if (match.kind === 'character') {
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

  return changes;
}

function normalizeMixedIndentation(
  indentation: string,
  indentSize: number,
) {
  if (/^\t+ +$/.test(indentation)) {
    return indentation.replace(/ +$/, '');
  }

  return ' '.repeat(indentationWidth(indentation, indentSize));
}

function normalizeListIndentation(
  indentation: string,
  indentSize: number,
) {
  const width = indentationWidth(indentation, indentSize);
  const normalizedWidth = Math.round(width / indentSize) * indentSize;
  return ' '.repeat(normalizedWidth);
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
