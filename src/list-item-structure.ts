import type { MarkdownListContext } from './types.ts';

const DEFAULT_INDENT_SIZE = 4;
const MARKDOWN_LIST_MARKER =
  /^(?<indentation>[\t ]*)(?<marker>[-+*]|[0-9]{1,9}[.)])(?<delimiter>[\t ]+).*$/;
const MARKDOWN_THEMATIC_BREAK =
  /^ {0,3}([-*_])(?:[\t ]*\1){2,}[\t ]*$/;
const TASK_CHECKBOX = /^\[[ xX-]\](?:[\t ]+|$)/;
const TASK_CHECKBOX_TOKEN = /^\[[ xX-]\]/;
const OBSIDIAN_BLOCK_ID = /[\t ]+\^[A-Za-z0-9-]+$/;
const TRAILING_WHITESPACE = /[\t \u00a0\u2007\u202f]*$/;

type ListStyle = '-' | '+' | '*' | '.' | ')';

export interface SourceLine {
  from: number;
  index: number;
  text: string;
  to: number;
}

interface LinePrefix {
  content: string;
  contentFrom: number;
  quoteDepth: number;
  quotePrefix: string;
}

interface ParsedListMarker {
  contentStart: number;
  indentationWidth: number;
  quoteDepth: number;
  quotePrefix: string;
  style: ListStyle;
}

export interface ItemEndpoint {
  contentStart: number;
  effectiveEnd: number;
  hasBlockId: boolean;
  line: SourceLine;
  trailingFrom: number;
}

export interface ListGroup {
  items: ListItem[];
}

export interface ListItem {
  endpoint: ItemEndpoint | null;
  lineEndingEndpoint: ItemEndpoint | null;
  group: ListGroup;
  hasNestedList: boolean;
  indentationWidth: number;
  markerLine: number;
  quoteDepth: number;
  quotePrefix: string;
  style: ListStyle;
  syntaxDepth: number | null;
  subtreeLastLine: number;
}

export interface ListItemEndingLineContext {
  context: MarkdownListContext;
  listDepth: number | null;
}

export interface ListItemEndingDetectionOptions {
  indentSize?: number;
  resolveLineContext?: (
    text: string,
    lineFrom: number,
    line: number,
  ) => ListItemEndingLineContext;
}

export function parseListItemStructure(
  text: string,
  options: ListItemEndingDetectionOptions,
) {
  const lines = sourceLines(text);
  return { groups: parseListGroups(lines, options), lines };
}

