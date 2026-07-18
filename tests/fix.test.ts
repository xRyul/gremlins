import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GREMLIN_DEFINITIONS } from '../src/characters.ts';
import {
  buildGremlinFixChanges,
  isGremlinFixable,
} from '../src/fix.ts';
import type { GremlinMatch } from '../src/types.ts';

function characterMatch(
  codePoint: number,
  from: number,
  to: number,
  count = 1,
): GremlinMatch {
  return {
    codePoint,
    count,
    from,
    kind: 'character',
    line: 0,
    name: 'test character',
    severity: 'warning',
    to,
    zeroWidth: false,
  };
}

describe('isGremlinFixable', () => {
  it('provides an automatic fix for every defined gremlin character', () => {
    for (const definition of GREMLIN_DEFINITIONS) {
      assert.equal(
        isGremlinFixable(characterMatch(definition.codePoint, 0, 1)),
        true,
        definition.name,
      );
    }
  });
});

describe('buildGremlinFixChanges', () => {
  it('replaces Unicode spacing characters with ordinary spaces', () => {
    const line = `a\u00a0\u00a0b`;

    assert.deepEqual(
      buildGremlinFixChanges(
        [characterMatch(0x00a0, 11, 13, 2)],
        line,
        10,
      ),
      [{ from: 11, insert: '  ', to: 13 }],
    );
  });

  it('removes unsupported controls and soft hyphens', () => {
    const line = `a\u0003\u00adb`;

    assert.deepEqual(
      buildGremlinFixChanges(
        [characterMatch(0x0003, 1, 2), characterMatch(0x00ad, 2, 3)],
        line,
        0,
      ),
      [
        { from: 1, insert: '', to: 2 },
        { from: 2, insert: '', to: 3 },
      ],
    );
  });

  it('replaces typographic punctuation with ASCII equivalents', () => {
    const line = '“quoted” –';

    assert.deepEqual(
      buildGremlinFixChanges(
        [
          characterMatch(0x201c, 0, 1),
          characterMatch(0x201d, 7, 8),
          characterMatch(0x2013, 9, 10),
        ],
        line,
        0,
      ),
      [
        { from: 0, insert: '"', to: 1 },
        { from: 7, insert: '"', to: 8 },
        { from: 9, insert: '-', to: 10 },
      ],
    );
  });

  it('normalizes Unicode line separators to ordinary newlines', () => {
    const line = `a\u2028b\u2029c`;

    assert.deepEqual(
      buildGremlinFixChanges(
        [characterMatch(0x2028, 1, 2), characterMatch(0x2029, 3, 4)],
        line,
        0,
      ),
      [
        { from: 1, insert: '\n', to: 2 },
        { from: 3, insert: '\n\n', to: 4 },
      ],
    );
  });

  it('converts mixed indentation to spaces without changing its visual width', () => {
    const match: GremlinMatch = {
      codePoint: null,
      count: 3,
      from: 20,
      kind: 'mixed-indentation',
      line: 2,
      name: 'mixed indentation',
      severity: 'warning',
      to: 23,
      zeroWidth: false,
    };

    assert.deepEqual(buildGremlinFixChanges([match], '\t  item', 20), [
      { from: 20, insert: '      ', to: 23 },
    ]);
  });

  it('removes zero-width, joining, and bidi controls', () => {
    const line = `a\u200b\u200c\u202eb`;

    assert.deepEqual(
      buildGremlinFixChanges(
        [
          characterMatch(0x200b, 1, 2),
          characterMatch(0x200c, 2, 3),
          characterMatch(0x202e, 3, 4),
        ],
        line,
        0,
      ),
      [
        { from: 1, insert: '', to: 2 },
        { from: 2, insert: '', to: 3 },
        { from: 3, insert: '', to: 4 },
      ],
    );
  });

  it('skips character matches that have no known safe replacement', () => {
    assert.deepEqual(
      buildGremlinFixChanges(
        [characterMatch(0x1f47e, 0, 2)],
        '👾',
        0,
      ),
      [],
    );
  });
});
