import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  GREMLIN_ICON_ID,
  GREMLIN_ICON_SVG,
} from '../src/gremlin-icon.ts';

describe('Gremlin gutter icon', () => {
  it('uses a lightweight theme-colourable SVG for tiny gutter sizes', () => {
    assert.equal(GREMLIN_ICON_ID, 'gremlins-gutter');
    assert.match(GREMLIN_ICON_SVG, /currentColor/);
    assert.match(
      GREMLIN_ICON_SVG,
      /transform="translate\([^"]+\) scale\(4\.55\)"/u,
    );
    assert.doesNotMatch(
      GREMLIN_ICON_SVG,
      /#(?:[\da-f]{3}){1,2}|gradient|filter/iu,
    );
    assert.ok(
      (GREMLIN_ICON_SVG.match(/<path\b/gu) ?? []).length <= 4,
    );
    assert.ok(Buffer.byteLength(GREMLIN_ICON_SVG, 'utf8') < 1_000);
  });

  it('registers the custom icon and uses it for gutter markers', () => {
    const editorExtension = readFileSync(
      new URL('../src/editor-extension.ts', import.meta.url),
      'utf8',
    );
    const pluginEntryPoint = readFileSync(
      new URL('../src/main.ts', import.meta.url),
      'utf8',
    );

    assert.match(
      pluginEntryPoint,
      /addIcon\(GREMLIN_ICON_ID, GREMLIN_ICON_SVG\)/u,
    );
    assert.match(
      editorExtension,
      /setIcon\(marker, GREMLIN_ICON_ID\)/u,
    );
    assert.doesNotMatch(editorExtension, /setIcon\(marker, 'bug'\)/u);
  });
});
