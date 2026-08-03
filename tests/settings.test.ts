import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_SETTINGS } from '../src/settings-model.ts';

describe('gremlins settings', () => {
  it('keeps click-to-fix disabled by default', () => {
    assert.equal(DEFAULT_SETTINGS.enableClickToFix, false);
  });

  it('keeps ambiguous-empty-list-marker warnings disabled by default', () => {
    assert.equal(DEFAULT_SETTINGS.showAmbiguousEmptyListMarkers, false);
  });

  it('keeps list-indentation warnings disabled by default', () => {
    assert.equal(DEFAULT_SETTINGS.showListIndentation, false);
  });

  it('keeps missing-list-marker warnings disabled by default', () => {
    assert.equal(DEFAULT_SETTINGS.showMissingListMarkers, false);
  });
});
