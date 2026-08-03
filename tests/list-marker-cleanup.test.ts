import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectLineGremlins } from '../src/detect.ts';
import {
  buildGremlinFixChanges,
  isGremlinFixable,
} from '../src/fix.ts';
import { DEFAULT_SETTINGS } from '../src/settings-model.ts';

const DUPLICATE_MARKERS_ENABLED = {
  ...DEFAULT_SETTINGS,
  showDuplicateListMarkers: true,
};

const LIST_MARKER_SPACING_ENABLED = {
  ...DEFAULT_SETTINGS,
  showListMarkerSpacing: true,
};

function applyChanges(
  text: string,
  changes: readonly { from: number; insert: string; to: number }[],
) {
  return [...changes]
    .sort((left, right) => right.from - left.from)
    .reduce(
      (result, change) =>
        result.slice(0, change.from) +
        change.insert +
        result.slice(change.to),
      text,
    );
}

describe('duplicate list markers', () => {
  it('flags the redundant first marker in an unordered list item', () => {
    const matches = detectLineGremlins(
      '- - Detect double bullets',
      10,
      2,
      DUPLICATE_MARKERS_ENABLED,
      4,
      'root-list-item',
    );

    assert.deepEqual(matches, [
      {
        codePoint: null,
        count: 1,
        from: 10,
        kind: 'duplicate-list-marker',
        line: 2,
        name: 'duplicate list marker',
        severity: 'warning',
        to: 12,
        zeroWidth: false,
      },
    ]);
  });

  it('supports nested and blockquoted unordered marker styles', () => {
    const matches = detectLineGremlins(
      '>   + * Item',
      20,
      1,
      DUPLICATE_MARKERS_ENABLED,
      4,
      'nested-list-item',
    );

    assert.equal(matches[0]?.kind, 'duplicate-list-marker');
    assert.equal(matches[0]?.from, 24);
    assert.equal(matches[0]?.to, 26);
  });

  it('does not flag list-shaped content in literal Markdown', () => {
    const matches = detectLineGremlins(
      '- - example',
      0,
      0,
      DUPLICATE_MARKERS_ENABLED,
      4,
      'literal',
    );

    assert.deepEqual(matches, []);
  });

  it('does not flag Markdown thematic breaks', () => {
    const settings = {
      ...DUPLICATE_MARKERS_ENABLED,
      showListMarkerSpacing: true,
    };

    for (const { text, context } of [
      { text: '- - -', context: 'root-list-item' as const },
      { text: '> - - -', context: 'blockquote' as const },
      { text: '> *  *  *', context: 'blockquote' as const },
    ]) {
      assert.deepEqual(
        detectLineGremlins(text, 0, 0, settings, 4, context),
        [],
      );
    }
  });

  it('does not rewrite potential Setext heading underlines', () => {
    for (const { text, context } of [
      { text: '-  ', context: 'root-list-item' as const },
      { text: '> -  ', context: 'blockquote' as const },
    ]) {
      assert.deepEqual(
        detectLineGremlins(
          text,
          0,
          1,
          LIST_MARKER_SPACING_ENABLED,
          4,
          context,
        ),
        [],
      );
    }
  });

  it('does not turn an empty retained marker into a Setext underline', () => {
    for (const text of ['- -', '- -  ']) {
      assert.deepEqual(
        detectLineGremlins(
          text,
          0,
          0,
          DUPLICATE_MARKERS_ENABLED,
          4,
          'root-list-item',
        ),
        [],
      );
    }
  });

  it('remains disabled by default', () => {
    const matches = detectLineGremlins(
      '- - Item',
      0,
      0,
      DEFAULT_SETTINGS,
      4,
      'root-list-item',
    );

    assert.deepEqual(matches, []);
  });

  it('removes the redundant first marker and its delimiter', () => {
    const text = '- - Detect double bullets';
    const matches = detectLineGremlins(
      text,
      0,
      0,
      DUPLICATE_MARKERS_ENABLED,
      4,
      'root-list-item',
    );

    assert.equal(matches.every(isGremlinFixable), true);
    assert.equal(
      applyChanges(text, buildGremlinFixChanges(matches, text, 0)),
      '- Detect double bullets',
    );
  });

  it('fixes retained-marker spacing in the same pass', () => {
    const text = '-  -  Item';
    const matches = detectLineGremlins(
      text,
      0,
      0,
      {
        ...DUPLICATE_MARKERS_ENABLED,
        showListMarkerSpacing: true,
      },
      4,
      'root-list-item',
    );

    assert.deepEqual(
      matches.map((match) => match.kind),
      ['duplicate-list-marker', 'list-marker-spacing'],
    );
    assert.equal(
      applyChanges(text, buildGremlinFixChanges(matches, text, 0)),
      '- Item',
    );
  });
});

