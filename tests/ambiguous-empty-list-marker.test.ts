import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectGremlins, detectLineGremlins } from '../src/detect.ts';
import { DEFAULT_SETTINGS } from '../src/settings-model.ts';
import type { MarkdownListContext } from '../src/types.ts';

interface DetectionCase {
  context?: MarkdownListContext;
  indentSize?: number;
  line?: number;
  lineFrom?: number;
  next?: string;
  previous?: string;
  text?: string;
}

const ENABLED_SETTINGS = {
  ...DEFAULT_SETTINGS,
  showAmbiguousEmptyListMarkers: true,
};

function detectCase({
  context = 'list-continuation',
  indentSize = 4,
  line = 1,
  lineFrom = 0,
  next = '    - Following item',
  previous = '2. Parent',
  text = '    -',
}: DetectionCase = {}) {
  return detectLineGremlins(
    text,
    lineFrom,
    line,
    ENABLED_SETTINGS,
    indentSize,
    context,
    previous,
    next,
  );
}

describe('ambiguous empty list markers', () => {
  it('flags the marker between a parent and child item', () => {
    const matches = detectCase({
      lineFrom: 20,
      next: '    - Primarily supports traceability and internal audit.',
      previous: '2. **Audit trail**',
    });

    assert.deepEqual(matches, [
      {
        codePoint: null,
        count: 1,
        from: 24,
        kind: 'ambiguous-empty-list-marker',
        line: 1,
        name: 'ambiguous empty list marker',
        severity: 'warning',
        to: 25,
        zeroWidth: false,
      },
    ]);
  });

  it('flags the marker between same-level root list items', () => {
    const matches = detectCase({
      context: 'plain-text',
      next: '- Following item',
      previous: '- Previous item',
      text: '-',
    });

    assert.equal(matches[0]?.kind, 'ambiguous-empty-list-marker');
  });

  it('accepts valid child indentation based on the parent marker width', () => {
    for (const detectionCase of [
      { next: '   - Child', previous: '1. Parent', text: '   -' },
      {
        next: '        - Child',
        previous: '100. Parent',
        text: '        -',
      },
    ]) {
      assert.equal(
        detectCase(detectionCase)[0]?.kind,
        'ambiguous-empty-list-marker',
      );
    }
  });

  it('uses the parent delimiter width when validating child indentation', () => {
    assert.equal(
      detectCase({
        next: '       - Child',
        previous: '1.    Parent',
        text: '       -',
      })[0]?.kind,
      'ambiguous-empty-list-marker',
    );
    assert.deepEqual(
      detectCase({
        next: '     - Child',
        previous: '1.    Parent',
        text: '     -',
      }),
      [],
    );
  });

  it('measures tabbed parent delimiters from the full parent prefix', () => {
    for (const indentSize of [2, 4, 8]) {
      const indentation = '\t\t';
      assert.equal(
        detectCase({
          indentSize,
          next: `${indentation}- Child`,
          previous: '\t-\tParent',
          text: `${indentation}-`,
        })[0]?.kind,
        'ambiguous-empty-list-marker',
      );
    }
  });

  it('flags the marker inside a blockquote and reports its source position', () => {
    const matches = detectCase({
      context: 'blockquote',
      line: 2,
      lineFrom: 10,
      next: '>     - Child',
      previous: '> 2. Parent',
      text: '>     -',
    });

    assert.equal(matches[0]?.from, 16);
    assert.equal(matches[0]?.to, 17);
  });

  it('does not flag an ordinary Setext heading underline', () => {
    assert.deepEqual(
      detectCase({
        context: 'plain-text',
        next: '- Following item',
        previous: 'Heading',
        text: '-',
      }),
      [],
    );
  });

  it('does not flag list-shaped content in a literal Markdown region', () => {
    assert.deepEqual(
      detectCase({
        context: 'literal',
        previous: '2. **Example**',
      }),
      [],
    );
  });

  it('does not run the syntax-dependent rule without parser context', () => {
    const fencedCode = ['```md', '- Previous', '-', '- Following', '```'];
    const indentedCode = ['    - Previous', '    -', '    - Following'];

    assert.deepEqual(
      detectGremlins(fencedCode.join('\n'), ENABLED_SETTINGS),
      [],
    );
    assert.deepEqual(
      detectGremlins(indentedCode.join('\n'), ENABLED_SETTINGS),
      [],
    );
  });

  it('requires a following dash item at exactly the same indentation', () => {
    assert.deepEqual(detectCase({ next: '        - Deeper item' }), []);
    assert.deepEqual(detectCase({ next: '    * Different marker' }), []);
  });

  it('does not flag a marker that already has a delimiter', () => {
    assert.deepEqual(detectCase({ text: '    - ' }), []);
  });

  it('remains disabled by default', () => {
    const matches = detectLineGremlins(
      '    -',
      0,
      1,
      DEFAULT_SETTINGS,
      4,
      'list-continuation',
      '2. Parent',
      '    - Following item',
    );

    assert.deepEqual(matches, []);
  });
});
