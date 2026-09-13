import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Text } from '@codemirror/state';

import {
  buildCodeBlockFix,
  createCodeBlockScanner,
  findFencedCodeBlocks,
} from '../src/code-blocks.ts';
import { DEFAULT_SETTINGS } from '../src/settings-model.ts';

const document = (text: string) => Text.of(text.split('\n'));

describe('code-block fixes', () => {
  it('fixes one block while preserving fences, adjacent blocks and prose', () => {
    const before = 'prose\u00a0\n```py\n\u00a0 \u00a0 x = 1\n```\n~~~py\n\u00a0y\n~~~';
    const doc = document(before);
    const block = findFencedCodeBlocks(doc)[0];
    assert.ok(block);
    const fix = buildCodeBlockFix(doc, block, DEFAULT_SETTINGS, 4);
    const result = fix.changes.slice().reverse().reduce((text, change) =>
      text.slice(0, change.from) + change.insert + text.slice(change.to), before);
    assert.equal(result, 'prose\u00a0\n```py\n    x = 1\n```\n~~~py\n\u00a0y\n~~~');
    assert.deepEqual(fix.affectedLines, [3]);
  });

  it('does not close a longer fence on shorter fences or a different fence character', () => {
    const doc = document('````md\n```py\n\u00a0x\n```\n~~~\n````');
    const blocks = findFencedCodeBlocks(doc);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.lastContentLine, 5);
  });

  it('skips YAML, indented fences and invalid backtick info strings', () => {
    const doc = document('---\nexample: |\n  ```py\n  \u00a0x\n  ```\n---\n    ```py\n```bad`info\ntext');
    assert.deepEqual(findFencedCodeBlocks(doc), []);
  });

  it('keeps quote blocks within their container, even without a closing fence', () => {
    const doc = document('> ```py\n> \u00a0x\n\noutside\u00a0\n~~~py\n\u00a0y\n~~~');
    const blocks = findFencedCodeBlocks(doc);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0]?.lastContentLine, 2);
    assert.equal(blocks[1]?.openingLine, 5);
  });

  it('supports closed quotes, empty fences, longer closing fences and unfinished final blocks', () => {
    const blocks = findFencedCodeBlocks(document('> ```py\n> \u00a0x\n> ````\n~~~\n~~~\n```py\n\u00a0z'));
    assert.deepEqual(blocks.map((block) => [block.openingLine, block.lastContentLine]), [[1, 2], [4, 4], [6, 7]]);
  });

  it('respects character settings and never applies Markdown list fixes to code', () => {
    const source = '```py\n-  value\n\u00a0“text”\n```';
    const settings = { ...DEFAULT_SETTINGS, showDangerousCharacters: false,
      showMixedIndentation: false, showListMarkerSpacing: true,
      showListIndentation: true, showDuplicateListMarkers: true,
      listItemPunctuationPolicy: 'period' as const };
    const scan = createCodeBlockScanner(settings);
    assert.deepEqual(scan(document(source), 4), []);
    const punctuation = createCodeBlockScanner({ ...settings, showTypographicCharacters: true });
    assert.equal(punctuation(document(source), 4)[0]?.changes.length, 2);
  });

  it('handles Unicode offsets and repeated characters without changing indentation width', () => {
    const source = '```py\n😀\u00a0\u00a0x\n```';
    const fix = createCodeBlockScanner(DEFAULT_SETTINGS)(document(source), 4)[0];
    assert.ok(fix);
    assert.deepEqual(fix.changes, [{ from: 8, to: 10, insert: '  ' }]);
  });

  it('scans all 1500 lines, reuses results for scrolling and refreshes after edits', () => {
    const scan = createCodeBlockScanner(DEFAULT_SETTINGS);
    const doc = document('```py\n' + Array<string>(1500).fill('\u00a0x').join('\n') + '\n```');
    const first = scan(doc, 4);
    assert.equal(first[0]?.affectedLines.length, 1500);
    assert.equal(scan(doc, 4), first);
    assert.deepEqual(scan(document('```py\n    x\n```'), 4), []);
  });

  it('recomputes mixed indentation fixes when the editor tab size changes', () => {
    const scan = createCodeBlockScanner(DEFAULT_SETTINGS);
    const doc = document('```py\n\t  x\n```');
    const four = scan(doc, 4);
    const eight = scan(doc, 8);
    assert.notEqual(four, eight);
    assert.notDeepEqual(four[0]?.changes, eight[0]?.changes);
  });
});
