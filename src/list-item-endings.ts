import {
  parseListItemStructure,
  type ItemEndpoint,
  type ListGroup,
  type ListItem,
  type ListItemEndingDetectionOptions,
  type SourceLine,
} from './list-item-structure.ts';
import type {
  GremlinsSettings,
  ListItemPunctuationPolicy,
} from './settings-model.ts';
import type {
  GremlinMatch,
  ListItemLineEndingGremlinMatch,
  ListItemPunctuationGremlinMatch,
} from './types.ts';

export type {
  ListItemEndingDetectionOptions,
  ListItemEndingLineContext,
} from './list-item-structure.ts';

const TERMINAL_PUNCTUATION_RUN = /[.!?;,:]+$/;
const TRAILING_FORMATTING_MARKERS = /[*_~]+$/;

interface TerminalPunctuation {
  from: number | null;
  to: number | null;
  value: string;
}

export function detectListItemEndingGremlins(
  text: string,
  settings: GremlinsSettings,
  options: ListItemEndingDetectionOptions = {},
): GremlinMatch[] {
  if (
    settings.listItemPunctuationPolicy === 'disabled' &&
    settings.listItemLineEndingPolicy === 'disabled'
  ) {
    return [];
  }

  const { groups, lines } = parseListItemStructure(text, options);
  const matches: GremlinMatch[] = [];

  if (settings.listItemPunctuationPolicy !== 'disabled') {
    matches.push(
      ...detectPunctuationGremlins(
        groups,
        settings.listItemPunctuationPolicy,
      ),
    );
  }

  if (settings.listItemLineEndingPolicy !== 'disabled') {
    matches.push(
      ...detectLineEndingGremlins(
        groups,
        lines,
        settings.listItemLineEndingPolicy,
      ),
    );
  }

  return matches.sort(compareMatches);
}

function detectPunctuationGremlins(
  groups: readonly ListGroup[],
  policy: Exclude<ListItemPunctuationPolicy, 'disabled'>,
) {
  const matches: ListItemPunctuationGremlinMatch[] = [];

  for (const group of groups) {
    const items = group.items.filter(
      (item): item is ListItem & { endpoint: ItemEndpoint } =>
        item.endpoint !== null,
    );
    if (items.length === 0 || (policy === 'consistent' && items.length < 2)) {
      continue;
    }

    const expected = expectedPunctuation(items, policy);
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const expectedPunctuation = expected[index];
      if (!item || expectedPunctuation === undefined) {
        continue;
      }

      const match = punctuationMatch(item.endpoint, expectedPunctuation);
      if (match) {
        matches.push(match);
      }
    }
  }

  return matches;
}

function expectedPunctuation(
  items: readonly (ListItem & { endpoint: ItemEndpoint })[],
  policy: Exclude<ListItemPunctuationPolicy, 'disabled'>,
) {
  if (policy === 'period') {
    return items.map(() => '.');
  }
  if (policy === 'semicolon') {
    return items.map(() => ';');
  }
  if (policy === 'none') {
    return items.map(() => '');
  }
  if (policy === 'semicolon-final-period') {
    return items.map((_, index) =>
      index === items.length - 1 ? '.' : ';',
    );
  }

  const actual = items.map((item) => terminalPunctuation(item.endpoint).value);
  const dominant = dominantPunctuation(actual);
  const dominantScore = actual.filter((value) => value === dominant).length;
  const finalIsPeriod = actual[actual.length - 1] === '.';
  const hasNonFinalSemicolon = actual
    .slice(0, -1)
    .some((value) => value === ';');
  const formal = actual.map((_, index) =>
    index === actual.length - 1 ? '.' : ';',
  );
  const formalScore = actual.filter(
    (value, index) => value === formal[index],
  ).length;

  return finalIsPeriod && hasNonFinalSemicolon && formalScore > dominantScore
    ? formal
    : actual.map(() => dominant);
}

function dominantPunctuation(actual: readonly string[]) {
  const counts = new Map<string, number>();
  let dominant = actual[0] ?? '';
  let highestCount = 0;

  for (const value of actual) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > highestCount) {
      dominant = value;
      highestCount = count;
    }
  }

  return dominant;
}