function parseListGroups(
  lines: readonly SourceLine[],
  options: ListItemEndingDetectionOptions,
) {
  const groups: ListGroup[] = [];
  let activeItems: ListItem[] = [];
  const literalLines = markdownLiteralLines(lines);
  const indentSize = normalizeIndentSize(options.indentSize);

  for (const line of lines) {
    const prefix = parseLinePrefix(line.text);
    const indentation = /^[\t ]*/.exec(prefix.content)?.[0] ?? '';
    const width = indentationWidth(indentation, indentSize);
    const marker = parseListMarker(prefix, indentSize);
    const shouldResolveContext = marker !== null || activeItems.length > 0;
    const lineContext = shouldResolveContext
      ? options.resolveLineContext?.(line.text, line.from, line.index)
      : undefined;
    const context = lineContext?.context;
    const syntaxDepth = lineContext?.listDepth ?? null;
    const isLiteral =
      literalLines.has(line.index) || isLiteralContext(context);

    if (isLiteral) {
      if (prefix.content.trim().length === 0) {
        continue;
      }
      const ownerIndex = findOwningItem(
        activeItems,
        prefix.quoteDepth,
        width,
        context,
        syntaxDepth,
      );
      if (ownerIndex < 0) {
        activeItems = [];
      } else {
        activeItems = activeItems.slice(0, ownerIndex + 1);
        updateSubtreeEnd(activeItems, line.index);
      }
      continue;
    }

    const acceptedMarker =
      marker && isListContextAccepted(context) ? marker : null;
    if (marker && !acceptedMarker) {
      activeItems = [];
      continue;
    }

    if (acceptedMarker) {
      if (
        activeItems.some(
          (item) => item.quoteDepth !== acceptedMarker.quoteDepth,
        )
      ) {
        activeItems = [];
      }

      let previousSibling: ListItem | null = null;
      while (
        activeItems.length > 0 &&
        (activeItems[activeItems.length - 1]?.indentationWidth ?? -1) >=
          acceptedMarker.indentationWidth
      ) {
        const completed = activeItems.pop();
        if (
          completed?.indentationWidth ===
            acceptedMarker.indentationWidth &&
          completed.style === acceptedMarker.style
        ) {
          previousSibling = completed;
        }
      }

      const parent = activeItems[activeItems.length - 1];
      if (
        (context === undefined ||
          context === 'parserless' ||
          context === 'unknown') &&
        !parent &&
        acceptedMarker.indentationWidth >= indentSize
      ) {
        activeItems = [];
        continue;
      }

      if (parent) {
        parent.hasNestedList = true;
      }

      const group = previousSibling?.group ?? { items: [] };
      if (!previousSibling) {
        groups.push(group);
      }

      const endpoints = endpointsForMarker(line, acceptedMarker);
      const item: ListItem = {
        endpoint: endpoints.punctuation,
        group,
        hasNestedList: false,
        indentationWidth: acceptedMarker.indentationWidth,
        lineEndingEndpoint: endpoints.lineEnding,
        markerLine: line.index,
        quoteDepth: acceptedMarker.quoteDepth,
        quotePrefix: acceptedMarker.quotePrefix,
        style: acceptedMarker.style,
        syntaxDepth,
        subtreeLastLine: line.index,
      };
      group.items.push(item);
      updateSubtreeEnd(activeItems, line.index);
      activeItems.push(item);
      continue;
    }

    if (prefix.content.trim().length === 0) {
      continue;
    }

    const ownerIndex = findOwningItem(
      activeItems,
      prefix.quoteDepth,
      width,
      context,
      syntaxDepth,
    );
    if (ownerIndex < 0) {
      activeItems = [];
      continue;
    }

    activeItems = activeItems.slice(0, ownerIndex + 1);
    const owner = activeItems[ownerIndex];
    if (!owner) {
      continue;
    }

    const contentStart = prefix.contentFrom + indentation.length;
    const endpoint = endpointForContent(line, contentStart);
    if (endpoint) {
      owner.endpoint = endpoint;
      owner.lineEndingEndpoint = endpoint;
    }
    updateSubtreeEnd(activeItems, line.index);
  }

  return groups;
}

function findOwningItem(
  activeItems: readonly ListItem[],
  quoteDepth: number,
  indentation: number,
  context: MarkdownListContext | undefined,
  syntaxDepth: number | null,
) {
  if (syntaxDepth !== null) {
    for (let index = activeItems.length - 1; index >= 0; index -= 1) {
      const item = activeItems[index];
      if (
        item?.syntaxDepth === syntaxDepth &&
        (item.quoteDepth === quoteDepth || context === 'list-continuation')
      ) {
        return index;
      }
    }
  }

  if (
    context !== undefined &&
    context !== 'list-continuation' &&
    context !== 'parserless' &&
    context !== 'unknown'
  ) {
    return -1;
  }

  for (let index = activeItems.length - 1; index >= 0; index -= 1) {
    const item = activeItems[index];
    if (
      item &&
      item.quoteDepth === quoteDepth &&
      indentation > item.indentationWidth
    ) {
      return index;
    }
  }

  if (context === 'list-continuation') {
    for (let index = activeItems.length - 1; index >= 0; index -= 1) {
      if (activeItems[index]?.quoteDepth === quoteDepth) {
        return index;
      }
    }
  }

  return -1;
}

function updateSubtreeEnd(items: readonly ListItem[], line: number) {
  for (const item of items) {
    item.subtreeLastLine = line;
  }
}

function isLiteralContext(context: MarkdownListContext | undefined) {
  return context === 'indented-code' || context === 'literal';
}

function endpointsForMarker(
  line: SourceLine,
  marker: ParsedListMarker,
) {
  const markerContent = line.text.slice(marker.contentStart);
  const checkbox = TASK_CHECKBOX.exec(markerContent)?.[0] ?? '';
  const punctuation = endpointForContent(
    line,
    marker.contentStart + checkbox.length,
  );
  if (punctuation) {
    return { lineEnding: punctuation, punctuation };
  }

  const checkboxToken = TASK_CHECKBOX_TOKEN.exec(markerContent)?.[0];
  if (checkboxToken && markerContent.slice(checkboxToken.length).trim() === '') {
    const trailingWhitespace = TRAILING_WHITESPACE.exec(line.text)?.[0] ?? '';
    const trailingFrom = line.text.length - trailingWhitespace.length;
    return {
      lineEnding: {
        contentStart: marker.contentStart,
        effectiveEnd: trailingFrom,
        hasBlockId: false,
        line,
        trailingFrom,
      },
      punctuation: null,
    };
  }

  return { lineEnding: null, punctuation: null };
}

