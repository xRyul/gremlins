import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const styles = readFileSync(
  new URL('../styles.css', import.meta.url),
  'utf8',
);

describe('editor layout styles', () => {
  it('keeps the gutter visible without shifting content beside line numbers', () => {
    const gutterRule = styles.match(
      /\.cm-gutters > \.gremlins-gutter\s*\{([^}]*)\}/s,
    )?.[1] ?? '';

    assert.match(gutterRule, /margin-inline-end:\s*-18px;/);
    assert.match(gutterRule, /order:\s*1;/);
    assert.match(gutterRule, /position:\s*relative;/);
    assert.match(
      styles,
      /\.gremlins-gutter:only-child\s*\{[^}]*inset-inline-start:\s*-18px;/s,
    );
    assert.match(
      styles,
      /\.cm-gutters:has\(> \.gremlins-gutter:only-child\)\s*\{[^}]*margin-inline:\s*0;/s,
    );
  });
});
