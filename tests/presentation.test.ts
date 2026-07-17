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

  it('selects the highest severity for a gutter marker', () => {
    assert.equal(highestSeverity(['info', 'error', 'warning']), 'error');
    assert.equal(highestSeverity(['info', 'warning']), 'warning');
    assert.equal(highestSeverity(['info']), 'info');
  });
});
