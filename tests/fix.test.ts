import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GREMLIN_DEFINITIONS } from '../src/characters.ts';
import {
  buildGremlinFixChanges,
  buildGremlinFixChangesForDocument,
  buildOrphanedListBlockFixChanges,
  isGremlinFixable,
} from '../src/fix.ts';
import type { GremlinMatch } from '../src/types.ts';

function characterMatch(
  codePoint: number,
  from: number,
  to: number,
  count = 1,
): GremlinMatch {
  return {
    codePoint,
    count,
    from,
    kind: 'character',
    line: 0,
    name: 'test character',
    severity: 'warning',
    to,
    zeroWidth: false,
  };
}

function listIndentationMatch(
  count: number,
  reason: 'misaligned' | 'orphaned' = 'misaligned',
): GremlinMatch {
  return {
    codePoint: null,
    count,
    from: 20,
    kind: 'list-indentation',
    line: 2,
    name: 'list indentation',
    reason,
    severity: 'warning',
    to: 20 + count,
    zeroWidth: false,
  };
}

function mixedIndentationMatch(count: number): GremlinMatch {
  return {
    codePoint: null,
    count,
    from: 20,
    kind: 'mixed-indentation',
    line: 2,
    name: 'mixed indentation',
    severity: 'warning',
    to: 20 + count,
    zeroWidth: false,
  };
}

function applyChanges(
  text: string,
  changes: readonly { from: number; insert: string; to: number }[],
) {
  return [...changes]
    .sort((left, right) => right.from - left.from)
    .reduce(
      (result, change) =>
        result.slice(0, change.from) +
        change.insert +
        result.slice(change.to),
      text,
    );
}

describe('isGremlinFixable', () => {
  it('provides an automatic fix for every defined gremlin character', () => {
    for (const definition of GREMLIN_DEFINITIONS) {
      assert.equal(
        isGremlinFixable(characterMatch(definition.codePoint, 0, 1)),
        true,
        definition.name,
      );
    }
  });

  it('provides an automatic fix for malformed list indentation', () => {
    assert.equal(isGremlinFixable(listIndentationMatch(2)), true);
  });

  it('provides a block-aware fix for orphaned list markers', () => {
    assert.equal(
      isGremlinFixable(listIndentationMatch(4, 'orphaned')),
      true,
    );
  });
});

describe('buildOrphanedListBlockFixChanges', () => {
  it('dedents a tab-indented block while preserving nested children', () => {
    const text = [
      'Common issues:',
      '\t- Parent',
      '\t\t- Child',
      '\t- Sibling',
      'After',
    ].join('\n');

    const changes = buildOrphanedListBlockFixChanges(text, 1, 4);

    assert.equal(
      applyChanges(text, changes),
      [
        'Common issues:',
        '- Parent',
        '\t- Child',
        '- Sibling',
        'After',
      ].join('\n'),
    );
  });

  it('removes shared spaces without flattening deeper list items', () => {
    const text = [
      'Common issues:',
      '    - Lack of clarity',
      '    - Requirements confusion',
      '        - Functional requirements',
      '        - Non-functional requirements',
      '    - Over-flexibility',
      'After',
    ].join('\n');

    const changes = buildOrphanedListBlockFixChanges(text, 3, 4);

    assert.equal(
      applyChanges(text, changes),
      [
        'Common issues:',
        '- Lack of clarity',
        '- Requirements confusion',
        '    - Functional requirements',
        '    - Non-functional requirements',
        '- Over-flexibility',
        'After',
      ].join('\n'),
    );
  });

  it('preserves relative indentation on continuation lines', () => {
    const text = [
      'Common issues:',
      '    - Item',
      '      continuation',
      '        - Child',
      'After',
    ].join('\n');

    const changes = buildOrphanedListBlockFixChanges(text, 1, 4);

    assert.equal(
      applyChanges(text, changes),
      [
        'Common issues:',
        '- Item',
        '  continuation',
        '    - Child',
        'After',
      ].join('\n'),
    );
  });

  it('does not cross blank-line block boundaries', () => {
    const text = [
      'Common issues:',
      '    - First block',
      '',
      '    - Second block',
    ].join('\n');

    const changes = buildOrphanedListBlockFixChanges(text, 1, 4);

    assert.equal(
      applyChanges(text, changes),
      [
        'Common issues:',
        '- First block',
        '',
        '    - Second block',
      ].join('\n'),
    );
  });

  it('dedents separate ordered and unordered blocks beneath headings', () => {
    const text = [
      '## Mixed indentation',
      '',
      '    1. Valid tab indentation',
      '    2. Mixed tab and space indentation',
      '    3. Valid space indentation',
      '',
      '## Invisible Unicode',
      '',
      '    - Zero-width space between brackets: []',
      '    - Two zero-width spaces between brackets: []',
      '    - Zero-width non-joiner between brackets: []',
      '    - Non-breaking space between brackets: [ ]',
      '    - Soft hyphen between brackets: []',
    ].join('\n');
    const changes = [
      ...buildOrphanedListBlockFixChanges(text, 2, 4),
      ...buildOrphanedListBlockFixChanges(text, 8, 4),
    ];

    assert.equal(
      applyChanges(text, changes),
      [
        '## Mixed indentation',
        '',
        '1. Valid tab indentation',
        '2. Mixed tab and space indentation',
        '3. Valid space indentation',
        '',
        '## Invisible Unicode',
        '',
        '- Zero-width space between brackets: []',
        '- Two zero-width spaces between brackets: []',
        '- Zero-width non-joiner between brackets: []',
        '- Non-breaking space between brackets: [ ]',
        '- Soft hyphen between brackets: []',
      ].join('\n'),
    );
  });
});

