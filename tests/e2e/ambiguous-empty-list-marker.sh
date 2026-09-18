#!/usr/bin/env bash
# Responsibilities: read-only empty-marker detection using Obsidian's real parser.
# Check ranges, warning severity, defaults and tab widths; notes must stay unchanged.
# Fix actions and no-ops belong in fix.sh. Sourced by the shared run.sh.
read -r -d '' ambiguous_cases <<'JS' || true
(() => {
  const test = window.__gremlinsE2E;
  const kind = 'ambiguous-empty-list-marker';
  test.ambiguousCases = [
    {file: 'parent-child.md', flagged: true},
    {file: 'root-siblings.md', flagged: true},
    {file: 'parent-marker-width-3.md', flagged: true},
    {file: 'parent-marker-width-8.md', flagged: true},
    {file: 'parent-delimiter-valid.md', flagged: true},
    {file: 'parent-delimiter-too-shallow.md', flagged: false},
    // Without a root list, Obsidian parses the original tabbed unit-test input as code.
    ...[2, 4, 8].map(tabSize => ({file: 'tabbed-parent.md', flagged: false, tabSize})),
    ...[2, 4, 8].map(tabSize => ({file: 'tabbed-nested-parent.md', flagged: true, tabSize, line: 2})),
    {file: 'blockquote.md', flagged: true},
    {file: 'setext-heading.md', flagged: false},
    {file: 'fenced-parent.md', flagged: false, line: 2},
    {file: 'fenced-siblings.md', flagged: false, line: 2},
    {file: 'indented-code.md', flagged: false},
    {file: 'deeper-following-item.md', flagged: false},
    {file: 'different-following-marker.md', flagged: false},
    {file: 'delimited-marker.md', flagged: false},
    {file: 'parent-child.md', flagged: false, defaults: true},
  ];
  test.assert(test.defaults.showAmbiguousEmptyListMarkers === false, 'Rule must be disabled in application defaults');
  test.assert(test.fixtures['delimited-marker.md'].split('\n')[1] === '    - ', 'Fixture lost its significant trailing space');
  test.assert(test.fixtures['tabbed-parent.md'].startsWith('\t-\tParent\n\t\t-\n'), 'Fixture tabs were reformatted');
  test.runAmbiguousCase = async (index, mode) => {
    const scenario = test.ambiguousCases[index];
    const label = `${mode}: ${scenario.file} (tab width ${scenario.tabSize ?? 4}, ${scenario.defaults ? 'defaults' : 'enabled'})`;
    try {
      const line = scenario.line ?? 1;
      const settings = {enableClickToFix: true};
      if (!scenario.defaults) settings.showAmbiguousEmptyListMarkers = true;
      await test.openFixture(scenario.file, mode, settings, scenario.tabSize ?? 4, line);
      const editor = test.leaf.view.editor;
      const original = test.fixtures[scenario.file];
      const lines = original.split('\n');
      const from = editor.posToOffset({line, ch: lines[line].lastIndexOf('-')});
      await test.waitFor(() => test.highlights(kind).length === Number(scenario.flagged),
        label + ': expected highlight count ' + Number(scenario.flagged));
      const matches = test.highlights(kind);
      if (scenario.flagged) {
        test.assert(matches[0].from === from && matches[0].text === '-' && matches[0].warning,
          'Wrong highlighted range or severity: ' + JSON.stringify(matches));
      }
      test.assert(editor.getValue() === original, 'Empty-marker detection must not edit the note');
      await test.leaf.view.save();
      test.assert(await app.vault.read(test.leaf.view.file) === original, 'Empty-marker detection must not change the saved note');
      return 'PASS: ' + label;
    } catch (error) {
      throw Error(label + ': ' + error.message + '\nActual highlights: ' + JSON.stringify(test.highlights(kind)) +
        '\nActual text: ' + JSON.stringify(test.leaf?.view.editor?.getValue()));
    }
  };
  return test.ambiguousCases.length;
})()
JS
case_count=$(obsidian_eval "$ambiguous_cases")
[[ $case_count =~ ^[1-9][0-9]*$ ]] || fail "Invalid scenario count: $case_count"
for mode in source live; do
  for ((index = 0; index < case_count; index++)); do
    result=$(obsidian_eval "window.__gremlinsE2E.runAmbiguousCase($index, '$mode')")
    [[ $result == 'PASS: '* ]] || fail "Unexpected scenario result: $result"
    printf '%s\n' "$result"
  done
done
printf 'PASS: %s ambiguous-empty-list-marker scenarios in real Obsidian.\n' "$((case_count * 2))"
