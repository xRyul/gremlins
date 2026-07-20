import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

type MarkdownSyntaxNode = ReturnType<typeof syntaxTree>['topNode'];

const LIST_MARKER_NODE = /(?:^|_)formatting-list(?:_|$)/;

export function markdownSyntaxTreeChanged(
  startState: EditorState,
  state: EditorState,
) {
  return syntaxTree(startState) !== syntaxTree(state);
}

export function isMarkdownListItem(
  state: EditorState,
  lineText: string,
  lineFrom: number,
) {
  const indentationLength = /^[\t ]*/.exec(lineText)?.[0].length ?? 0;
  let node: MarkdownSyntaxNode | null = syntaxTree(state).resolveInner(
    lineFrom + indentationLength,
    1,
  );

  while (node) {
    if (LIST_MARKER_NODE.test(node.name)) {
      return true;
    }
    node = node.parent;
  }

  return false;
}
