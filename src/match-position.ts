import type { GremlinMatch } from './types.ts';

export function findGremlinAtPosition(
  matches: readonly GremlinMatch[],
  position: number,
  side: -1 | 1,
) {
  return matches.find((match) => {
    if (match.zeroWidth && position === match.from) {
      return true;
    }
    if (position > match.from && position < match.to) {
      return true;
    }
    if (position === match.from) {
      return side > 0;
    }
    return position === match.to && side < 0;
  });
}
