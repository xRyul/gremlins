import { GREMLIN_DEFINITIONS_BY_CODE_POINT } from './characters.ts';
import { detectListItemEndingGremlins } from './list-item-endings.ts';
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
const DUPLICATE_UNORDERED_LIST_MARKERS =
  /^([\t ]*)[-+*]([\t ]+)(?=[-+*][\t ]+\S)/;
const MARKDOWN_LIST_MARKER_WITH_DELIMITER =
  /^([\t ]*)([-+*]|[0-9]{1,9}[.)])([\t ]+)(?=\S|$)/;
const MARKDOWN_THEMATIC_BREAK =
  /^ {0,3}([-*_])(?:[\t ]*\1){2,}[\t ]*$/;
const POTENTIAL_SETEXT_UNDERLINE = /^[\t ]*-[\t ]*$/;
const AMBIGUOUS_EMPTY_LIST_MARKER = /^([\t ]*)-$/;
const MARKDOWN_LIST_LINE_WITH_CONTENT =
  /^([\t ]*)([-+*]|\d+[.)])([\t ]{1,4})\S/;
const MARKDOWN_DASH_LIST_ITEM_WITH_CONTENT = /^([\t ]*)-[\t ]+\S/;
const BLOCKQUOTE_PREFIX = /^(?:[\t ]*>[\t ]?)+/;
const PARSERLESS_LIST_CONTEXT: MarkdownListContext = 'parserless';

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

  matches.push(
    ...detectListItemEndingGremlins(text, settings, { indentSize }),
  );
  return matches.sort((left, right) => left.from - right.from);
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

  const duplicateListMarker = settings.showDuplicateListMarkers
    ? detectDuplicateListMarker(text, lineFrom, line, listContext)
    : null;
  if (duplicateListMarker) {
    matches.push(duplicateListMarker);
  }

  if (settings.showListMarkerSpacing) {
    const listMarkerSpacingMatches = detectListMarkerSpacing(
      text,
      lineFrom,
      line,
      listContext,
    ).filter(
      (match) =>
        !duplicateListMarker || match.from >= duplicateListMarker.to,
    );
    matches.push(...listMarkerSpacingMatches);
  }

  if (settings.showAmbiguousEmptyListMarkers) {
    const ambiguousEmptyListMarker = detectAmbiguousEmptyListMarker(
      previousLine,
      text,
      nextLine,
      lineFrom,
      line,
      effectiveIndentSize,
      listContext,
    );
    if (ambiguousEmptyListMarker) {
      matches.push(ambiguousEmptyListMarker);
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

function detectDuplicateListMarker(
  text: string,
  lineFrom: number,
  line: number,
  listContext: MarkdownListContext,
): GremlinMatch | null {
  const content = listMarkerRuleContent(text, listContext);
  if (!content) {
    return null;
  }
  const duplicateMarkers = DUPLICATE_UNORDERED_LIST_MARKERS.exec(
    content.text,
  );
  if (!duplicateMarkers) {
    return null;
  }

  const indentation = duplicateMarkers[1] ?? '';
  const delimiter = duplicateMarkers[2] ?? '';
  const markerFrom =
    lineFrom + content.prefix.length + indentation.length;

  return {
    codePoint: null,
    count: 1,
    from: markerFrom,
    kind: 'duplicate-list-marker',
    line,
    name: 'duplicate list marker',
    severity: 'warning',
    to: markerFrom + 1 + delimiter.length,
    zeroWidth: false,
  };
}

function detectListMarkerSpacing(
  text: string,
  lineFrom: number,
  line: number,
  listContext: MarkdownListContext,
): GremlinMatch[] {
  const content = listMarkerRuleContent(text, listContext);
  if (!content) {
    return [];
  }

  const matches: GremlinMatch[] = [];
  const contentFrom = lineFrom + content.prefix.length;
  let markerOffset = 0;

  while (markerOffset <= content.text.length) {
    const listMarker = MARKDOWN_LIST_MARKER_WITH_DELIMITER.exec(
      content.text.slice(markerOffset),
    );
    if (!listMarker) {
      break;
    }

    const indentation = listMarker[1] ?? '';
    const marker = listMarker[2] ?? '';
    const delimiter = listMarker[3] ?? '';
    const spacingFrom =
      contentFrom + markerOffset + indentation.length + marker.length;

    if (delimiter !== ' ') {
      matches.push({
        codePoint: null,
        count: delimiter.length,
        from: spacingFrom,
        kind: 'list-marker-spacing',
        line,
        name: 'list marker spacing',
        severity: 'warning',
        to: spacingFrom + delimiter.length,
        zeroWidth: false,
      });
    }

    markerOffset +=
      indentation.length + marker.length + delimiter.length;
  }

  return matches;
}

function listMarkerRuleContent(
  text: string,
  listContext: MarkdownListContext,
) {
  if (!isListMarkerRuleContext(listContext)) {
    return null;
  }

  const content = markdownLineContent(text);
  return MARKDOWN_THEMATIC_BREAK.test(content.text) ||
    POTENTIAL_SETEXT_UNDERLINE.test(content.text)
    ? null
    : content;
}

function isListMarkerRuleContext(context: MarkdownListContext) {
  return (
    context === 'blockquote' ||
    context === 'nested-list-item' ||
    context === 'plain-text' ||
    context === 'root-list-item'
  );
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

  return (
    context === 'nested-list-item' ||
    context === 'parserless'
  ) &&
    !indentation.includes('\t') &&
    indentation.length % indentSize !== 0
    ? ('misaligned' as const)
    : null;
}

function detectAmbiguousEmptyListMarker(
  previousLine: string | undefined,
  text: string,
  nextLine: string | undefined,
  lineFrom: number,
  line: number,
  indentSize: number,
  listContext: MarkdownListContext,
): GremlinMatch | null {
  const markerContent = markdownLineContent(text);
  const previousContent = markdownLineContent(previousLine);
  const nextContent = markdownLineContent(nextLine);
  const markerLine = AMBIGUOUS_EMPTY_LIST_MARKER.exec(markerContent.text);
  const previousListItem = MARKDOWN_LIST_LINE_WITH_CONTENT.exec(
    previousContent.text,
  );
  const nextListItem = MARKDOWN_DASH_LIST_ITEM_WITH_CONTENT.exec(
    nextContent.text,
  );
  const isListContext =
    listContext === 'blockquote' ||
    listContext === 'list-continuation' ||
    listContext === 'nested-list-item' ||
    listContext === 'plain-text' ||
    listContext === 'root-list-item';

  if (
    !markerLine ||
    !previousListItem ||
    !nextListItem ||
    !isListContext ||
    markerContent.prefix !== previousContent.prefix ||
    markerContent.prefix !== nextContent.prefix
  ) {
    return null;
  }

  const indentation = markerLine[1] ?? '';
  const previousIndentation = previousListItem[1] ?? '';
  const previousMarker = previousListItem[2];
  const previousDelimiter = previousListItem[3];
  const nextIndentation = nextListItem[1] ?? '';
  const currentWidth = indentationWidth(indentation, indentSize);
  const previousWidth = indentationWidth(previousIndentation, indentSize);
  const parentMarkerEnd =
    previousWidth + (previousMarker?.length ?? 0);
  const minimumChildWidth = indentationWidth(
    previousDelimiter ?? '',
    indentSize,
    parentMarkerEnd,
  );
  const followsParent =
    previousMarker !== undefined &&
    previousDelimiter !== undefined &&
    currentWidth >= minimumChildWidth &&
    currentWidth <= minimumChildWidth + 3;
  const followsSibling =
    previousIndentation === indentation && previousMarker === '-';

  if (nextIndentation !== indentation || (!followsParent && !followsSibling)) {
    return null;
  }

  const markerFrom =
    lineFrom + markerContent.prefix.length + indentation.length;
  return {
    codePoint: null,
    count: 1,
    from: markerFrom,
    kind: 'ambiguous-empty-list-marker',
    line,
    name: 'ambiguous empty list marker',
    severity: 'warning',
    to: markerFrom + 1,
    zeroWidth: false,
  };
}

function markdownLineContent(text: string | undefined) {
  const source = text ?? '';
  const prefix = BLOCKQUOTE_PREFIX.exec(source)?.[0] ?? '';
  return { prefix, text: source.slice(prefix.length) };
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

function indentationWidth(
  indentation: string,
  indentSize: number,
  initialWidth = 0,
) {
  let width = initialWidth;

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
