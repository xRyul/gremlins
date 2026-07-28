import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyMarkdownListSyntax } from '../src/markdown-context.ts';

describe('classifyMarkdownListSyntax', () => {
  it('identifies an indented root list item as having no parent item', () => {
    assert.equal(
      classifyMarkdownListSyntax(
        [
          'formatting_formatting-list_formatting-list-ul_list-1',
          'HyperMD-list-line_HyperMD-list-line-1',
          'Document',
        ],
        true,
      ),
      'root-list-item',
    );
  });

  it('identifies a nested list item from its Markdown list level', () => {
    assert.equal(
      classifyMarkdownListSyntax(
        [
          'formatting_formatting-list_formatting-list-ul_list-2',
          'HyperMD-list-line_HyperMD-list-line-2',
          'Document',
        ],
        true,
      ),
      'nested-list-item',
    );
  });

  it('uses absolute list depth when marker styles cycle at level four', () => {
    assert.equal(
      classifyMarkdownListSyntax(
        [
          'formatting_formatting-list_formatting-list-ul_list-1',
          'HyperMD-list-line_HyperMD-list-line-4',
          'Document',
        ],
        true,
      ),
      'nested-list-item',
    );
  });

  it('treats parsed plain text as a possible orphaned marker', () => {
    assert.equal(
      classifyMarkdownListSyntax(['Document'], true),
      'plain-text',
    );
  });

  it('excludes parser-recognized literal content', () => {
    assert.equal(
      classifyMarkdownListSyntax(
        ['hmd-indented-code_inline-code', 'Document'],
        true,
      ),
      'literal',
    );
  });

  it('fails closed while the syntax tree is incomplete', () => {
    assert.equal(
      classifyMarkdownListSyntax(
        [
          'formatting_formatting-list_formatting-list-ul_list-1',
          'HyperMD-list-line_HyperMD-list-line-1',
          'Document',
        ],
        false,
      ),
      'unknown',
    );
  });
});
