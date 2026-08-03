import type { GremlinMatch, GremlinSeverity } from './types.ts';

const SEVERITY_RANK: Record<GremlinSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

export function formatCodePoint(codePoint: number) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

export function formatGremlinTooltip(match: GremlinMatch) {
  const severity = capitalize(match.severity);

  if (match.kind === 'mixed-indentation') {
    return `Mixed indentation · Leading indentation contains both tabs and spaces · ${severity}`;
  }

  if (match.kind === 'list-indentation') {
    return match.reason === 'orphaned'
      ? `List indentation · Indented list marker has no parent list item · ${severity}`
      : `List indentation · ${match.count} leading ${pluralizeSpaces(match.count)} do not match the configured indent width · ${severity}`;
  }

  if (match.kind === 'missing-list-marker') {
    return `Missing list marker · Line appears to be a sibling of the following list item · ${severity}`;
  }

  if (match.kind === 'ambiguous-empty-list-marker') {
    return `Ambiguous empty list marker · Missing space may cause Obsidian to parse the preceding line as a heading · ${severity}`;
  }

  if (match.kind === 'duplicate-list-marker') {
    return `Duplicate list marker · Consecutive unordered markers may create an unintended nested list · ${severity}`;
  }

  if (match.kind === 'list-marker-spacing') {
    return `List marker spacing · Marker is not followed by exactly one ordinary space · ${severity}`;
  }

  if (match.kind === 'list-item-punctuation') {
    return `List item punctuation · Expected ${punctuationName(match.expected)} at the end of this item · ${severity}`;
  }

  if (match.kind === 'list-item-line-ending') {
    const expectation =
      match.expected === 'blank-line'
        ? 'a blank line before the next sibling item'
        : match.expected === 'two-spaces'
          ? 'exactly two trailing spaces (Markdown hard break)'
          : 'no trailing whitespace';
    return `List item line ending · Expected ${expectation} · ${severity}`;
  }

  const count = match.count > 1 ? `${match.count} ` : '';
  const name = `${match.name}${match.count > 1 ? 's' : ''}`;
  return `${count}${name} · Unicode ${formatCodePoint(match.codePoint)} · ${severity}`;
}

export function highestSeverity(
  severities: readonly GremlinSeverity[],
): GremlinSeverity {
  return severities.reduce<GremlinSeverity>(
    (highest, severity) =>
      SEVERITY_RANK[severity] > SEVERITY_RANK[highest] ? severity : highest,
    'info',
  );
}

function pluralizeSpaces(count: number) {
  return count === 1 ? 'space' : 'spaces';
}

function punctuationName(punctuation: string) {
  const names: Record<string, string> = {
    '': 'no terminal punctuation',
    '!': 'an exclamation mark (!)',
    ',': 'a comma (,)',
    '.': 'a period (.)',
    ':': 'a colon (:)',
    ';': 'a semicolon (;)',
    '?': 'a question mark (?)',
  };
  return names[punctuation] ?? `“${punctuation}”`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
