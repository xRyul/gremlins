#!/usr/bin/env bash
# Responsibilities: read-only detection in real Obsidian, in Source and Live Preview.
# Check highlight ranges/grouping, severity, zero-width styling, rule toggles,
# negative cases and inspection notices; editor and saved notes must stay unchanged.
# Never invoke fixes here: command/gutter edits and their outcomes belong in fix.sh.
# Sourced by run.sh, which owns fixture isolation, CLI transport and cleanup.
read -r -d '' detection_cases <<'JS' || true
(() => {
  const test = window.__gremlinsE2E;
  test.assert(test.fixtures['pure-indentation.md'] === '\t\tNested\n    Nested\n', 'Pure-indentation fixture was reformatted');
  test.detectionCases = [
    // Characters: grouping, severity, source ranges, defaults and opt-in punctuation.
    {name: 'consecutive zero-width spaces', file: 'zero-width-spaces.md', kind: 'character',
      marks: [{line: 0, ch: 1, text: '\u200b\u200b', severity: 'error', zeroWidth: true,
        notice: '2 zero-width spaces · Unicode U+200B · Error'}]},
    {name: 'non-breaking space', file: 'non-breaking-space.md', kind: 'character',
      marks: [{line: 0, ch: 1, text: '\u00a0', notice: 'non-breaking space · Unicode U+00A0 · Warning'}]},
    {name: 'typographic punctuation disabled by default', file: 'typographic-punctuation.md', kind: 'character', marks: []},
    {name: 'curly quotes and en/em dashes enabled', file: 'typographic-punctuation.md', kind: 'character',
      settings: {showTypographicCharacters: true}, marks: [
        {line: 0, ch: 0, text: '“', severity: 'info'},
        {line: 0, ch: 7, text: '”', severity: 'info'},
        {line: 0, ch: 9, text: '–', severity: 'info', notice: 'en dash · Unicode U+2013 · Info'},
        {line: 0, ch: 11, text: '—', severity: 'info', notice: 'em dash · Unicode U+2014 · Info'},
      ]},

    // Mixed indentation: preserve pure styles, report multiline positions, respect the toggle.
    {name: 'mixed tabs and spaces', file: 'mixed-indentation.md', kind: 'mixed-indentation',
      marks: [{line: 0, ch: 0, text: '\t ',
        notice: 'Mixed indentation · Leading indentation contains both tabs and spaces · Warning'}]},
    {name: 'pure tabs and spaces', file: 'pure-indentation.md', kind: 'mixed-indentation', marks: []},
    {name: 'multiline source offsets', file: 'multiline-mixed-indentation.md', kind: 'mixed-indentation',
      marks: [{line: 1, ch: 0, text: '\t '}]},
    {name: 'mixed indentation disabled', file: 'multiline-mixed-indentation.md', kind: 'mixed-indentation',
      settings: {showMixedIndentation: false}, line: 1, marks: []},

    // List indentation: real roots are orphaned, while real children use the configured width.
    {name: 'orphaned root markers at space/tab widths', file: 'root-list-indentation.md', kind: 'list-indentation',
      settings: {showListIndentation: true}, marks: [
        {line: 0, ch: 0, text: ' ', notice: 'List indentation · Indented list marker has no parent list item · Warning'},
        {line: 2, ch: 0, text: '  '}, {line: 4, ch: 0, text: '   '},
        {line: 6, ch: 0, text: '    '}, {line: 8, ch: 0, text: '\t'},
      ]},
    {name: 'misaligned deeper children', file: 'deep-list-indentation.md', kind: 'list-indentation',
      settings: {showListIndentation: true}, marks: [
        {line: 2, ch: 0, text: '     ', notice: 'List indentation · 5 leading spaces do not match the configured indent width · Warning'},
        {line: 3, ch: 0, text: '      '}, {line: 4, ch: 0, text: '       '},
      ]},
    {name: 'child alignment at indent width 4', file: 'list-indent-width.md', kind: 'list-indentation',
      settings: {showListIndentation: true}, marks: [{line: 1, ch: 0, text: '  '}, {line: 2, ch: 0, text: '   '}]},
    {name: 'child alignment at indent width 2', file: 'list-indent-width.md', kind: 'list-indentation', tabSize: 2,
      settings: {showListIndentation: true}, marks: [{line: 2, ch: 0, text: '   '}]},
    {name: 'indented prose, quote and non-list code', file: 'indented-non-list.md', kind: 'list-indentation',
      settings: {showListIndentation: true}, marks: []},
    {name: 'orphaned list below prose', file: 'orphaned-list-block.md', kind: 'list-indentation',
      settings: {showListIndentation: true}, marks: [1, 2, 3, 4].map(line => ({line, ch: 0, text: '    '}))},
    {name: 'tab-indented orphaned block', file: 'tabbed-parent.md', kind: 'list-indentation',
      settings: {showListIndentation: true}, marks: [{line: 0, ch: 0, text: '\t'},
        {line: 1, ch: 0, text: '\t\t'}, {line: 2, ch: 0, text: '\t\t'}]},
    {name: 'ordered and unordered markers parsed as code', file: 'list-shaped-code.md', kind: 'list-indentation',
      settings: {showListIndentation: true}, marks: [{line: 0, ch: 0, text: '    '}, {line: 1, ch: 0, text: '    '}]},
    {name: 'aligned child with a real parent', file: 'aligned-list.md', kind: 'list-indentation',
      settings: {showListIndentation: true}, marks: [], line: 1},
    {name: 'fenced literal list content', file: 'fenced-parent.md', kind: 'list-indentation',
      settings: {showListIndentation: true}, marks: [], line: 2},
    {name: 'list indentation disabled by default', file: 'root-list-indentation.md', kind: 'list-indentation', marks: []},

    // Missing markers: pasted task lists, tab widths/marker style, and legitimate continuation text.
    {name: 'missing marker in a pasted task list', file: 'missing-list-marker.md', kind: 'missing-list-marker',
      settings: {showMissingListMarkers: true}, marks: [{line: 2, ch: 0, text: '    ',
        notice: 'Missing list marker · Line appears to be a sibling of the following list item · Warning'}]},
    {name: 'missing marker before a tabbed star item', file: 'tabbed-missing-list-marker.md', kind: 'missing-list-marker',
      settings: {showMissingListMarkers: true}, marks: [{line: 2, ch: 0, text: '\t'}]},
    {name: 'ordinary list continuation', file: 'list-continuation.md', kind: 'missing-list-marker',
      settings: {showMissingListMarkers: true}, marks: [], line: 1},

    // List-ending detection belongs here, not in the tooltip interaction suite.
    ...['list-item-punctuation', 'list-item-line-ending'].flatMap(kind => [
      {name: 'missing ' + kind, file: 'list-endings.md', kind,
        settings: {listItemPunctuationPolicy: 'period', listItemLineEndingPolicy: 'two-spaces'},
        marks: [{line: 1, ch: 7, text: 'd'}]},
      {name: 'semantic endings exempt from ' + kind, file: 'semantic-endings.md', kind,
        settings: {listItemPunctuationPolicy: 'none', listItemLineEndingPolicy: 'two-spaces'}, marks: []},
    ]),
  ];
  test.runDetectionCase = async (index, mode) => {
    const scenario = test.detectionCases[index];
    const label = `${mode}: ${scenario.name} (tab width ${scenario.tabSize ?? 4})`;
    try {
      const line = scenario.line ?? scenario.marks[0]?.line ?? 0;
      await test.openFixture(scenario.file, mode, {enableClickToFix: true, ...scenario.settings}, scenario.tabSize ?? 4, line);
      const editor = test.leaf.view.editor;
      const original = test.fixtures[scenario.file];
      const expected = scenario.marks.map(mark => {
        const from = editor.posToOffset({line: mark.line, ch: mark.ch});
        test.assert(original.slice(from, from + mark.text.length) === mark.text,
          'Fixture bytes changed at ' + JSON.stringify(mark));
        return {from, to: from + mark.text.length, text: mark.text,
          severity: mark.severity ?? 'warning', zeroWidth: mark.zeroWidth ?? false};
      });
      const highlights = () => {
        const ranges = [];
        for (const {from, to, text, severity, zeroWidth} of test.highlights(scenario.kind)) {
          const previous = ranges.at(-1);
          // Obsidian splits whitespace decorations at cm-indent/cm-indent-spacing boundaries.
          // Join only contiguous indentation fragments; character grouping stays a separate assertion.
          if (scenario.kind !== 'character' && previous?.to === from &&
              previous.severity === severity && previous.zeroWidth === zeroWidth) {
            previous.to = to;
            previous.text += text;
          } else ranges.push({from, to, text, severity, zeroWidth});
        }
        return ranges;
      };
      await test.waitFor(() => JSON.stringify(highlights()) === JSON.stringify(expected),
        label + ': expected highlights ' + JSON.stringify(expected));
      test.assert(editor.getValue() === original, 'Detection must not edit the note');
      for (let i = 0; i < scenario.marks.length; i++) {
        const notice = scenario.marks[i].notice;
        if (!notice) continue;
        const existing = new Set(document.querySelectorAll('.notice'));
        editor.setCursor(editor.offsetToPos(expected[i].from));
        test.assert(app.commands.executeCommandById('gremlins:inspect-gremlin-at-cursor'), 'Inspect command is not registered');
        await test.waitFor(() => Array.from(document.querySelectorAll('.notice'))
          .some(element => !existing.has(element) && element.textContent === notice),
          label + ': expected inspection notice ' + notice);
      }
      await test.waitFor(() => editor.getValue() === original && JSON.stringify(highlights()) === JSON.stringify(expected),
        label + ': detection and inspection must leave the document and highlights unchanged');
      await test.leaf.view.save();
      test.assert(await app.vault.read(test.leaf.view.file) === original, 'Detection and inspection must not change the saved note');
      return 'PASS: ' + label;
    } catch (error) {
      throw Error(label + ': ' + error.message + '\nActual highlights: ' + JSON.stringify(test.highlights(scenario.kind)) +
        '\nActual text: ' + JSON.stringify(test.leaf?.view.editor?.getValue()));
    }
  };
  return test.detectionCases.length;
})()
JS
case_count=$(obsidian_eval "$detection_cases")
[[ $case_count =~ ^[1-9][0-9]*$ ]] || fail "Invalid detection scenario count: $case_count"
for mode in source live; do
  for ((index = 0; index < case_count; index++)); do
    result=$(obsidian_eval "window.__gremlinsE2E.runDetectionCase($index, '$mode')")
    [[ $result == 'PASS: '* ]] || fail "Unexpected detection result: $result"
    printf '%s\n' "$result"
  done
done
printf 'PASS: %s detection scenarios in real Obsidian.\n' "$((case_count * 2))"
