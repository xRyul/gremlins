import { GREMLIN_DEFINITIONS_BY_CODE_POINT } from './characters.ts';
import type { GremlinMatch } from './types.ts';

const MARKDOWN_TAB_SIZE = 4;

export interface GremlinFixChange {
  from: number;
  insert: string;
  to: number;
}

export function isGremlinFixable(match: GremlinMatch) {
  return (
    match.kind === 'mixed-indentation' ||
    GREMLIN_DEFINITIONS_BY_CODE_POINT.has(match.codePoint)
  );
}

export function buildGremlinFixChanges(
  matches: readonly GremlinMatch[],
  lineText: string,
  lineFrom: number,
): GremlinFixChange[] {
  const changes: GremlinFixChange[] = [];

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
      insert: ' '.repeat(indentationWidth(indentation)),
      to: match.to,
    });
  }

  return changes;
}

function indentationWidth(indentation: string) {
  let width = 0;

  for (const character of indentation) {
    width =
      character === '\t'
        ? width + MARKDOWN_TAB_SIZE - (width % MARKDOWN_TAB_SIZE)
        : width + 1;
  }

  return width;
}
