import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectGremlins, detectLineGremlins } from '../src/detect.ts';
import { DEFAULT_SETTINGS } from '../src/settings-model.ts';

describe('detectGremlins', () => {
  it('detects and groups consecutive zero-width spaces', () => {
    const matches = detectGremlins(`a\u200b\u200bb`, DEFAULT_SETTINGS);

    assert.deepEqual(matches, [
      {
        count: 2,
        from: 1,
        kind: 'character',
        line: 0,
        name: 'zero-width space',
        codePoint: 0x200b,
        severity: 'error',
        to: 3,
        zeroWidth: true,
      },
    ]);
  });

  it('detects non-breaking spaces as warnings', () => {
    const matches = detectGremlins(`a\u00a0b`, DEFAULT_SETTINGS);

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.name, 'non-breaking space');
    assert.equal(matches[0]?.severity, 'warning');
    assert.equal(matches[0]?.from, 1);
    assert.equal(matches[0]?.to, 2);
  });

  it('does not flag typographic punctuation by default', () => {
    const matches = detectGremlins('“quoted” – text', DEFAULT_SETTINGS);

    assert.deepEqual(matches, []);
  });

  it('flags typographic punctuation when enabled', () => {
    const matches = detectGremlins('“quoted”', {
      ...DEFAULT_SETTINGS,
      showTypographicCharacters: true,
    });

    assert.deepEqual(
      matches.map(({ codePoint, severity }) => ({ codePoint, severity })),
      [
        { codePoint: 0x201c, severity: 'info' },
        { codePoint: 0x201d, severity: 'info' },
      ],
    );
  });

  it('flags en and em dashes when typographic punctuation is enabled', () => {
    const matches = detectGremlins('– —', {
      ...DEFAULT_SETTINGS,
      showTypographicCharacters: true,
    });

    assert.deepEqual(
      matches.map(({ codePoint, name }) => ({ codePoint, name })),
      [
        { codePoint: 0x2013, name: 'en dash' },
        { codePoint: 0x2014, name: 'em dash' },
      ],
    );
  });

  it('flags mixed tabs and spaces in leading indentation', () => {
    const matches = detectGremlins('\t 8. Item', DEFAULT_SETTINGS);

    assert.deepEqual(matches, [
      {
        count: 2,
        from: 0,
        kind: 'mixed-indentation',
        line: 0,
        name: 'mixed indentation',
        codePoint: null,
        severity: 'warning',
        to: 2,
        zeroWidth: false,
      },
    ]);
  });

  it('allows indentation made entirely from tabs or spaces', () => {
    const matches = detectGremlins('\t\tNested\n    Nested', DEFAULT_SETTINGS);

    assert.deepEqual(matches, []);
  });

  it('reports absolute positions and line numbers', () => {
    const matches = detectGremlins('clean\n\t mixed', DEFAULT_SETTINGS);

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 1);
    assert.equal(matches[0]?.from, 6);
    assert.equal(matches[0]?.to, 8);
  });

  it('can disable mixed-indentation warnings', () => {
    const matches = detectGremlins('\t mixed', {
      ...DEFAULT_SETTINGS,
      showMixedIndentation: false,
    });

    assert.deepEqual(matches, []);
  });

  it('flags list items indented by one, two, or three spaces when enabled', () => {
    const matches = detectGremlins(
      ' - one\n  * two\n   1. three\n    - four\n\t- tab',
      {
        ...DEFAULT_SETTINGS,
        showListIndentation: true,
      },
      4,
    );

    assert.deepEqual(
      matches.map(({ count, kind, line }) => ({ count, kind, line })),
      [
        { count: 1, kind: 'list-indentation', line: 0 },
        { count: 2, kind: 'list-indentation', line: 1 },
        { count: 3, kind: 'list-indentation', line: 2 },
      ],
    );
  });

  it('flags invalid indentation at deeper list levels', () => {
    const matches = detectGremlins(
      '     - five\n      - six\n       - seven\n        - eight',
      {
        ...DEFAULT_SETTINGS,
        showListIndentation: true,
      },
      4,
    );

    assert.deepEqual(
      matches.map(({ count, line }) => ({ count, line })),
      [
        { count: 5, line: 0 },
        { count: 6, line: 1 },
        { count: 7, line: 2 },
      ],
    );
  });

  it('uses the current Obsidian indent width for list indentation', () => {
    const matches = detectGremlins(
      ' - one\n  - two\n   - three\n    - four',
      {
        ...DEFAULT_SETTINGS,
        showListIndentation: true,
      },
      2,
    );

    assert.deepEqual(
      matches.map(({ count, line }) => ({ count, line })),
      [
        { count: 1, line: 0 },
        { count: 3, line: 2 },
      ],
    );
  });

  it('does not treat indented non-list content as malformed list indentation', () => {
    const matches = detectGremlins(
      '  prose\n   ```ts\n  > quote\n    code()',
      {
        ...DEFAULT_SETTINGS,
        showListIndentation: true,
      },
      4,
    );

    assert.deepEqual(matches, []);
  });


  it('flags indented list markers in prose when they have no parent list item', () => {
    const lines = [
      'Common issues:',
      '    - Lack of clarity',
      '    - Requirements confusion',
      '    - Over-flexibility',
      '    - Others',
    ];
    let lineFrom = 0;

    const matches = lines.flatMap((text, line) => {
      const lineMatches = detectLineGremlins(
        text,
        lineFrom,
        line,
        {
          ...DEFAULT_SETTINGS,
          showListIndentation: true,
        },
        4,
        'plain-text',
      );
      lineFrom += text.length + 1;
      return lineMatches;
    });

    assert.deepEqual(
      matches.map((match) => ({
        count: match.count,
        kind: match.kind,
        line: match.line,
        reason:
          match.kind === 'list-indentation' ? match.reason : null,
      })),
      [
        {
          count: 4,
          kind: 'list-indentation',
          line: 1,
          reason: 'orphaned',
        },
        {
          count: 4,
          kind: 'list-indentation',
          line: 2,
          reason: 'orphaned',
        },
        {
          count: 4,
          kind: 'list-indentation',
          line: 3,
          reason: 'orphaned',
        },
        {
          count: 4,
          kind: 'list-indentation',
          line: 4,
          reason: 'orphaned',
        },
      ],
    );
  });

  it('flags tab-indented list markers that have no parent list item', () => {
    const matches = detectLineGremlins(
      '\t- Lack of clarity',
      0,
      0,
      {
        ...DEFAULT_SETTINGS,
        showListIndentation: true,
      },
      4,
      'plain-text',
    );

    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0], {
      codePoint: null,
      count: 1,
      from: 0,
      kind: 'list-indentation',
      line: 0,
      name: 'list indentation',
      reason: 'orphaned',
      severity: 'warning',
      to: 1,
      zeroWidth: false,
    });
  });

  it('flags indentation on a parser-recognized root list item', () => {
    const matches = detectLineGremlins(
      '  - root item',
      0,
      0,
      {
        ...DEFAULT_SETTINGS,
        showListIndentation: true,
      },
      4,
      'root-list-item',
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.kind, 'list-indentation');
    assert.equal(
      matches[0]?.kind === 'list-indentation'
        ? matches[0].reason
        : null,
      'orphaned',
    );
  });

  it('preserves an aligned list item that has a parent item', () => {
    const matches = detectLineGremlins(
      '    - nested item',
      0,
      0,
      {
        ...DEFAULT_SETTINGS,
        showListIndentation: true,
      },
      4,
      'nested-list-item',
    );

    assert.deepEqual(matches, []);
  });

  it('excludes parser-recognized literal content', () => {
    const matches = detectLineGremlins(
      '  - literal code',
      0,
      0,
      {
        ...DEFAULT_SETTINGS,
        showListIndentation: true,
      },
      4,
      'literal',
    );

    assert.deepEqual(matches, []);
  });
  it('keeps list-indentation warnings disabled by default', () => {
    const matches = detectGremlins('  - nested', DEFAULT_SETTINGS, 4);

    assert.deepEqual(matches, []);
  });
});
