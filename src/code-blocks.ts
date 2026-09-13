import type { Text } from '@codemirror/state';

import { detectLineGremlins } from './detect.ts';
import { buildGremlinFixChanges, type GremlinFixChange } from './fix.ts';
import type { GremlinsSettings } from './settings-model.ts';

export interface FencedCodeBlock {
  from: number;
  openingLine: number;
  lastContentLine: number;
}

export interface CodeBlockFix extends FencedCodeBlock {
  changes: GremlinFixChange[];
  affectedLines: number[];
}

interface OpenFence {
  from: number;
  openingLine: number;
  character: string;
  length: number;
  quoteDepth: number;
}

/** Locate ordinary and blockquoted fences, including an unfinished final block. */
export function findFencedCodeBlocks(doc: Text): FencedCodeBlock[] {
  const blocks: FencedCodeBlock[] = [];
  let opening: OpenFence | null = null;
  let frontmatter = doc.line(1).text.trim() === '---';

  for (let number = 1; number <= doc.lines; number++) {
    const line = doc.line(number);
    if (frontmatter) {
      if (number > 1 && /^(?:---|\.\.\.)\s*$/.test(line.text)) {
        frontmatter = false;
      }
      continue;
    }

    const quote = /^(?: {0,3}>[\t ]?)*/.exec(line.text)?.[0] ?? '';
    const content = line.text.slice(quote.length);
    const quoteDepth = (quote.match(/>/g) ?? []).length;
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(content);
    const fence = match?.[1];
    const suffix = match?.[2] ?? '';

    if (opening && quoteDepth < opening.quoteDepth) {
      blocks.push({ ...opening, lastContentLine: number - 1 });
      opening = null;
    }

    if (!opening) {
      if (!fence || (fence.startsWith('`') && suffix.includes('`'))) {
        continue;
      }
      opening = {
        from: line.from,
        openingLine: number,
        character: fence.charAt(0),
        length: fence.length,
        quoteDepth,
      };
    } else if (
      fence && quoteDepth === opening.quoteDepth &&
      fence.charAt(0) === opening.character &&
      fence.length >= opening.length && /^[\t ]*$/.test(suffix)
    ) {
      blocks.push({ ...opening, lastContentLine: number - 1 });
      opening = null;
    }
  }

  if (opening) {
    blocks.push({ ...opening, lastContentLine: doc.lines });
  }
  return blocks;
}

/** Reuse the same character and indentation fixes as individual gutter clicks. */
export function buildCodeBlockFix(
  doc: Text,
  block: FencedCodeBlock,
  settings: GremlinsSettings,
  indentSize: number,
): CodeBlockFix {
  const changes: GremlinFixChange[] = [];
  const affectedLines: number[] = [];
  for (let number = block.openingLine + 1; number <= block.lastContentLine; number++) {
    const line = doc.line(number);
    const matches = detectLineGremlins(
      line.text, line.from, number - 1, settings, indentSize, 'literal',
    ).filter((match) => match.kind === 'character' || match.kind === 'mixed-indentation');
    const fixes = buildGremlinFixChanges(matches, line.text, line.from, indentSize);
    if (fixes.length > 0) {
      affectedLines.push(number);
      changes.push(...fixes);
    }
  }
  return { ...block, changes, affectedLines };
}

/** Each editor owns this cache; scrolling should not rescan an unchanged note. */
export function createCodeBlockScanner(settings: GremlinsSettings) {
  let previousDoc: Text | undefined;
  let previousIndentSize: number | undefined;
  let fixes: CodeBlockFix[] = [];
  return (doc: Text, indentSize: number): readonly CodeBlockFix[] => {
    if (doc !== previousDoc || indentSize !== previousIndentSize) {
      fixes = findFencedCodeBlocks(doc)
        .map((block) => buildCodeBlockFix(doc, block, settings, indentSize))
        .filter((block) => block.changes.length > 0);
      previousDoc = doc;
      previousIndentSize = indentSize;
    }
    return fixes;
  };
}