function punctuationMatch(
  endpoint: ItemEndpoint,
  expected: string,
): ListItemPunctuationGremlinMatch | null {
  const actual = terminalPunctuation(endpoint);
  if (actual.value === expected) {
    return null;
  }

  const replacementFrom =
    actual.from ?? endpoint.line.from + endpoint.effectiveEnd;
  const replacementTo =
    actual.to ?? endpoint.line.from + endpoint.effectiveEnd;
  const highlight = actual.from === null
    ? fallbackHighlight(endpoint.line, endpoint.effectiveEnd, endpoint.contentStart)
    : { from: actual.from, to: actual.to ?? actual.from + 1 };

  return {
    codePoint: null,
    count: Math.max(1, highlight.to - highlight.from),
    expected,
    from: highlight.from,
    kind: 'list-item-punctuation',
    line: endpoint.line.index,
    name: 'list item punctuation',
    replacement: expected,
    replacementFrom,
    replacementTo,
    severity: 'warning',
    to: highlight.to,
    zeroWidth: false,
  };
}

function detectLineEndingGremlins(
  groups: readonly ListGroup[],
  lines: readonly SourceLine[],
  policy: Exclude<
    GremlinsSettings['listItemLineEndingPolicy'],
    'disabled'
  >,
) {

  if (policy === 'blank-line') {
    return detectMissingBlankLines(groups, lines);
  }

  const matches: ListItemLineEndingGremlinMatch[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (!item.lineEndingEndpoint) {
        continue;
      }

      const match = trailingWhitespaceMatch(
        item.lineEndingEndpoint,
        policy,
      );
      if (match) {
        matches.push(match);
      }
    }
  }
  return matches;
}

function trailingWhitespaceMatch(
  endpoint: ItemEndpoint,
  expected: 'no-trailing-whitespace' | 'two-spaces',
): ListItemLineEndingGremlinMatch | null {
  const actual = endpoint.line.text.slice(endpoint.trailingFrom);
  const replacement = expected === 'two-spaces' ? '  ' : '';
  if (actual === replacement) {
    return null;
  }

  const highlight = actual.length > 0
    ? {
        from: endpoint.line.from + endpoint.trailingFrom,
        to: endpoint.line.to,
      }
    : fallbackHighlight(
        endpoint.line,
        endpoint.effectiveEnd,
        endpoint.contentStart,
      );

  return {
    codePoint: null,
    count: Math.max(1, actual.length),
    expected,
    from: highlight.from,
    kind: 'list-item-line-ending',
    line: endpoint.line.index,
    name: 'list item line ending',
    replacement,
    replacementFrom: endpoint.line.from + endpoint.trailingFrom,
    replacementTo: endpoint.line.to,
    severity: 'warning',
    to: highlight.to,
    zeroWidth: false,
  };
}

function detectMissingBlankLines(
  groups: readonly ListGroup[],
  lines: readonly SourceLine[],
) {
  const matches: ListItemLineEndingGremlinMatch[] = [];

  for (const group of groups) {
    for (let index = 0; index + 1 < group.items.length; index += 1) {
      const item = group.items[index];
      const nextItem = group.items[index + 1];
      if (
        !item ||
        !nextItem ||
        nextItem.markerLine > item.subtreeLastLine + 1
      ) {
        continue;
      }

      const anchor = lines[item.subtreeLastLine];
      if (!anchor) {
        continue;
      }
      const highlight = fallbackHighlight(anchor, anchor.text.length, 0);
      const quotePrefix = item.quotePrefix.trimEnd();

      matches.push({
        codePoint: null,
        count: 1,
        expected: 'blank-line',
        from: highlight.from,
        kind: 'list-item-line-ending',
        line: anchor.index,
        name: 'list item line ending',
        replacement: `\n${quotePrefix}`,
        replacementFrom: anchor.to,
        replacementTo: anchor.to,
        severity: 'warning',
        to: highlight.to,
        zeroWidth: false,
      });
    }
  }

  return matches;
}

