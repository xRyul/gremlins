import assert from 'node:assert/strict';
import { it } from 'node:test';

import { formatCodePoint } from '../src/presentation.ts';

// No detected character is outside the BMP, so this formatter contract has no live UI path.
it('preserves more than four hexadecimal digits for supplementary code points', () => {
  assert.equal(formatCodePoint(0x1f47e), 'U+1F47E');
});
