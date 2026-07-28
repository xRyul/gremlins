import { syntaxTree, syntaxTreeAvailable } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

import type { MarkdownListContext } from './types.ts';

type MarkdownSyntaxNode = ReturnType<typeof syntaxTree>['topNode'];

const LIST_MARKER_NODE = /(?:^|_)formatting-list(?:_|$)/;
const LIST_LINE_LEVEL_NODE =
  /(?:^|_)HyperMD-list-line-(\d+)(?:_|$)/;

export function markdownSyntaxTreeChanged(
  startState: EditorState,
  state: EditorState,
) {
  return syntaxTree(startState) !== syntaxTree(state);
}

export function getMarkdownListContext(
  state: EditorState,
  lineText: string,
  lineFrom: number,
): MarkdownListContext {
  const indentationLength = /^[\t ]*/.exec(lineText)?.[0].length ?? 0;
  const markerPosition = lineFrom + indentationLength;
  const tree = syntaxTree(state);
  const nodeNames: string[] = [];
  let node: MarkdownSyntaxNode | null = tree.resolveInner(markerPosition, 1);

  while (node) {
    nodeNames.push(node.name);
    node = node.parent;
  }

  return classifyMarkdownListSyntax(
    nodeNames,
    syntaxTreeAvailable(
      state,
      Math.min(lineFrom + lineText.length, state.doc.length),
    ),
  );
}

export function classifyMarkdownListSyntax(
  nodeNames: readonly string[],
  treeAvailable: boolean,
): MarkdownListContext {
  if (!treeAvailable) {
    return 'unknown';
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

  return nodeNames.length > 1 ? 'literal' : 'plain-text';
}
