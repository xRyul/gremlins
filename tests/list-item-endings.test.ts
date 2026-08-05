import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectGremlins } from '../src/detect.ts';
import { buildGremlinFixChanges } from '../src/fix.ts';
import { detectListItemEndingGremlins } from '../src/list-item-endings.ts';
import { DEFAULT_SETTINGS } from '../src/settings-model.ts';
import type { GremlinMatch } from '../src/types.ts';

function settings(
  punctuation: typeof DEFAULT_SETTINGS.listItemPunctuationPolicy = 'disabled',
  lineEnding: typeof DEFAULT_SETTINGS.listItemLineEndingPolicy = 'disabled',
) {
  return {
    ...DEFAULT_SETTINGS,
    listItemLineEndingPolicy: lineEnding,
    listItemPunctuationPolicy: punctuation,
  };
}

function applyChanges(
  text: string,
  changes: readonly { from: number; insert: string; to: number }[],
) {
  return [...changes]
    .sort((left, right) => right.from - left.from || right.to - left.to)
    .reduce(
      (result, change) =>
        result.slice(0, change.from) +
        change.insert +
        result.slice(change.to),
      text,
    );
}

function fixDocument(text: string, matches: readonly GremlinMatch[]) {
  const lines = text.split('\n');
  let lineFrom = 0;
  const changes: { from: number; insert: string; to: number }[] = [];

  for (let line = 0; line < lines.length; line += 1) {
    const lineText = lines[line] ?? '';
    changes.push(
      ...buildGremlinFixChanges(
        matches.filter((match) => match.line === line),
        lineText,
        lineFrom,
      ),
    );
    lineFrom += lineText.length + 1;
  }

  return applyChanges(text, changes);
}

function endings(text: string, punctuation: Parameters<typeof settings>[0]) {
  return detectListItemEndingGremlins(text, settings(punctuation)).filter(
    (match) => match.kind === 'list-item-punctuation',
  );
}

