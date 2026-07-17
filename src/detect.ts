import { GREMLIN_DEFINITIONS_BY_CODE_POINT } from './characters.ts';
import type { GremlinsSettings } from './settings-model.ts';
import type { GremlinDefinition, GremlinMatch } from './types.ts';

export function detectGremlins(
  text: string,
  settings: GremlinsSettings,
): GremlinMatch[] {
  const matches: GremlinMatch[] = [];
  const lines = text.split('\n');
  let lineFrom = 0;

  for (let line = 0; line < lines.length; line += 1) {
    const lineText = lines[line] ?? '';
    matches.push(...detectLineGremlins(lineText, lineFrom, line, settings));
    lineFrom += lineText.length + 1;
  }

  return matches;
}

export function detectLineGremlins(
  text: string,
  lineFrom: number,
  line: number,
  settings: GremlinsSettings,
): GremlinMatch[] {
  const matches: GremlinMatch[] = [];

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

function isDefinitionEnabled(
  definition: GremlinDefinition,
  settings: GremlinsSettings,
) {
  return definition.category === 'typographic'
    ? settings.showTypographicCharacters
    : settings.showDangerousCharacters;
}
