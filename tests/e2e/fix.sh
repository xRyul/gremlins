#!/usr/bin/env bash
# Responsibilities: user-requested fixes in real Obsidian, in Source and Live Preview.
# Exercise command and gutter actions; check complete edits, saved contents, preserved
# text/block boundaries, combined fixes, no-ops and remaining warnings. Highlights
# are preconditions here; exact ranges, styling and inspection belong in detect.sh.
# Sourced by run.sh, which owns fixture isolation, CLI transport and cleanup.
read -r -d '' fix_cases <<'JS' || true
(() => {
  const test = window.__gremlinsE2E;
  test.fixCases = [
    {name: 'all deletion-only Unicode controls', file: 'fix-controls.md', steps: [
      {line: 1, marks: {character: '\u0003\u00ad\u180e\u200b\u200c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2060\u2066\u2067\u2068\u2069\ufeff\ufffc'}, fixed: {1: 'ab'}},
    ]},
    {name: 'delete a grouped run of zero-width spaces', file: 'zero-width-spaces.md', steps: [
      {line: 0, marks: {character: '\u200b\u200b'}, fixed: {0: 'ab'}},
    ]},
    {name: 'Unicode spaces including consecutive NBSPs', file: 'fix-spaces.md', steps: [
      {line: 1, marks: {character: '\u00a0\u00a0\u2007\u202f'}, fixed: {1: 'a  b c d'}},
    ]},
    {name: 'line tabulation, line separator and paragraph separator', file: 'fix-separators.md', steps: [
      {line: 1, marks: {character: '\u000b\u2028\u2029'}, fixed: {1: 'a\nb\nc\n\nd'}},
    ]},
    {name: 'all six typographic replacements', file: 'fix-punctuation.md', settings: {showTypographicCharacters: true}, steps: [
      {line: 1, marks: {character: '‘’“”–—'}, fixed: {1: '\'single\' "double" - -'}},
    ]},
    {name: 'unknown astral character has no fix', file: 'fix-unknown-character.md', noFix: true, steps: [
      {line: 1, marks: {character: ''}},
    ]},
    {name: 'tab-indented block retains nested children', file: 'fix-orphaned-tabs.md', settings: {showListIndentation: true}, steps: [
      {line: 1, marks: {'list-indentation': '\t'}, fixed: {1: '- Parent', 2: '\t- Child', 3: '- Sibling'}},
    ]},
    {name: 'tabbed block dedent preserves marker delimiters and empty children', file: 'tabbed-parent.md', settings: {showListIndentation: true}, steps: [
      {line: 0, marks: {'list-indentation': '\t'}, fixed: {0: '-\tParent', 1: '\t-', 2: '\t- Child'}},
    ]},
    {name: 'dedent mixed ordered/unordered markers parsed as code', file: 'list-shaped-code.md', settings: {showListIndentation: true}, steps: [
      {line: 0, marks: {'list-indentation': '    '}, fixed: {0: '1. ordered item', 1: '- unordered item'}},
    ]},
    {name: 'space-indented block fixed from a deeper child', file: 'fix-orphaned-spaces.md', settings: {showListIndentation: true}, steps: [
      {line: 3, marks: {'list-indentation': '        '}, fixed: {1: '- Lack of clarity', 2: '- Requirements confusion',
        3: '    - Functional requirements', 4: '    - Non-functional requirements', 5: '- Over-flexibility'}},
    ]},
    {name: 'block fix retains continuation indentation', file: 'fix-orphaned-continuation.md', settings: {showListIndentation: true}, steps: [
      {line: 1, marks: {'list-indentation': '    '}, fixed: {1: '- Item', 2: '  continuation', 3: '    - Child'}},
    ]},
    {name: 'block fix stops at a blank line', file: 'fix-orphaned-boundaries.md', settings: {showListIndentation: true}, steps: [
      {line: 1, marks: {'list-indentation': '    '}, fixed: {1: '- First block'}},
    ]},
    {name: 'separate ordered and unordered blocks beneath headings', file: 'fix-orphaned-headings.md', settings: {showListIndentation: true}, steps: [
      {line: 2, marks: {'list-indentation': '    '}, fixed: {2: '1. Valid tab indentation',
        3: '2. Mixed tab and space indentation', 4: '3. Valid space indentation'}},
      {line: 8, marks: {'list-indentation': '    '}, fixed: {8: '- Zero-width space between brackets: []',
        9: '- Two zero-width spaces between brackets: []', 10: '- Zero-width non-joiner between brackets: []',
        11: '- Non-breaking space between brackets: [ ]', 12: '- Soft hyphen between brackets: []'}},
    ]},
    {name: 'combine block dedent with a character replacement', file: 'fix-orphaned-character.md',
      settings: {showListIndentation: true, showTypographicCharacters: true}, steps: [
        {line: 1, marks: {'list-indentation': '\t', character: '—'}, fixed: {1: '- Item -', 2: '- Next'}},
      ]},
    // The old unit test invented an ambiguous match on the first line, without a preceding item.
    {name: 'orphaned first-line marker is not an ambiguous marker', file: 'fix-orphaned-empty-root.md',
      settings: {showListIndentation: true, showAmbiguousEmptyListMarkers: true}, steps: [
        {line: 0, marks: {'list-indentation': '    ', 'ambiguous-empty-list-marker': ''}, fixed: {0: '-', 1: '- Following'}},
      ]},
    {name: 'combine orphaned block and contextual empty-marker fixes', file: 'fix-orphaned-empty-siblings.md',
      settings: {showListIndentation: true, showAmbiguousEmptyListMarkers: true}, steps: [
        {line: 1, marks: {'list-indentation': '  ', 'ambiguous-empty-list-marker': '-'}, fixed: {0: '- Previous', 1: '- ', 2: '- Following'}},
      ]},
    {name: 'restore pasted list marker and indentation', file: 'missing-list-marker.md', settings: {showMissingListMarkers: true}, steps: [
      {line: 2, marks: {'missing-list-marker': '    '}, fixed: {2: '            - Confirm the archive structure'}},
    ]},
    {name: 'missing marker copies following star and tabs', file: 'tabbed-missing-list-marker.md', settings: {showMissingListMarkers: true}, steps: [
      {line: 2, marks: {'missing-list-marker': '\t'}, fixed: {2: '\t\t\t* Missing item'}},
    ]},
    {name: 'insert punctuation and a hard break together', file: 'list-endings.md',
      settings: {listItemPunctuationPolicy: 'period', listItemLineEndingPolicy: 'two-spaces'}, steps: [
        {line: 1, marks: {'list-item-punctuation': 'd', 'list-item-line-ending': 'd'}, fixed: {1: '- Second.  '}},
      ]},
    // Empty-marker edits live here; detect.sh only checks detection.
    ...[
      {file: 'parent-child.md', fixed: '    - '},
      {file: 'root-siblings.md', fixed: '- '},
      {file: 'parent-marker-width-3.md', fixed: '   - '},
      {file: 'parent-marker-width-8.md', fixed: '        - '},
      {file: 'parent-delimiter-valid.md', fixed: '       - '},
      {file: 'blockquote.md', fixed: '>     - '},
    ].map(({file, fixed}) => ({
      name: 'insert only the empty-marker delimiter in ' + file, file,
      settings: {showAmbiguousEmptyListMarkers: true},
      steps: [{line: 1, marks: {'ambiguous-empty-list-marker': '-'}, fixed: {1: fixed}}],
    })),
    ...[2, 4, 8].map(tabSize => ({
      name: 'insert only the tabbed empty-marker delimiter', file: 'tabbed-nested-parent.md', tabSize,
      settings: {showAmbiguousEmptyListMarkers: true},
      steps: [{line: 2, marks: {'ambiguous-empty-list-marker': '-'}, fixed: {2: '\t\t- '}}],
    })),
    {name: 'tab-led mixed indentation rounds without changing style', file: 'fix-mixed-tabs.md', steps: [
      {line: 0, marks: {'mixed-indentation': '\t '}, fixed: {0: '\t- Item'}},
      {line: 1, marks: {'mixed-indentation': '\t  '}, fixed: {1: '\t\t- Item'}},
      {line: 2, marks: {'mixed-indentation': '\t   '}, fixed: {2: '\t\t- Item'}},
      {line: 3, marks: {'mixed-indentation': '\t    '}, fixed: {3: '\t\t- Item'}},
    ]},
    {name: 'space-led mixed indentation rounds without changing style', file: 'fix-mixed-spaces.md', steps: [
      {line: 0, marks: {'mixed-indentation': ' \t '}, fixed: {0: '    - Item'}},
      {line: 1, marks: {'mixed-indentation': ' \t  '}, fixed: {1: '        - Item'}},
    ]},
    {name: 'mixed indentation uses the current tab width', file: 'fix-mixed-width.md', tabSize: 2, steps: [
      {line: 1, marks: {'mixed-indentation': ' \t'}, fixed: {1: '  Item'}},
    ]},
    {name: 'two/three-space children round to four spaces', file: 'list-indent-width.md', settings: {showListIndentation: true}, steps: [
      {line: 2, marks: {'list-indentation': '   '}, fixed: {2: '    - three'}},
      {line: 1, marks: {'list-indentation': '  '}, fixed: {1: '    - two'}},
    ]},
    {name: 'five/six/seven-space children round to the nearest level', file: 'deep-list-indentation.md', settings: {showListIndentation: true}, steps: [
      {line: 4, marks: {'list-indentation': '       '}, fixed: {4: '        - seven'}},
      {line: 3, marks: {'list-indentation': '      '}, fixed: {3: '        - six'}},
      {line: 2, marks: {'list-indentation': '     '}, fixed: {2: '    - five'}},
    ]},
    {name: 'list indentation uses the current tab width', file: 'list-indent-width.md', tabSize: 2, settings: {showListIndentation: true}, steps: [
      {line: 2, marks: {'list-indentation': '   '}, fixed: {2: '    - three'}},
    ]},
    {name: 'one-space root dedents to zero', file: 'fix-root-one-space.md', settings: {showListIndentation: true}, steps: [
      {line: 1, marks: {'list-indentation': ' '}, fixed: {1: '- Item'}},
    ]},
    {name: 'dedent independent root markers at different space/tab widths', file: 'root-list-indentation.md', settings: {showListIndentation: true}, steps: [
      {line: 8, marks: {'list-indentation': '\t'}, fixed: {8: '- tab'}},
      {line: 6, marks: {'list-indentation': '    '}, fixed: {6: '- four'}},
      {line: 4, marks: {'list-indentation': '   '}, fixed: {4: '1. three'}},
      {line: 2, marks: {'list-indentation': '  '}, fixed: {2: '* two'}},
      {line: 0, marks: {'list-indentation': ' '}, fixed: {0: '- one'}},
    ]},
    // These no-op actions used to live in detect.sh; read-only detection cannot prove them.
    {name: 'typographic replacements disabled by default', file: 'typographic-punctuation.md', noFix: true, steps: [
      {line: 0, marks: {character: ''}},
    ]},
    {name: 'pure tabs and spaces remain untouched', file: 'pure-indentation.md', noFix: true, steps: [
      {line: 0, marks: {'mixed-indentation': ''}},
    ]},
    {name: 'disabled mixed-indentation rule cannot fix text', file: 'multiline-mixed-indentation.md', noFix: true,
      settings: {showMixedIndentation: false}, steps: [{line: 1, marks: {'mixed-indentation': ''}}]},
    {name: 'indented prose, quote and non-list code remain untouched', file: 'indented-non-list.md', noFix: true,
      settings: {showListIndentation: true}, steps: [{line: 0, marks: {'list-indentation': ''}}]},
    {name: 'aligned child with a real parent remains untouched', file: 'aligned-list.md', noFix: true,
      settings: {showListIndentation: true}, steps: [{line: 1, marks: {'list-indentation': ''}}]},
    {name: 'fenced list content remains untouched', file: 'fenced-parent.md', noFix: true,
      settings: {showListIndentation: true}, steps: [{line: 2, marks: {'list-indentation': ''}}]},
    {name: 'list-indentation fixes disabled by default', file: 'root-list-indentation.md', noFix: true, steps: [
      {line: 0, marks: {'list-indentation': ''}},
    ]},
    {name: 'ordinary list continuation receives no marker', file: 'list-continuation.md', noFix: true,
      settings: {showMissingListMarkers: true}, steps: [{line: 1, marks: {'missing-list-marker': ''}}]},
    ...[
      {file: 'parent-delimiter-too-shallow.md'},
      ...[2, 4, 8].map(tabSize => ({file: 'tabbed-parent.md', tabSize})),
      {file: 'setext-heading.md'},
      {file: 'fenced-parent.md', line: 2},
      {file: 'fenced-siblings.md', line: 2},
      {file: 'indented-code.md'},
      {file: 'deeper-following-item.md'},
      {file: 'different-following-marker.md'},
      {file: 'delimited-marker.md'},
    ].map(({file, line = 1, tabSize = 4}) => ({
      name: 'empty-marker fix leaves ' + file + ' untouched', file, tabSize, noFix: true,
      settings: {showAmbiguousEmptyListMarkers: true},
      steps: [{line, marks: {'ambiguous-empty-list-marker': ''}}],
    })),
    {name: 'empty-marker fixes disabled by default', file: 'parent-child.md', noFix: true, steps: [
      {line: 1, marks: {'ambiguous-empty-list-marker': ''}},
    ]},
    {name: 'fixing disabled leaves the entire orphaned block untouched', file: 'fix-orphaned-tabs.md', noFix: true,
      settings: {showListIndentation: true, enableClickToFix: false}, steps: [
        {line: 1, marks: {'list-indentation': '\t'}},
      ], remaining: {'list-indentation': [1, 2, 3]}},
    ...[
      {policy: 'period', steps: [
        {line: 0, marks: {'list-item-punctuation': 't'}, fixed: {0: '- First.'}},
        {line: 1, marks: {'list-item-punctuation': ';'}, fixed: {1: '- Second.'}},
      ]},
      {policy: 'semicolon', steps: [
        {line: 0, marks: {'list-item-punctuation': 't'}, fixed: {0: '- First;'}},
        {line: 2, marks: {'list-item-punctuation': '.'}, fixed: {2: '- Third;'}},
      ]},
      {policy: 'none', steps: [
        {line: 1, marks: {'list-item-punctuation': ';'}, fixed: {1: '- Second'}},
        {line: 2, marks: {'list-item-punctuation': '.'}, fixed: {2: '- Third'}},
      ]},
    ].map(({policy, steps}) => ({
      name: 'apply explicit punctuation policy: ' + policy, file: 'punctuation-mixed.md',
      settings: {listItemPunctuationPolicy: policy}, steps,
    })),
    {name: 'apply semicolons with a final period', file: 'punctuation-formal.md',
      settings: {listItemPunctuationPolicy: 'semicolon-final-period'}, steps: [
        {line: 0, marks: {'list-item-punctuation': '.'}, fixed: {0: '- First;'}},
        {line: 1, marks: {'list-item-punctuation': 'd'}, fixed: {1: '- Second;'}},
        {line: 2, marks: {'list-item-punctuation': ';'}, fixed: {2: '- Third.'}},
      ]},
    // List-item punctuation edits: full documents and saved bytes, not helper return values.
    ...[
      {name: 'punctuate only the final multiline content', file: 'punctuation-multiline.md', steps: [
        {line: 3, marks: {'list-item-punctuation': 's'}, fixed: {3: '  continues.'}},
      ]},
      {name: 'insert punctuation before an Obsidian block ID', file: 'punctuation-block-ids.md', steps: [
        {line: 1, marks: {'list-item-punctuation': 'd'}, fixed: {1: '- Second. ^second'}},
      ]},
      {name: 'preserve task syntax, formatted text and link labels', file: 'punctuation-formatting.md', steps: [
        {line: 3, ch: 15, marks: {'list-item-punctuation': '*'}, fixed: {3: '- [ ] **Fourth**.'}},
      ]},
      {name: 'punctuate wikilink prose but leave the standalone link intact', file: 'punctuation-wikilinks.md', steps: [
        {line: 0, marks: {'list-item-punctuation': 'e'}, fixed: {0: '- [[Project]] - Date when Project was handed to me.'}},
      ]},
      {name: 'preserve a complete astral code point', file: 'punctuation-astral.md', steps: [
        {line: 0, marks: {'list-item-punctuation': '👾'}, fixed: {0: '- 👾.'}},
      ]},
      {name: 'preserve the bare wikilink target', file: 'punctuation-bare-wikilink.md', policy: 'semicolon', steps: [
        {line: 0, ch: 10, marks: {'list-item-punctuation': ']'}, fixed: {0: '- [[Note.]];'}},
      ]},
      {name: 'change link label without damaging balanced destination parentheses', file: 'punctuation-balanced-link.md', policy: 'semicolon', steps: [
        {line: 0, ch: 8, marks: {'list-item-punctuation': '.'}, fixed: {0: '- [Label;](https://example.com/Foo_(bar))'}},
      ]},
      {name: 'remove a whole terminal punctuation run', file: 'punctuation-run.md', policy: 'none', steps: [
        {line: 0, marks: {'list-item-punctuation': '.;'}, fixed: {0: '- This is done'}},
      ]},
      {name: 'punctuate an inline-code continuation outside the code', file: 'punctuation-code-continuation.md', steps: [
        {line: 1, ch: 14, marks: {'list-item-punctuation': '`'}, fixed: {1: '  `final value`.'}},
      ]},
      ...[{policy: 'period', punctuation: '.'}, {policy: 'semicolon', punctuation: ';'}].map(({policy, punctuation}) => ({
        name: 'append ' + policy + ' without editing inline code', file: 'punctuation-inline-code.md', policy, steps: [
          {line: 0, ch: 15, marks: {'list-item-punctuation': '`'}, fixed: {0: '- Run `command.`' + punctuation}},
        ],
      })),
      {name: 'inline-code punctuation remains untouched under none', file: 'punctuation-inline-code.md', policy: 'none', noFix: true, steps: [
        {line: 0, marks: {'list-item-punctuation': ''}},
      ]},
      ...[{policy: 'none', punctuation: ''}, {policy: 'period', punctuation: '.'}].map(({policy, punctuation}) => ({
        name: 'remove punctuation escape under ' + policy, file: 'punctuation-escaped.md', policy, steps: [
          {line: 0, marks: {'list-item-punctuation': '\\;'}, fixed: {0: '- Really' + punctuation}},
        ],
      })),
      {name: 'punctuate prose after math without changing the formula', file: 'punctuation-math-prose.md', steps: [
        {line: 4, marks: {'list-item-punctuation': 't'}, fixed: {4: '  Result.'}},
      ]},
    ].map(({policy = 'period', ...scenario}) => ({
      ...scenario, settings: {listItemPunctuationPolicy: policy},
    })),
    ...['consistent', 'none', 'period', 'semicolon', 'semicolon-final-period'].map(policy => ({
      name: 'formula is never punctuated under ' + policy, file: 'punctuation-math-only.md', noFix: true,
      settings: {listItemPunctuationPolicy: policy, listItemLineEndingPolicy: 'two-spaces'},
      steps: [0, 1, 2, 3].map(line => ({line, marks: {'list-item-punctuation': '', 'list-item-line-ending': ''}})),
    })),
    ...[
      {name: 'remove trailing list whitespace, not prose whitespace', file: 'line-endings-whitespace.md', policy: 'no-trailing-whitespace', steps: [
        {line: 0, marks: {'list-item-line-ending': '  '}, fixed: {0: '- First'}},
        {line: 1, marks: {'list-item-line-ending': '\t'}, fixed: {1: '- Second'}},
      ]},
      {name: 'normalize every invalid hard break to two spaces', file: 'line-endings-hard-break.md', policy: 'two-spaces', steps: [
        {line: 0, marks: {'list-item-line-ending': 'e'}, fixed: {0: '- None  '}},
        {line: 1, marks: {'list-item-line-ending': ' '}, fixed: {1: '- One  '}},
        {line: 3, marks: {'list-item-line-ending': '   '}, fixed: {3: '- Three  '}},
      ]},
      {name: 'hard-break fix never appends spaces to a block ID', file: 'line-endings-block-ids.md', policy: 'two-spaces', steps: [
        {line: 1, marks: {'list-item-line-ending': 'd'}, fixed: {1: '    - Child  '}},
      ]},
      {name: 'insert only the missing sibling separator', file: 'line-endings-siblings.md', policy: 'blank-line', steps: [
        {line: 0, marks: {'list-item-line-ending': 't'}, fixed: {0: '- First\n'}},
      ]},
      {name: 'insert parent separator after the nested subtree', file: 'line-endings-subtree.md', policy: 'blank-line', steps: [
        {line: 1, marks: {'list-item-line-ending': 'd'}, fixed: {1: '    - Child\n'}},
      ]},
      {name: 'insert a quoted blank separator', file: 'line-endings-quote.md', policy: 'blank-line', steps: [
        {line: 0, marks: {'list-item-line-ending': 't'}, fixed: {0: '> - First\n>'}},
      ]},
      {name: 'separator after lazy quoted text retains the quote prefix', file: 'punctuation-lazy-quote.md', policy: 'blank-line', steps: [
        {line: 1, marks: {'list-item-line-ending': '.'}, fixed: {1: '  continuation.\n>'}},
      ]},
      {name: 'remove whitespace without deleting an empty checkbox', file: 'line-endings-empty-spaces.md', policy: 'no-trailing-whitespace', steps: [
        {line: 0, marks: {'list-item-line-ending': '   '}, fixed: {0: '- [ ]'}},
      ]},
      {name: 'add a hard break after an empty checkbox', file: 'line-endings-empty-task.md', policy: 'two-spaces', steps: [
        {line: 0, ch: 4, marks: {'list-item-line-ending': ']'}, fixed: {0: '- [ ]  '}},
      ]},
    ].map(({policy, ...scenario}) => ({
      ...scenario, settings: {listItemLineEndingPolicy: policy},
    })),
    ...['no-trailing-whitespace', 'two-spaces'].map(policy => ({
      name: 'compose punctuation, Unicode space and ' + policy + ' fixes', file: 'line-endings-unicode.md',
      settings: {listItemPunctuationPolicy: 'period', listItemLineEndingPolicy: policy},
      steps: ['\u00a0', '\u2007', '\u202f'].map((space, line) => ({line,
        marks: {character: space, 'list-item-punctuation': 'm', 'list-item-line-ending': space},
        fixed: {[line]: '- Item.' + (policy === 'two-spaces' ? '  ' : '')},
      })),
    })),
    ...[
      {file: 'punctuation-lazy-code.md', ch: 12, text: '`', fixed: '`final value`.'},
      {file: 'punctuation-lazy-emphasis.md', ch: 14, text: '*', fixed: '**final value**.'},
    ].map(({file, ch, text, fixed}) => ({
      name: 'punctuate the unindented formatted endpoint in ' + file, file,
      settings: {listItemPunctuationPolicy: 'period'},
      steps: [{line: 1, ch, marks: {'list-item-punctuation': text}, fixed: {1: fixed}}],
    })),
  ];
  test.assert(test.fixtures['fix-unknown-character.md'] === 'Before\n👾\nAfter\n', 'Unknown-character fixture changed');
  test.assert(test.defaults.enableClickToFix === false, 'Fixing must remain disabled in application defaults');
  test.runFixCase = async (index, mode, action) => {
    const scenario = test.fixCases[index];
    const label = `${mode}/${action}: ${scenario.name} (tab width ${scenario.tabSize ?? 4})`;
    try {
      await test.openFixture(scenario.file, mode, {enableClickToFix: true, ...scenario.settings},
        scenario.tabSize ?? 4, scenario.steps[0].line);
      const editor = test.leaf.view.editor;
      const original = test.fixtures[scenario.file];
      const expectedLines = original.split('\n');
      const gutterAt = line => {
        const block = editor.cm.lineBlockAt(editor.posToOffset({line, ch: 0}));
        return Array.from(test.leaf.view.contentEl.querySelectorAll('.gremlins-gutter .cm-gutterElement'))
          .find(element => {
            const bounds = element.getBoundingClientRect();
            return bounds.height > 0 && Math.abs(bounds.top - editor.cm.documentTop - block.top) < 2;
          })
          ?.querySelector('.gremlins-gutter-marker');
      };
      test.assert(editor.getValue() === original, 'Highlighting must not automatically change the note');
      for (const step of scenario.steps) {
        // Enter hidden formatting delimiters when a Live Preview scenario needs them.
        editor.setCursor({line: step.line, ch: step.ch ?? editor.getLine(step.line).length});
        for (const [kind, text] of Object.entries(step.marks)) {
          await test.waitFor(() => test.highlights(kind)
            .filter(mark => editor.offsetToPos(mark.from).line === step.line)
            .map(mark => mark.text).join('') === text,
            label + ': expected ' + kind + ' on line ' + step.line + ': ' + JSON.stringify(text));
        }
        await test.waitFor(() => Boolean(gutterAt(step.line)?.classList.contains('gremlins-gutter-marker-interactive')) === !scenario.noFix,
          label + ': expected ' + (scenario.noFix ? 'no interactive' : 'interactive') + ' gutter marker on line ' + step.line);
        if (action === 'gutter') {
          // Negative cases either have no icon, or a passive icon that must not change the note.
          gutterAt(step.line)?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        } else {
          test.assert(app.commands.executeCommandById('gremlins:fix-current-line'), 'Fix command is not registered');
        }
        for (const [line, text] of Object.entries(step.fixed ?? {})) expectedLines[Number(line)] = text;
        const expected = expectedLines.join('\n');
        await test.waitFor(() => editor.getValue() === expected &&
          editor.cm.state.values.find(value => value?.context?.isDone)?.context.isDone(editor.cm.state.doc.length),
          label + ': expected complete document after fixing line ' + step.line + ': ' + JSON.stringify(expected));
        await test.leaf.view.save();
        test.assert(await app.vault.read(test.leaf.view.file) === expected, 'Saved note differs from the expected document');
      }
      for (const kind of new Set(scenario.steps.flatMap(step => Object.keys(step.marks)))) {
        const remaining = scenario.remaining?.[kind] ?? [];
        await test.waitFor(() => JSON.stringify([...new Set(test.highlights(kind)
          .map(mark => editor.offsetToPos(mark.from).line))]) === JSON.stringify(remaining),
          label + ': expected remaining ' + kind + ' warnings on lines ' + JSON.stringify(remaining));
      }
      return 'PASS: ' + label;
    } catch (error) {
      throw Error(label + ': ' + error.message + '\nActual text: ' + JSON.stringify(test.leaf?.view.editor?.getValue()));
    }
  };
  return test.fixCases.length;
})()
JS
case_count=$(obsidian_eval "$fix_cases")
[[ $case_count =~ ^[1-9][0-9]*$ ]] || fail "Invalid fix scenario count: $case_count"
for mode in source live; do
  for action in command gutter; do
    for ((index = 0; index < case_count; index++)); do
      result=$(obsidian_eval "window.__gremlinsE2E.runFixCase($index, '$mode', '$action')")
      [[ $result == 'PASS: '* ]] || fail "Unexpected fix result: $result"
      printf '%s\n' "$result"
    done
  done
done
printf 'PASS: %s fix scenarios in real Obsidian.\n' "$((case_count * 4))"
