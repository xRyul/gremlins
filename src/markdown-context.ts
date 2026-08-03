import { syntaxTree, syntaxTreeAvailable } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

import { detectListItemEndingGremlins } from './list-item-endings.ts';
import type { GremlinsSettings } from './settings-model.ts';

import type { MarkdownListContext } from './types.ts';

type MarkdownSyntaxNode = ReturnType<typeof syntaxTree>['topNode'];

const LIST_MARKER_NODE = /(?:^|_)formatting-list(?:_|$)/;
const LIST_LINE_LEVEL_NODE =
  /(?:^|_)HyperMD-list-line-(\d+)(?:_|$)/;
const INDENTED_CODE_NODE = /(?:^|_)hmd-indented-code(?:_|$)/;
const BLOCK_LITERAL_NODE = /(?:comment|codeblock|frontmatter|math|yaml)/i;
const LITERAL_NODE = /(?:comment|code|frontmatter|math|yaml)/i;
const BLOCKQUOTE_PREFIX = /^(?:[\t ]*>[\t ]?)+/;
const BLOCKQUOTE_NODE = /(?:^|_)(?:HyperMD-quote|quote)(?:_|$)/;

export function markdownSyntaxTreeChanged(
  startState: EditorState,
  state: EditorState,
) {
  return syntaxTree(startState) !== syntaxTree(state);
}

export function detectEditorListItemEndingGremlins(
  state: EditorState,
  settings: GremlinsSettings,
) {
  return detectListItemEndingGremlins(state.doc.toString(), settings, {
    indentSize: state.tabSize,
    resolveLineContext: (text, lineFrom) =>
      getMarkdownListLineContext(state, text, lineFrom),
  });
}

export function getMarkdownListContext(
  state: EditorState,
  lineText: string,
  lineFrom: number,
): MarkdownListContext {
  return getMarkdownListLineContext(state, lineText, lineFrom).context;
}

export function getMarkdownListLineContext(
  state: EditorState,
  lineText: string,
  lineFrom: number,
) {
  const blockquoteLength = BLOCKQUOTE_PREFIX.exec(lineText)?.[0].length ?? 0;
  const content = lineText.slice(blockquoteLength);
  const indentationLength = /^[\t ]*/.exec(content)?.[0].length ?? 0;
  const markerPosition = lineFrom + blockquoteLength + indentationLength;
  const tree = syntaxTree(state);
  const nodeNames: string[] = [];
  let node: MarkdownSyntaxNode | null = tree.resolveInner(markerPosition, 1);

  while (node) {
    nodeNames.push(node.name);
    node = node.parent;
  }

  const treeAvailable = syntaxTreeAvailable(
    state,
    Math.min(lineFrom + lineText.length, state.doc.length),
  );
  return {
    context: classifyMarkdownListSyntax(nodeNames, treeAvailable),
    listDepth: treeAvailable ? markdownListDepth(nodeNames) : null,
  };
}

export function classifyMarkdownListSyntax(
  nodeNames: readonly string[],
  treeAvailable: boolean,
): MarkdownListContext {
  if (!treeAvailable) {
    return 'unknown';
  }

  if (nodeNames.some((name) => INDENTED_CODE_NODE.test(name))) {
    return 'indented-code';
  }

  if (nodeNames.some((name) => BLOCK_LITERAL_NODE.test(name))) {
    return 'literal';
  }

  const listMarker = nodeNames.find((name) => LIST_MARKER_NODE.test(name));
  if (listMarker) {
    const listLine = nodeNames.find((name) =>
      LIST_LINE_LEVEL_NODE.test(name),
    );
    const level = Number(
      listLine ? LIST_LINE_LEVEL_NODE.exec(listLine)?.[1] : undefined,
    );
    return level === 1 ? 'root-list-item' : 'nested-list-item';
  }

  if (nodeNames.some((name) => LIST_LINE_LEVEL_NODE.test(name))) {
    return 'list-continuation';
  }

  if (nodeNames.some((name) => LITERAL_NODE.test(name))) {
    return 'literal';
  }

  if (nodeNames.some((name) => BLOCKQUOTE_NODE.test(name))) {
    return 'blockquote';
  }

  return nodeNames.length > 1 ? 'literal' : 'plain-text';
}

function markdownListDepth(nodeNames: readonly string[]) {
  const listLine = nodeNames.find((name) =>
    LIST_LINE_LEVEL_NODE.test(name),
  );
  const depth = Number(
    listLine ? LIST_LINE_LEVEL_NODE.exec(listLine)?.[1] : undefined,
  );
  return Number.isInteger(depth) && depth > 0 ? depth : null;
}