function terminalPunctuation(
  endpoint: ItemEndpoint,
): TerminalPunctuation {
  const lineText = endpoint.line.text;
  const direct = punctuationInRange(
    endpoint.line,
    endpoint.contentStart,
    endpoint.effectiveEnd,
  );
  if (direct.value) {
    return direct;
  }

  const content = lineText.slice(endpoint.contentStart, endpoint.effectiveEnd);
  const formatting = TRAILING_FORMATTING_MARKERS.exec(content)?.[0] ?? '';
  const semanticEnd = endpoint.effectiveEnd - formatting.length;
  const semanticContent = lineText.slice(endpoint.contentStart, semanticEnd);
  const markdownLink = markdownLinkLabelRange(
    lineText,
    endpoint.contentStart,
    semanticEnd,
  );
  if (markdownLink) {
    const punctuation = punctuationInRange(
      endpoint.line,
      markdownLink.from,
      markdownLink.to,
    );
    if (punctuation.value) {
      return punctuation;
    }
  }

  const wikiLink = /!?\[\[([^\]]+)\]\]$/.exec(semanticContent);
  if (wikiLink?.[1]?.includes('|')) {
    const displayOffset = wikiLink[1].lastIndexOf('|') + 1;
    const openingLength = wikiLink[0].startsWith('!') ? 3 : 2;
    const displayFrom =
      endpoint.contentStart +
      wikiLink.index +
      openingLength +
      displayOffset;
    const punctuation = punctuationInRange(
      endpoint.line,
      displayFrom,
      displayFrom + wikiLink[1].length - displayOffset,
    );
    if (punctuation.value) {
      return punctuation;
    }
  }

  return { from: null, to: null, value: '' };
}

function markdownLinkLabelRange(text: string, start: number, end: number) {
  if (text[end - 1] !== ')') {
    return null;
  }

  const destinationFrom = matchingOpeningDelimiter(
    text,
    end - 1,
    start,
    '(',
    ')',
  );
  if (destinationFrom === null || text[destinationFrom - 1] !== ']') {
    return null;
  }

  const labelFrom = matchingOpeningDelimiter(
    text,
    destinationFrom - 1,
    start,
    '[',
    ']',
  );
  return labelFrom === null
    ? null
    : { from: labelFrom + 1, to: destinationFrom - 1 };
}

function matchingOpeningDelimiter(
  text: string,
  closing: number,
  minimum: number,
  openingCharacter: string,
  closingCharacter: string,
) {
  let depth = 0;
  for (let index = closing; index >= minimum; index -= 1) {
    if (isEscaped(text, index)) {
      continue;
    }
    const character = text[index];
    if (character === closingCharacter) {
      depth += 1;
    } else if (character === openingCharacter) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return null;
}

function isEscaped(text: string, index: number) {
  let backslashes = 0;
  for (let cursor = index - 1; text[cursor] === '\\'; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function punctuationInRange(
  line: SourceLine,
  start: number,
  end: number,
): TerminalPunctuation {
  const content = line.text.slice(start, end);
  const formatting = TRAILING_FORMATTING_MARKERS.exec(content)?.[0] ?? '';
  const punctuationEnd = end - formatting.length;
  const punctuation = TERMINAL_PUNCTUATION_RUN.exec(
    line.text.slice(start, punctuationEnd),
  );
  if (!punctuation) {
    return { from: null, to: null, value: '' };
  }

  const punctuationFrom = start + punctuation.index;
  const sourceFrom =
    punctuationFrom > start && isEscaped(line.text, punctuationFrom)
      ? punctuationFrom - 1
      : punctuationFrom;
  return {
    from: line.from + sourceFrom,
    to: line.from + punctuationEnd,
    value: punctuation[0],
  };
}

function fallbackHighlight(
  line: SourceLine,
  end: number,
  minimum: number,
) {
  const boundedEnd = Math.max(minimum, Math.min(end, line.text.length));
  if (boundedEnd <= minimum) {
    return {
      from: line.from + minimum,
      to: line.from + Math.min(line.text.length, minimum + 1),
    };
  }

  const finalCodeUnit = line.text.charCodeAt(boundedEnd - 1);
  const previousCodeUnit = line.text.charCodeAt(boundedEnd - 2);
  const width =
    finalCodeUnit >= 0xdc00 &&
    finalCodeUnit <= 0xdfff &&
    previousCodeUnit >= 0xd800 &&
    previousCodeUnit <= 0xdbff
      ? 2
      : 1;
  return {
    from: line.from + Math.max(minimum, boundedEnd - width),
    to: line.from + boundedEnd,
  };
}

function compareMatches(left: GremlinMatch, right: GremlinMatch) {
  if (left.from !== right.from) {
    return left.from - right.from;
  }
  const rank = (match: GremlinMatch) =>
    match.kind === 'list-item-punctuation' ? 0 : 1;
  return rank(left) - rank(right);
}