describe('buildGremlinFixChangesForDocument', () => {
  it('combines an orphaned block fix with character fixes on the line', () => {
    const text = [
      'Common issues:',
      '\t- Item —',
      '\t- Next',
    ].join('\n');
    const lineText = '\t- Item —';
    const lineFrom = text.indexOf(lineText);
    const dashFrom = text.indexOf('—');
    const orphanedListMatch: GremlinMatch = {
      codePoint: null,
      count: 1,
      from: lineFrom,
      kind: 'list-indentation',
      line: 1,
      name: 'list indentation',
      reason: 'orphaned',
      severity: 'warning',
      to: lineFrom + 1,
      zeroWidth: false,
    };

    const changes = buildGremlinFixChangesForDocument(
      [
        orphanedListMatch,
        characterMatch(0x2014, dashFrom, dashFrom + 1),
      ],
      text,
      lineText,
      lineFrom,
      1,
      4,
    );

    assert.equal(
      applyChanges(text, changes),
      ['Common issues:', '- Item -', '- Next'].join('\n'),
    );
  });
});

describe('buildGremlinFixChanges', () => {
  it('replaces Unicode spacing characters with ordinary spaces', () => {
    const line = `a\u00a0\u00a0b`;

    assert.deepEqual(
      buildGremlinFixChanges(
        [characterMatch(0x00a0, 11, 13, 2)],
        line,
        10,
      ),
      [{ from: 11, insert: '  ', to: 13 }],
    );
  });

  it('removes unsupported controls and soft hyphens', () => {
    const line = `a\u0003\u00adb`;

    assert.deepEqual(
      buildGremlinFixChanges(
        [characterMatch(0x0003, 1, 2), characterMatch(0x00ad, 2, 3)],
        line,
        0,
      ),
      [
        { from: 1, insert: '', to: 2 },
        { from: 2, insert: '', to: 3 },
      ],
    );
  });

  it('replaces typographic punctuation with ASCII equivalents', () => {
    const line = '“quoted” – —';

    assert.deepEqual(
      buildGremlinFixChanges(
        [
          characterMatch(0x201c, 0, 1),
          characterMatch(0x201d, 7, 8),
          characterMatch(0x2013, 9, 10),
          characterMatch(0x2014, 11, 12),
        ],
        line,
        0,
      ),
      [
        { from: 0, insert: '"', to: 1 },
        { from: 7, insert: '"', to: 8 },
        { from: 9, insert: '-', to: 10 },
        { from: 11, insert: '-', to: 12 },
      ],
    );
  });

  it('normalizes Unicode line separators to ordinary newlines', () => {
    const line = `a\u2028b\u2029c`;

    assert.deepEqual(
      buildGremlinFixChanges(
        [characterMatch(0x2028, 1, 2), characterMatch(0x2029, 3, 4)],
        line,
        0,
      ),
      [
        { from: 1, insert: '\n', to: 2 },
        { from: 3, insert: '\n\n', to: 4 },
      ],
    );
  });

  it('rounds tab-led mixed indentation while preserving tabs', () => {
    const cases = [
      { indentation: '\t ', normalized: '\t' },
      { indentation: '\t  ', normalized: '\t\t' },
      { indentation: '\t   ', normalized: '\t\t' },
      { indentation: '\t    ', normalized: '\t\t' },
    ];

    for (const { indentation, normalized } of cases) {
      const match = mixedIndentationMatch(indentation.length);

      assert.deepEqual(
        buildGremlinFixChanges(
          [match],
          `${indentation}- Item`,
          20,
          4,
        ),
        [{ from: 20, insert: normalized, to: 20 + indentation.length }],
      );
    }
  });

  it('rounds space-led mixed indentation while preserving spaces', () => {
    const cases = [
      { indentation: ' \t ', normalized: '    ' },
      { indentation: ' \t  ', normalized: '        ' },
    ];

    for (const { indentation, normalized } of cases) {
      const match = mixedIndentationMatch(indentation.length);

      assert.deepEqual(
        buildGremlinFixChanges(
          [match],
          `${indentation}- Item`,
          20,
          4,
        ),
        [{ from: 20, insert: normalized, to: 20 + indentation.length }],
      );
    }
  });

  it('rounds list indentation to the nearest four-space level', () => {
    const cases = [
      { indentation: ' ', normalized: '' },
      { indentation: '  ', normalized: '    ' },
      { indentation: '   ', normalized: '    ' },
      { indentation: '     ', normalized: '    ' },
      { indentation: '      ', normalized: '        ' },
      { indentation: '       ', normalized: '        ' },
    ];

    for (const { indentation, normalized } of cases) {
      const match = listIndentationMatch(indentation.length);

      assert.deepEqual(
        buildGremlinFixChanges(
          [match],
          `${indentation}- Item`,
          20,
          4,
        ),
        [{ from: 20, insert: normalized, to: 20 + indentation.length }],
      );
    }
  });

  it('does not automatically change orphaned list indentation', () => {
    const match = listIndentationMatch(4, 'orphaned');

    assert.deepEqual(
      buildGremlinFixChanges([match], '    - Item', 20, 4),
      [],
    );
  });

  it('uses the current indent width while preserving space indentation', () => {
    const match = listIndentationMatch(3);

    assert.deepEqual(
      buildGremlinFixChanges([match], '   - Item', 20, 2),
      [{ from: 20, insert: '    ', to: 23 }],
    );
  });

  it('uses the current indent width when measuring mixed indentation', () => {
    const match: GremlinMatch = {
      codePoint: null,
      count: 2,
      from: 20,
      kind: 'mixed-indentation',
      line: 2,
      name: 'mixed indentation',
      severity: 'warning',
      to: 22,
      zeroWidth: false,
    };

    assert.deepEqual(
      buildGremlinFixChanges([match], ' \tItem', 20, 2),
      [{ from: 20, insert: '  ', to: 22 }],
    );
  });

  it('removes zero-width, joining, and bidi controls', () => {
    const line = `a\u200b\u200c\u202eb`;

    assert.deepEqual(
      buildGremlinFixChanges(
        [
          characterMatch(0x200b, 1, 2),
          characterMatch(0x200c, 2, 3),
          characterMatch(0x202e, 3, 4),
        ],
        line,
        0,
      ),
      [
        { from: 1, insert: '', to: 2 },
        { from: 2, insert: '', to: 3 },
        { from: 3, insert: '', to: 4 },
      ],
    );
  });

  it('skips character matches that have no known safe replacement', () => {
    assert.deepEqual(
      buildGremlinFixChanges(
        [characterMatch(0x1f47e, 0, 2)],
        '👾',
        0,
      ),
      [],
    );
  });
});
