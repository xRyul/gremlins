import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const styles = readFileSync(
  new URL('../styles.css', import.meta.url),
  'utf8',
);

describe('editor layout styles', () => {
  it('keeps zero effective width and sits before line numbers', () => {
    const gutterRule = styles.match(
      /\.cm-gutters > \.gremlins-gutter\s*\{([^}]*)\}/s,
    )?.[1] ?? '';

    assert.match(gutterRule, /margin-inline-end:\s*-18px;/);
    assert.match(gutterRule, /min-width:\s*18px;/);
    assert.match(gutterRule, /inset-inline-start:\s*-18px;/);
    assert.match(gutterRule, /order:\s*-1;/);
    assert.match(gutterRule, /position:\s*relative;/);
  });

  it('uses Obsidian folding space when Gremlins is the only gutter', () => {
    assert.match(
      styles,
      /\.markdown-source-view\.mod-cm6\.is-folding\s+\.cm-gutters > \.gremlins-gutter:only-child\s*\{[^}]*inset-inline-start:\s*calc\(\s*-1\s*\*\s*\(var\(--file-folding-offset,\s*24px\)\s*\+\s*8px\)\s*\);/s,
    );
    assert.match(
      styles,
      /\.cm-gutters:has\(> \.gremlins-gutter:only-child\)\s*\{[^}]*margin-inline:\s*0;/s,
    );
  });
});