function endpointForContent(line: SourceLine, contentStart: number) {
  const trailingWhitespace = TRAILING_WHITESPACE.exec(line.text)?.[0] ?? '';
  const trailingFrom = line.text.length - trailingWhitespace.length;
  let effectiveEnd = trailingFrom;
  const content = line.text.slice(contentStart, effectiveEnd);
  const blockId = OBSIDIAN_BLOCK_ID.exec(content);
  if (blockId) {
    effectiveEnd = contentStart + blockId.index;
  }

  return effectiveEnd > contentStart
    ? {
        contentStart,
        effectiveEnd,
        hasBlockId: blockId !== null,
        line,
        trailingFrom,
      }
    : null;
}

function parseListMarker(
  prefix: LinePrefix,
  indentSize: number,
): ParsedListMarker | null {
  if (MARKDOWN_THEMATIC_BREAK.test(prefix.content)) {
    return null;
  }

  const match = MARKDOWN_LIST_MARKER.exec(prefix.content);
  const groups = match?.groups;
  const indentation = groups?.indentation;
  const marker = groups?.marker;
  const delimiter = groups?.delimiter;
  if (
    indentation === undefined ||
    marker === undefined ||
    delimiter === undefined
  ) {
    return null;
  }

  const markerOffset = prefix.contentFrom + indentation.length;
  return {
    contentStart: markerOffset + marker.length + delimiter.length,
    indentationWidth: indentationWidth(indentation, indentSize),
    quoteDepth: prefix.quoteDepth,
    quotePrefix: prefix.quotePrefix,
    style: listStyle(marker),
  };
}

function listStyle(marker: string): ListStyle {
  if (marker === '-' || marker === '+' || marker === '*') {
    return marker;
  }
  return marker.endsWith(')') ? ')' : '.';
}

function parseLinePrefix(text: string): LinePrefix {
  let offset = 0;
  let quoteDepth = 0;

  while (offset < text.length) {
    const quote = /^[\t ]*>[\t ]?/.exec(text.slice(offset));
    if (!quote) {
      break;
    }
    offset += quote[0].length;
    quoteDepth += 1;
  }

  return {
    content: text.slice(offset),
    contentFrom: offset,
    quoteDepth,
    quotePrefix: text.slice(0, offset),
  };
}

function markdownLiteralLines(lines: readonly SourceLine[]) {
  const literal = new Set<number>();
  const firstLine = lines[0]?.text.trim();
  if (firstLine === '---') {
    const closing = lines.findIndex(
      (line, index) => index > 0 && /^(?:---|\.\.\.)\s*$/.test(line.text),
    );
    if (closing > 0) {
      for (let index = 0; index <= closing; index += 1) {
        literal.add(index);
      }
    }
  }

  let fence: { character: '`' | '~'; length: number } | null = null;
  for (const line of lines) {
    if (literal.has(line.index)) {
      continue;
    }

    const content = parseLinePrefix(line.text).content;
    const candidateMatch = /^ {0,3}(`{3,}|~{3,})/.exec(content);
    const candidate = candidateMatch?.[1];

    if (!fence) {
      if (!candidate) {
        continue;
      }
      fence = {
        character: candidate[0] as '`' | '~',
        length: candidate.length,
      };
      literal.add(line.index);
      continue;
    }

    literal.add(line.index);
    if (!candidate || !candidateMatch) {
      continue;
    }

    const character = candidate[0] as '`' | '~';
    const remainder = content.slice(candidateMatch[0].length);
    if (
      character === fence.character &&
      candidate.length >= fence.length &&
      remainder.trim().length === 0
    ) {
      fence = null;
    }
  }

  return literal;
}

function sourceLines(text: string): SourceLine[] {
  let from = 0;
  return text.split('\n').map((lineText, index) => {
    const line = {
      from,
      index,
      text: lineText,
      to: from + lineText.length,
    };
    from += lineText.length + 1;
    return line;
  });
}

function isListContextAccepted(context: MarkdownListContext | undefined) {
  return (
    context === undefined ||
    context === 'nested-list-item' ||
    context === 'parserless' ||
    context === 'root-list-item' ||
    context === 'unknown'
  );
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

function normalizeIndentSize(indentSize: number | undefined) {
  return typeof indentSize === 'number' &&
    Number.isInteger(indentSize) &&
    indentSize > 0
    ? indentSize
    : DEFAULT_INDENT_SIZE;
}