describe('list item punctuation', () => {
  it('is disabled by default', () => {
    assert.deepEqual(
      detectListItemEndingGremlins(
        ['- First.', '- Second'].join('\n'),
        DEFAULT_SETTINGS,
      ),
      [],
    );
  });

  it('is included in whole-document detection', () => {
    const matches = detectGremlins(
      ['- First.', '- Second'].join('\n'),
      settings('period'),
    );

    assert.deepEqual(matches.map(({ kind }) => kind), [
      'list-item-punctuation',
    ]);
  });

  it('enforces periods, semicolons, or no terminal punctuation', () => {
    for (const { before, after, policy } of [
      {
        after: ['- First.', '- Second.', '- Third.'].join('\n'),
        before: ['- First', '- Second;', '- Third.'].join('\n'),
        policy: 'period' as const,
      },
      {
        after: ['- First;', '- Second;', '- Third;'].join('\n'),
        before: ['- First.', '- Second', '- Third;'].join('\n'),
        policy: 'semicolon' as const,
      },
      {
        after: ['- First', '- Second', '- Third'].join('\n'),
        before: ['- First.', '- Second;', '- Third'].join('\n'),
        policy: 'none' as const,
      },
    ]) {
      const matches = endings(before, policy);

      assert.equal(fixDocument(before, matches), after);
    }
  });

  it('supports semicolons followed by a period on the final item', () => {
    const before = ['- First.', '- Second', '- Third;'].join('\n');
    const matches = endings(before, 'semicolon-final-period');

    assert.deepEqual(
      matches.map(({ expected, line }) => ({ expected, line })),
      [
        { expected: ';', line: 0 },
        { expected: ';', line: 1 },
        { expected: '.', line: 2 },
      ],
    );
    assert.equal(
      fixDocument(before, matches),
      ['- First;', '- Second;', '- Third.'].join('\n'),
    );
  });

  it('infers the dominant punctuation independently for each list', () => {
    const text = [
      '- First.',
      '- Second',
      '- Third.',
      '',
      '1. First;',
      '2. Second',
      '3. Third;',
    ].join('\n');
    const matches = endings(text, 'consistent');

    assert.deepEqual(
      matches.map(({ expected, line }) => ({ expected, line })),
      [
        { expected: '.', line: 1 },
        { expected: ';', line: 5 },
      ],
    );
  });

  it('recognizes the conventional inferred semicolon/final-period pattern', () => {
    const valid = ['- First;', '- Second;', '- Third.'].join('\n');
    const invalid = ['- First;', '- Second', '- Third.'].join('\n');

    assert.deepEqual(endings(valid, 'consistent'), []);
    assert.deepEqual(
      endings(invalid, 'consistent').map(({ expected, line }) => ({
        expected,
        line,
      })),
      [{ expected: ';', line: 1 }],
    );
  });

  it('uses the first item to break an inference tie', () => {
    const matches = endings(['- First.', '- Second'].join('\n'), 'consistent');

    assert.deepEqual(
      matches.map(({ expected, line }) => ({ expected, line })),
      [{ expected: '.', line: 1 }],
    );
  });

  it('does not flag question or exclamation endings during automatic matching', () => {
    const text = [
      '1. **Report/version history?**',
      '    - "Preserve fixed report snapshots chronologically"',
      '    - Allow previous report versions to be retrieved!',
      '    - Customers may receive access to appropriate historical reports?',
      '2. **Audit trail**',
    ].join('\n');

    assert.deepEqual(endings(text, 'consistent'), []);
  });

  it('preserves meaningful sentence endings for every punctuation policy', () => {
    const text = [
      '- Is this ready?',
      '- This is urgent!',
      '- Is this surprising?!',
      '- "Is this quoted?"',
      '- Waiting...',
      '- Waiting…',
      '- مكتمل؟',
      '- 完了。',
      '- Really\\?',
    ].join('\n');

    for (const policy of [
      'consistent',
      'none',
      'period',
      'semicolon',
      'semicolon-final-period',
    ] as const) {
      assert.deepEqual(endings(text, policy), []);
    }
  });

  it('exempts display-math endings without letting them drive inference', () => {
    const multiline = [
      '- First.',
      '- Formula',
      '  $$',
      '  x = 1',
      '  $$',
      '- Third.',
    ].join('\n');

    assert.deepEqual(endings(multiline, 'consistent'), []);
    assert.deepEqual(endings('- $$', 'period'), []);
    assert.deepEqual(endings('- $$x = 1$$', 'period'), []);
  });

  it('treats nested lists as independent lists', () => {
    const text = [
      '- Parent.',
      '    - Child;',
      '    - Child',
      '- Parent',
    ].join('\n');
    const matches = endings(text, 'consistent');

    assert.deepEqual(
      matches.map(({ expected, line }) => ({ expected, line })),
      [
        { expected: ';', line: 2 },
        { expected: '.', line: 3 },
      ],
    );
  });

  it('allows a colon when a parent item introduces a nested list', () => {
    for (const [policy, punctuation] of [
      ['none', ''],
      ['period', '.'],
      ['consistent', '.'],
    ] as const) {
      const text = [
        '- **Library** - A report can provide:   ^dvu2m0',
        `    - First child${punctuation}`,
        `    - Second child${punctuation}`,
        `- Next parent${punctuation}`,
      ].join('\n');

      assert.deepEqual(endings(text, policy), []);
    }

    const formalList = [
      '- First;',
      '- Parent:   ^parent-id',
      '    - Child.',
    ].join('\n');
    assert.deepEqual(endings(formalList, 'semicolon-final-period'), []);
  });

  it('still enforces punctuation on a colon without a nested list', () => {
    const text = ['- Leaf:', '- Next.'].join('\n');

    assert.deepEqual(endings(text, 'period').map(({ line }) => line), [0]);
  });

  it('checks the final content line of a multiline item', () => {
    const text = [
      '- First line',
      '  continues.',
      '- Second line',
      '  continues',
    ].join('\n');
    const matches = endings(text, 'period');

    assert.deepEqual(
      matches.map(({ line }) => line),
      [3],
    );
    assert.equal(
      fixDocument(text, matches),
      [
        '- First line',
        '  continues.',
        '- Second line',
        '  continues.',
      ].join('\n'),
    );
  });

  it('supports blockquoted lists and ignores fenced code', () => {
    const text = [
      '> - First.',
      '> - Second',
      '',
      '```md',
      '- Example.',
      '- Example',
      '```',
    ].join('\n');
    const matches = endings(text, 'consistent');

    assert.deepEqual(
      matches.map(({ expected, line }) => ({ expected, line })),
      [{ expected: '.', line: 1 }],
    );
  });

  it('places punctuation before an Obsidian block ID', () => {
    const text = ['- First. ^first', '- Second ^second'].join('\n');
    const matches = endings(text, 'period');

    assert.equal(
      fixDocument(text, matches),
      ['- First. ^first', '- Second. ^second'].join('\n'),
    );
  });

  it('understands task items, inline formatting, and link labels', () => {
    const text = [
      '- [ ] **First.**',
      '- [x] [Second.](https://example.com)',
      '- [[Third|Third.]]',
      '- [ ] **Fourth**',
    ].join('\n');
    const matches = endings(text, 'period');

    assert.deepEqual(matches.map(({ line }) => line), [3]);
    assert.equal(
      fixDocument(text, matches),
      [
        '- [ ] **First.**',
        '- [x] [Second.](https://example.com)',
        '- [[Third|Third.]]',
        '- [ ] **Fourth**.',
      ].join('\n'),
    );
  });

  it('does not require a period after a standalone wikilink', () => {
    const text = [
      '- [[2026-07-27 - ENERGISE - 10am - Standup]] - Date when Project was handed to me',
      '- [[2026-07-27 - ENERGISE - 2pm - Sprint 73 start - Sprint Retro]]  ',
    ].join('\n');
    const matches = endings(text, 'period');

    assert.deepEqual(matches.map(({ line }) => line), [0]);
    assert.equal(
      fixDocument(text, matches),
      [
        '- [[2026-07-27 - ENERGISE - 10am - Standup]] - Date when Project was handed to me.',
        '- [[2026-07-27 - ENERGISE - 2pm - Sprint 73 start - Sprint Retro]]  ',
      ].join('\n'),
    );
  });

  it('does not require a period after a standalone single-token all-caps label', () => {
    assert.deepEqual(endings('- [ ] TALESCAPE  ', 'period'), []);
  });

  it('highlights a complete trailing Unicode code point', () => {
    const matches = endings('- 👾', 'period');

    assert.equal(matches[0]?.from, 2);
    assert.equal(matches[0]?.to, 4);
    assert.equal(fixDocument('- 👾', matches), '- 👾.');
  });

  it('ignores frontmatter and parser-rejected list-shaped lines', () => {
    const text = [
      '---',
      'aliases:',
      '  - First.',
      '  - Second',
      '---',
      '- Actual',
    ].join('\n');

    assert.deepEqual(endings(text, 'period').map(({ line }) => line), [5]);
    assert.deepEqual(
      detectListItemEndingGremlins('- Example', settings('period'), {
        resolveLineContext: () => ({
          context: 'literal',
          listDepth: null,
        }),
      }),
      [],
    );
  });

  it('preserves bare wikilink targets when adding punctuation', () => {
    const text = '- [[Note.]]';
    const matches = endings(text, 'semicolon');

    assert.equal(fixDocument(text, matches), '- [[Note.]];');
  });

  it('reads punctuation from links with balanced destination parentheses', () => {
    const text = '- [Label.](https://example.com/Foo_(bar))';

    assert.deepEqual(endings(text, 'period'), []);
    assert.equal(
      fixDocument(text, endings(text, 'semicolon')),
      '- [Label;](https://example.com/Foo_(bar))',
    );
  });

  it('normalizes a complete terminal punctuation run in one fix', () => {
    const text = '- This is done.;';
    const matches = endings(text, 'none');

    assert.equal(matches[0]?.count, 2);
    assert.equal(fixDocument(text, matches), '- This is done');
  });

  it('keeps different Markdown list marker styles independent', () => {
    const text = ['- First.', '* Second'].join('\n');

    assert.deepEqual(endings(text, 'consistent'), []);
    assert.deepEqual(
      detectListItemEndingGremlins(
        text,
        settings('disabled', 'blank-line'),
      ),
      [],
    );
  });

  it('does not use literal list content as a multiline endpoint', () => {
    const fenced = [
      '- First.',
      '  ```js',
      '  const example = true;',
      '  ```',
      '- Second',
    ].join('\n');
    const parsedLiteral = [
      '- First.',
      '  return value;',
      '- Second',
    ].join('\n');

    assert.deepEqual(
      endings(fenced, 'consistent').map(({ expected, line }) => ({
        expected,
        line,
      })),
      [{ expected: '.', line: 4 }],
    );
    assert.deepEqual(
      detectListItemEndingGremlins(
        parsedLiteral,
        settings('consistent'),
        {
          resolveLineContext: (_text, _lineFrom, line) => ({
            context: line === 1 ? 'literal' : 'root-list-item',
            listDepth: 1,
          }),
        },
      )
        .filter((match) => match.kind === 'list-item-punctuation')
        .map(({ expected, line }) => ({ expected, line })),
      [{ expected: '.', line: 2 }],
    );
  });

  it('uses parser depth for root and nested lazy continuations', () => {
    const root = [
      '- First line',
      'lazy ending.',
      '- Second line',
      'lazy ending',
    ].join('\n');
    const nested = [
      '- Parent',
      '    - Child',
      '    child ending.',
      '  parent ending',
      '- Next parent',
    ].join('\n');
    const lineContext = (
      contexts: readonly (
        | 'list-continuation'
        | 'nested-list-item'
        | 'root-list-item'
      )[],
      depths: readonly number[],
    ) =>
      (_text: string, _lineFrom: number, line: number) => ({
        context: contexts[line] ?? 'list-continuation',
        listDepth: depths[line] ?? null,
      });

    const rootMatches = detectListItemEndingGremlins(
      root,
      settings('period'),
      {
        resolveLineContext: lineContext(
          [
            'root-list-item',
            'list-continuation',
            'root-list-item',
            'list-continuation',
          ],
          [1, 1, 1, 1],
        ),
      },
    ).filter((match) => match.kind === 'list-item-punctuation');
    const nestedMatches = detectListItemEndingGremlins(
      nested,
      settings('period'),
      {
        resolveLineContext: lineContext(
          [
            'root-list-item',
            'nested-list-item',
            'list-continuation',
            'list-continuation',
            'root-list-item',
          ],
          [1, 2, 2, 1, 1],
        ),
      },
    ).filter((match) => match.kind === 'list-item-punctuation');

    assert.deepEqual(rootMatches.map(({ line }) => line), [3]);
    assert.deepEqual(nestedMatches.map(({ line }) => line), [3, 4]);
  });

  it('trusts parser depth for lazy continuations in blockquotes', () => {
    const text = [
      '> - First line',
      '  continuation.',
      '> - Second',
    ].join('\n');
    const options = {
      resolveLineContext: (_text: string, _lineFrom: number, line: number) => ({
        context: line === 1
          ? ('list-continuation' as const)
          : ('root-list-item' as const),
        listDepth: 1,
      }),
    };
    const punctuationMatches = detectListItemEndingGremlins(
      text,
      settings('period'),
      options,
    ).filter((match) => match.kind === 'list-item-punctuation');
    const blankLineMatches = detectListItemEndingGremlins(
      text,
      settings('disabled', 'blank-line'),
      options,
    );

    assert.deepEqual(punctuationMatches.map(({ line }) => line), [2]);
    assert.deepEqual(blankLineMatches.map(({ line }) => line), [1]);
    assert.equal(
      fixDocument(text, blankLineMatches),
      [
        '> - First line',
        '  continuation.',
        '>',
        '> - Second',
      ].join('\n'),
    );
  });

  it('treats inline-code list continuations as item endpoints', () => {
    const text = ['- Value', '  `final value`', '- Next.'].join('\n');
    const matches = detectListItemEndingGremlins(
      text,
      settings('period'),
      {
        resolveLineContext: (_text, _lineFrom, line) => ({
          context: line === 1
            ? 'list-continuation'
            : 'root-list-item',
          listDepth: 1,
        }),
      },
    ).filter((match) => match.kind === 'list-item-punctuation');

    assert.deepEqual(matches.map(({ line }) => line), [1]);
    assert.equal(
      fixDocument(text, matches),
      ['- Value', '  `final value`.', '- Next.'].join('\n'),
    );
  });

  it('keeps punctuation inside inline code unchanged', () => {
    const text = '- Run `command.`';

    assert.deepEqual(endings(text, 'none'), []);
    assert.equal(
      fixDocument(text, endings(text, 'period')),
      '- Run `command.`.',
    );
    assert.equal(
      fixDocument(text, endings(text, 'semicolon')),
      '- Run `command.`;',
    );
  });

  it('removes an escape together with replaceable terminal punctuation', () => {
    const text = '- Really\\;';

    assert.equal(fixDocument(text, endings(text, 'none')), '- Really');
    assert.equal(fixDocument(text, endings(text, 'period')), '- Really.');
  });

  it('rejects parser-rejected blockquote prose but tolerates unknown syntax', () => {
    const rejected = detectListItemEndingGremlins(
      '> 2. continuation',
      settings('period'),
      {
        resolveLineContext: () => ({
          context: 'blockquote',
          listDepth: null,
        }),
      },
    );
    const unknown = ['- First.', '- Second', '- Third.'].join('\n');
    const inferred = detectListItemEndingGremlins(
      unknown,
      settings('consistent'),
      {
        resolveLineContext: (_text, _lineFrom, line) => ({
          context: line === 1 ? 'unknown' : 'root-list-item',
          listDepth: line === 1 ? null : 1,
        }),
      },
    ).filter((match) => match.kind === 'list-item-punctuation');

    assert.deepEqual(rejected, []);
    assert.deepEqual(
      inferred.map(({ expected, line }) => ({ expected, line })),
      [{ expected: '.', line: 1 }],
    );
  });

  it('does not attach definitive root-level literal blocks to a list', () => {
    const text = ['- First.', '    code;', '- Second'].join('\n');
    const matches = detectListItemEndingGremlins(
      text,
      settings('consistent'),
      {
        resolveLineContext: (_text, _lineFrom, line) => ({
          context: line === 1 ? 'literal' : 'root-list-item',
          listDepth: line === 1 ? null : 1,
        }),
      },
    );

    assert.deepEqual(matches, []);
  });
});

