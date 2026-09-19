#!/usr/bin/env bash
# Sourced by run.sh. Measure real editor geometry, not declarations in styles.css.
read -r -d '' layout_cases <<'JS' || true
(() => {
  const test = window.__gremlinsE2E;
  test.layoutCases = [
    {name: 'lone gutter without folding', lineNumbers: false, folding: false},
    {name: 'lone gutter with folding', lineNumbers: false, folding: true},
    {name: 'gutter before line numbers', lineNumbers: true, folding: false},
    {name: 'gutter before line numbers with folding', lineNumbers: true, folding: true},
    {name: 'lone gutter with a custom folding offset', lineNumbers: false, folding: true, offset: '40px'},
    {name: 'lone gutter with the folding-offset fallback', lineNumbers: false, folding: true, offset: 'initial'},
  ];
  test.runLayoutCase = async (index, mode, rtl) => {
    const scenario = test.layoutCases[index];
    const label = `${mode}/${rtl ? 'rtl' : 'ltr'}: ${scenario.name}`;
    const options = Object.fromEntries(['showLineNumber', 'foldHeading', 'foldIndent', 'rightToLeft']
      .map(key => [key, app.vault.getConfig(key)]));
    let source;
    let originalStyle;
    let actual;
    try {
      app.vault.setConfig('showLineNumber', scenario.lineNumbers);
      app.vault.setConfig('foldHeading', scenario.folding);
      app.vault.setConfig('foldIndent', scenario.folding);
      app.vault.setConfig('rightToLeft', rtl);
      app.workspace.updateOptions();
      await test.openFixture('editor-layout.md', mode,
        {showTypographicCharacters: true, showGutterIcons: false}, 4, 3);
      const editor = test.leaf.view.editor;
      const cm = editor.cm;
      source = cm.dom.closest('.markdown-source-view');
      originalStyle = source.style.cssText;
      // Scope theme-token changes to the disposable editor; "initial" makes the variable unavailable.
      source.style.setProperty('--file-folding-offset', scenario.offset ?? '24px');
      const bounds = element => element?.getBoundingClientRect().toJSON() ?? null;
      const visibleBounds = selector => Array.from(cm.dom.querySelectorAll(selector))
        .filter(element => getComputedStyle(element).visibility === 'visible' && element.getBoundingClientRect().width > 0)
        .map(bounds);
      const measure = () => ({
        content: bounds(cm.contentDOM),
        lines: Array.from(cm.contentDOM.querySelectorAll('.cm-line')).map(bounds),
        numbers: bounds(cm.dom.querySelector('.cm-lineNumbers')),
        gutters: bounds(cm.dom.querySelector('.cm-gutters')),
        gremlins: bounds(cm.dom.querySelector('.gremlins-gutter')),
        markers: visibleBounds('.gremlins-gutter-marker'),
        // List fold controls can appear on hover; the heading control is always measurable.
        folds: visibleBounds('.HyperMD-header .cm-fold-indicator .collapse-indicator'),
      });
      const settled = async enabled => {
        let previous;
        await test.waitFor(() => {
          actual = measure();
          const next = JSON.stringify(actual);
          const stable = next === previous;
          previous = next;
          return stable && !!actual.gremlins === enabled && actual.markers.length === (enabled ? 3 : 0) &&
            !!actual.numbers === scenario.lineNumbers && actual.lines.length === editor.lineCount() &&
            source.classList.contains('is-folding') === scenario.folding &&
            getComputedStyle(cm.contentDOM).direction === (rtl ? 'rtl' : 'ltr') &&
            test.highlights('character').length === 3;
        }, label + ': stable editor layout with gutter ' + (enabled ? 'on' : 'off'));
        return actual;
      };
      const near = (value, expected, message) => test.assert(Math.abs(value - expected) <= 0.5,
        `${message}: expected ${expected}, got ${value}`);
      const sameBounds = (value, expected, message) => {
        test.assert(!!value === !!expected, message + ': element presence changed');
        if (!expected) return;
        for (const key of ['left', 'top', 'width', 'height']) near(value[key], expected[key], `${message} ${key}`);
      };
      const start = rect => rtl ? -rect.right : rect.left;
      const end = rect => rtl ? -rect.left : rect.right;
      const before = await settled(false);
      test.assert(before.content.width > 0 && before.lines.length === 5, 'Fixture must be fully visible');
      test.assert(before.folds.length === (scenario.folding ? 1 : 0), 'Expected the real heading fold control');
      if (scenario.lineNumbers) {
        near(start(before.content) - end(before.gutters), 24, 'Native line-number folding gap must remain intact');
      }
      if (scenario.offset === 'initial') {
        test.assert(!getComputedStyle(source).getPropertyValue('--file-folding-offset').trim(), 'Folding-offset fallback was not exercised');
      }
      await app.plugins.plugins.gremlins.updateSettings({showGutterIcons: true});
      const after = await settled(true);
      sameBounds(after.content, before.content, 'Enabling Gremlins must not move or resize editor content');
      before.lines.forEach((line, index) => sameBounds(after.lines[index], line, `Line ${index + 1} must not move or resize`));
      near(after.gremlins.width, 18, 'Gremlins gutter column width');
      near(after.gutters.width, before.gutters?.width ?? 0, 'Gremlins must consume zero additional gutter width');
      const offset = scenario.folding && !scenario.lineNumbers
        ? (scenario.offset === '40px' ? 40 : 24) + 8 : 18;
      near(start(after.gremlins), start(after.gutters) - offset, 'Gremlins gutter horizontal offset');
      if (scenario.lineNumbers) {
        sameBounds(after.numbers, before.numbers, 'Line-number column must not move or resize');
        test.assert(end(after.gremlins) <= start(after.numbers) + 0.5, 'Gremlins must sit before, not over, line numbers');
      }
      before.folds.forEach((fold, index) => sameBounds(after.folds[index], fold, 'Fold control must not move or resize'));
      after.markers.forEach((marker, index) => {
        const line = after.lines[[0, 2, 3][index]];
        test.assert(marker.left >= after.gremlins.left - 0.5 && marker.right <= after.gremlins.right + 0.5 &&
          marker.top >= line.top - 0.5 && marker.bottom <= line.bottom + 0.5, 'Marker must fit its gutter and warning line');
        for (const fold of after.folds) {
          test.assert(marker.right <= fold.left || marker.left >= fold.right || marker.bottom <= fold.top || marker.top >= fold.bottom,
            'Gremlin marker must not overlap the native fold control');
        }
      });
      await app.plugins.plugins.gremlins.updateSettings({showGutterIcons: false});
      const disabled = await settled(false);
      for (const key of ['content', 'numbers', 'gutters']) {
        sameBounds(disabled[key], before[key], `Disabling Gremlins must restore ${key}`);
      }
      for (const key of ['lines', 'folds']) {
        test.assert(disabled[key].length === before[key].length, `Disabling Gremlins changed ${key} count`);
        before[key].forEach((rect, index) => sameBounds(disabled[key][index], rect, `Disabling Gremlins must restore ${key}[${index}]`));
      }
      test.assert(editor.getValue() === test.fixtures['editor-layout.md'], 'Layout checks must not edit the note');
      await test.leaf.view.save();
      test.assert(await app.vault.adapter.read(test.leaf.view.file.path) === test.fixtures['editor-layout.md'],
        'Layout checks must not change saved bytes');
      return 'PASS: ' + label;
    } catch (error) {
      throw Error(label + ': ' + error.message + '\nActual layout: ' + JSON.stringify(actual));
    } finally {
      if (source) source.style.cssText = originalStyle;
      for (const [key, value] of Object.entries(options)) app.vault.setConfig(key, value);
      app.workspace.updateOptions();
    }
  };
  return test.layoutCases.length;
})()
JS
case_count=$(obsidian_eval "$layout_cases")
[[ $case_count =~ ^[1-9][0-9]*$ ]] || fail "Invalid layout scenario count: $case_count"
for mode in source live; do
  for rtl in false true; do
    for ((index = 0; index < case_count; index++)); do
      result=$(obsidian_eval "window.__gremlinsE2E.runLayoutCase($index, '$mode', $rtl)")
      [[ $result == 'PASS: '* ]] || fail "Unexpected layout result: $result"
      printf '%s\n' "$result"
    done
  done
done
printf 'PASS: %s editor-layout scenarios in real Obsidian.\n' "$((case_count * 4))"