describe('list marker spacing', () => {
  it('flags extra spaces after unordered and ordered list markers', () => {
    for (const { text, from, to } of [
      { text: '-  Detect space', from: 1, to: 3 },
      { text: '1.  Detect space', from: 2, to: 4 },
      { text: '2)  Detect space', from: 2, to: 4 },
    ]) {
      const matches = detectLineGremlins(
        text,
        0,
        0,
        LIST_MARKER_SPACING_ENABLED,
        4,
        'root-list-item',
      );

      assert.deepEqual(matches, [
        {
          codePoint: null,
          count: 2,
          from,
          kind: 'list-marker-spacing',
          line: 0,
          name: 'list marker spacing',
          severity: 'warning',
          to,
          zeroWidth: false,
        },
      ]);
    }
  });

  it('flags a tab delimiter but allows one ordinary space', () => {
    const tabMatches = detectLineGremlins(
      '-\tItem',
      0,
      0,
      LIST_MARKER_SPACING_ENABLED,
      4,
      'root-list-item',
    );

    assert.equal(tabMatches[0]?.kind, 'list-marker-spacing');
    assert.equal(tabMatches[0]?.count, 1);
    assert.deepEqual(
      detectLineGremlins(
        '- Item',
        0,
        0,
        LIST_MARKER_SPACING_ENABLED,
        4,
        'root-list-item',
      ),
      [],
    );
  });

  it('limits ordered markers to Markdown’s maximum of nine digits', () => {
    const validMatches = detectLineGremlins(
      '123456789.  Item',
      0,
      0,
      LIST_MARKER_SPACING_ENABLED,
      4,
      'root-list-item',
    );
    const invalidMatches = detectLineGremlins(
      '1234567890.  Item',
      0,
      0,
      LIST_MARKER_SPACING_ENABLED,
      4,
      'plain-text',
    );

    assert.equal(validMatches[0]?.kind, 'list-marker-spacing');
    assert.deepEqual(invalidMatches, []);
  });

  it('checks every marker in compact nested list syntax', () => {
    for (const { before, after, context, expectedCount } of [
      {
        before: '- -  Item',
        after: '- - Item',
        context: 'root-list-item' as const,
        expectedCount: 1,
      },
      {
        before: '- 1.  Item',
        after: '- 1. Item',
        context: 'root-list-item' as const,
        expectedCount: 1,
      },
      {
        before: '> - -  Item',
        after: '> - - Item',
        context: 'blockquote' as const,
        expectedCount: 1,
      },
      {
        before: '-  -  Item',
        after: '- - Item',
        context: 'root-list-item' as const,
        expectedCount: 2,
      },
    ]) {
      const matches = detectLineGremlins(
        before,
        0,
        0,
        LIST_MARKER_SPACING_ENABLED,
        4,
        context,
      );

      assert.equal(matches.length, expectedCount);
      assert.equal(
        matches.every((match) => match.kind === 'list-marker-spacing'),
        true,
      );
      assert.equal(
        applyChanges(before, buildGremlinFixChanges(matches, before, 0)),
        after,
      );
    }
  });

  it('does not flag list-shaped content in literal Markdown', () => {
    const matches = detectLineGremlins(
      '1.  example',
      0,
      0,
      LIST_MARKER_SPACING_ENABLED,
      4,
      'literal',
    );

    assert.deepEqual(matches, []);
  });

  it('remains disabled by default', () => {
    const matches = detectLineGremlins(
      '-  Item',
      0,
      0,
      DEFAULT_SETTINGS,
      4,
      'root-list-item',
    );

    assert.deepEqual(matches, []);
  });

  it('normalizes unordered and ordered marker delimiters to one space', () => {
    for (const { before, after } of [
      { before: '-  Detect space', after: '- Detect space' },
      { before: '1.  Detect space', after: '1. Detect space' },
      { before: '2)\tDetect space', after: '2) Detect space' },
    ]) {
      const matches = detectLineGremlins(
        before,
        0,
        0,
        LIST_MARKER_SPACING_ENABLED,
        4,
        'root-list-item',
      );

      assert.equal(matches.every(isGremlinFixable), true);
      assert.equal(
        applyChanges(
          before,
          buildGremlinFixChanges(matches, before, 0),
        ),
        after,
      );
    }
  });
});