describe('list item line endings', () => {
  it('removes trailing whitespace when configured', () => {
    const text = ['- First  ', '- Second\t', 'Not a list  '].join('\n');
    const matches = detectListItemEndingGremlins(
      text,
      settings('disabled', 'no-trailing-whitespace'),
    );

    assert.deepEqual(
      matches.map(({ kind, line }) => ({ kind, line })),
      [
        { kind: 'list-item-line-ending', line: 0 },
        { kind: 'list-item-line-ending', line: 1 },
      ],
    );
    assert.equal(
      fixDocument(text, matches),
      ['- First', '- Second', 'Not a list  '].join('\n'),
    );
  });

  it('requires exactly two ordinary trailing spaces for hard breaks', () => {
    const text = ['- None', '- One ', '- Two  ', '- Three   '].join('\n');
    const matches = detectListItemEndingGremlins(
      text,
      settings('disabled', 'two-spaces'),
    );

    assert.deepEqual(
      matches.map(({ line }) => line),
      [0, 1, 3],
    );
    assert.equal(
      fixDocument(text, matches),
      ['- None  ', '- One  ', '- Two  ', '- Three  '].join('\n'),
    );
  });

  it('skips hard breaks before nested lists and after display math', () => {
    const text = [
      '1. **Report/version history**?',
      '    - "Preserve fixed report snapshots chronologically"  ',
      '    - Allow previous report versions to be retrieved!  ',
      '    - Customers may receive access to appropriate historical reports?  ',
      '2. **Audit trail**  ',
      '    - df?  ',
      '    - $$Primarily supports traceability and internal audit$$',
    ].join('\n');

    assert.deepEqual(
      detectListItemEndingGremlins(text, settings('none', 'two-spaces')),
      [],
    );
  });

  it('does not require hard-break spaces after an Obsidian block ID', () => {
    const text = ['- Parent: ^parent-id', '    - Child'].join('\n');
    const matches = detectListItemEndingGremlins(
      text,
      settings('disabled', 'two-spaces'),
    );

    assert.deepEqual(matches.map(({ line }) => line), [1]);
    assert.equal(
      fixDocument(text, matches),
      ['- Parent: ^parent-id', '    - Child  '].join('\n'),
    );
  });

  it('requires a blank line between sibling items but not after the last item', () => {
    const text = ['- First', '- Second', '', '- Third'].join('\n');
    const matches = detectListItemEndingGremlins(
      text,
      settings('disabled', 'blank-line'),
    );

    assert.deepEqual(
      matches.map(({ line }) => line),
      [0],
    );
    assert.equal(
      fixDocument(text, matches),
      ['- First', '', '- Second', '', '- Third'].join('\n'),
    );
  });

  it('places a required parent separator after its nested subtree', () => {
    const text = ['- Parent', '    - Child', '- Next parent'].join('\n');
    const matches = detectListItemEndingGremlins(
      text,
      settings('disabled', 'blank-line'),
    );

    assert.deepEqual(
      matches.map(({ line }) => line),
      [1],
    );
    assert.equal(
      fixDocument(text, matches),
      ['- Parent', '    - Child', '', '- Next parent'].join('\n'),
    );
  });

  it('keeps an inserted blank line inside a blockquote', () => {
    const text = ['> - First', '> - Second'].join('\n');
    const matches = detectListItemEndingGremlins(
      text,
      settings('disabled', 'blank-line'),
    );

    assert.equal(
      fixDocument(text, matches),
      ['> - First', '>', '> - Second'].join('\n'),
    );
  });

  it('normalizes whitespace after an empty task checkbox safely', () => {
    const withSpaces = '- [ ]   ';
    const withoutSpaces = '- [ ]';
    const removalMatches = detectListItemEndingGremlins(
      withSpaces,
      settings('disabled', 'no-trailing-whitespace'),
    );
    const hardBreakMatches = detectListItemEndingGremlins(
      withoutSpaces,
      settings('disabled', 'two-spaces'),
    );

    assert.equal(fixDocument(withSpaces, removalMatches), '- [ ]');
    assert.equal(fixDocument(withoutSpaces, hardBreakMatches), '- [ ]  ');
  });

  it('composes fixes for Unicode trailing spaces', () => {
    for (const whitespace of ['\u00a0', '\u2007', '\u202f']) {
      const text = `- Item${whitespace}`;
      const withoutWhitespace = detectGremlins(
        text,
        settings('period', 'no-trailing-whitespace'),
      );
      const withHardBreak = detectGremlins(
        text,
        settings('period', 'two-spaces'),
      );

      assert.equal(fixDocument(text, withoutWhitespace), '- Item.');
      assert.equal(fixDocument(text, withHardBreak), '- Item.  ');
    }
  });

  it('combines punctuation and hard-break fixes at the same position', () => {
    const text = '- Item';
    const matches = detectListItemEndingGremlins(
      text,
      settings('period', 'two-spaces'),
    );

    assert.deepEqual(
      matches.map(({ kind }) => kind),
      ['list-item-punctuation', 'list-item-line-ending'],
    );
    assert.equal(fixDocument(text, matches), '- Item.  ');
  });
});
