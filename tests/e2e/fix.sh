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
    {name: 'insert only the missing empty-marker delimiter', file: 'parent-child.md', settings: {showAmbiguousEmptyListMarkers: true}, steps: [
      {line: 1, marks: {'ambiguous-empty-list-marker': '-'}, fixed: {1: '    - '}},
    ]},
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
    {name: 'fixing disabled leaves the entire orphaned block untouched', file: 'fix-orphaned-tabs.md', noFix: true,
      settings: {showListIndentation: true, enableClickToFix: false}, steps: [
        {line: 1, marks: {'list-indentation': '\t'}},
      ], remaining: {'list-indentation': [1, 2, 3]}},
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
        editor.setCursor({line: step.line, ch: editor.getLine(step.line).length});
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
