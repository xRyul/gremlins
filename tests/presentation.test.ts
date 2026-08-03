import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatCodePoint,
  formatGremlinTooltip,
  highestSeverity,
} from '../src/presentation.ts';
import type { GremlinMatch } from '../src/types.ts';

const zeroWidthMatch: GremlinMatch = {
  codePoint: 0x200b,
  count: 2,
  from: 4,
  kind: 'character',
  line: 0,
  name: 'zero-width space',
  severity: 'error',
  to: 6,
  zeroWidth: true,
};

describe('presentation helpers', () => {
  it('formats Unicode code points with at least four hexadecimal digits', () => {
    assert.equal(formatCodePoint(0x0b), 'U+000B');
    assert.equal(formatCodePoint(0x200b), 'U+200B');
    assert.equal(formatCodePoint(0x1f47e), 'U+1F47E');
  });

  it('describes grouped character matches for hover tooltips', () => {
    assert.equal(
      formatGremlinTooltip(zeroWidthMatch),
      '2 zero-width spaces · Unicode U+200B · Error',
    );
  });

  it('describes mixed indentation without a Unicode code point', () => {
    assert.equal(
      formatGremlinTooltip({
        codePoint: null,
        count: 2,
        from: 0,
        kind: 'mixed-indentation',
        line: 0,
        name: 'mixed indentation',
        severity: 'warning',
        to: 2,
        zeroWidth: false,
      }),
      'Mixed indentation · Leading indentation contains both tabs and spaces · Warning',
    );
  });

  it('describes malformed list indentation without a Unicode code point', () => {
    assert.equal(
      formatGremlinTooltip({
        codePoint: null,
        count: 2,
        from: 0,
        kind: 'list-indentation',
        line: 0,
        name: 'list indentation',
        reason: 'misaligned',
        severity: 'warning',
        to: 2,
        zeroWidth: false,
      }),
      'List indentation · 2 leading spaces do not match the configured indent width · Warning',
    );
  });

  it('describes an indented list marker without a parent item', () => {
    assert.equal(
      formatGremlinTooltip({
        codePoint: null,
        count: 4,
        from: 0,
        kind: 'list-indentation',
        line: 0,
        name: 'list indentation',
        reason: 'orphaned',
        severity: 'warning',
        to: 4,
        zeroWidth: false,
      }),
      'List indentation · Indented list marker has no parent list item · Warning',
    );
  });

  it('describes a line that appears to have lost its list marker', () => {
    assert.equal(
      formatGremlinTooltip({
        codePoint: null,
        count: 4,
        from: 0,
        kind: 'missing-list-marker',
        line: 0,
        marker: '-',
        name: 'missing list marker',
        severity: 'warning',
        targetIndentation: '            ',
        to: 4,
        zeroWidth: false,
      }),
      'Missing list marker · Line appears to be a sibling of the following list item · Warning',
    );
  });

  it('describes an ambiguous empty list marker', () => {
    assert.equal(
      formatGremlinTooltip({
        codePoint: null,
        count: 1,
        from: 4,
        kind: 'ambiguous-empty-list-marker',
        line: 1,
        name: 'ambiguous empty list marker',
        severity: 'warning',
        to: 5,
        zeroWidth: false,
      }),
      'Ambiguous empty list marker · Missing space may cause Obsidian to parse the preceding line as a heading · Warning',
    );
  });

  it('describes a duplicate list marker', () => {
    assert.equal(
      formatGremlinTooltip({
        codePoint: null,
        count: 1,
        from: 0,
        kind: 'duplicate-list-marker',
        line: 0,
        name: 'duplicate list marker',
        severity: 'warning',
        to: 2,
        zeroWidth: false,
      }),
      'Duplicate list marker · Consecutive unordered markers may create an unintended nested list · Warning',
    );
  });

  it('describes malformed list marker spacing', () => {
    assert.equal(
      formatGremlinTooltip({
        codePoint: null,
        count: 2,
        from: 1,
        kind: 'list-marker-spacing',
        line: 0,
        name: 'list marker spacing',
        severity: 'warning',
        to: 3,
        zeroWidth: false,
      }),
      'List marker spacing · Marker is not followed by exactly one ordinary space · Warning',
    );
  });

  it('describes the expected list item punctuation', () => {
    assert.equal(
      formatGremlinTooltip({
        codePoint: null,
        count: 1,
        expected: ';',
        from: 6,
        kind: 'list-item-punctuation',
        line: 0,
        name: 'list item punctuation',
        replacement: ';',
        replacementFrom: 7,
        replacementTo: 7,
        severity: 'warning',
        to: 7,
        zeroWidth: false,
      }),
      'List item punctuation · Expected a semicolon (;) at the end of this item · Warning',
    );
  });

  it('describes the expected list item line ending', () => {
    assert.equal(
      formatGremlinTooltip({
        codePoint: null,
        count: 1,
        expected: 'two-spaces',
        from: 6,
        kind: 'list-item-line-ending',
        line: 0,
        name: 'list item line ending',
        replacement: '  ',
        replacementFrom: 7,
        replacementTo: 7,
        severity: 'warning',
        to: 7,
        zeroWidth: false,
      }),
      'List item line ending · Expected exactly two trailing spaces (Markdown hard break) · Warning',
    );
  });

  it('selects the highest severity for a gutter marker', () => {
    assert.equal(highestSeverity(['info', 'error', 'warning']), 'error');
    assert.equal(highestSeverity(['info', 'warning']), 'warning');
    assert.equal(highestSeverity(['info']), 'info');
  });
});
