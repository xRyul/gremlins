import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_SETTINGS } from '../src/settings-model.ts';

describe('gremlins settings', () => {
  it('keeps click-to-fix disabled by default', () => {
    assert.equal(DEFAULT_SETTINGS.enableClickToFix, false);
  });
});
