import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findGremlinAtPosition } from '../src/match-position.ts';
import type { GremlinMatch } from '../src/types.ts';

const first: GremlinMatch = {
  codePoint: 0x00a0,
  count: 1,
  from: 1,
  kind: 'character',
  line: 0,
  name: 'non-breaking space',
  severity: 'error',
  to: 2,
  zeroWidth: false,
};

const zeroWidth: GremlinMatch = {
  ...first,
  codePoint: 0x200b,
  from: 4,
  name: 'zero-width space',
  to: 5,
  zeroWidth: true,
};

const second: GremlinMatch = {
  ...first,
  codePoint: 0x200c,
  from: 2,
  name: 'zero-width non-joiner',
  severity: 'warning',
  to: 3,
};

describe('findGremlinAtPosition', () => {
  it('includes the character on the right side of its opening boundary', () => {
    assert.equal(findGremlinAtPosition([first], 1, 1), first);
    assert.equal(findGremlinAtPosition([first], 1, -1), undefined);
  });

  it('includes a zero-width gremlin from either side of its visual bar', () => {
    assert.equal(findGremlinAtPosition([zeroWidth], 4, -1), zeroWidth);
    assert.equal(findGremlinAtPosition([zeroWidth], 4, 1), zeroWidth);
  });

  it('includes the character on the left side of its closing boundary', () => {
    assert.equal(findGremlinAtPosition([first], 2, -1), first);
    assert.equal(findGremlinAtPosition([first], 2, 1), undefined);
  });

  it('uses the pointer side to distinguish adjacent gremlins', () => {
    assert.equal(findGremlinAtPosition([first, second], 2, -1), first);
    assert.equal(findGremlinAtPosition([first, second], 2, 1), second);
  });
});
