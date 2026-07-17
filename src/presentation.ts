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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
