#!/usr/bin/env bash
# Sourced by run.sh. Check the settings page rendered by Obsidian.
read -r -d '' settings_tab_check <<'JS' || true
(async () => {
  const test = window.__gremlinsE2E;
  await test.openFixture('zero-width-spaces.md', 'source', {
    showTypographicCharacters: true,
    listItemPunctuationPolicy: 'semicolon',
    listItemLineEndingPolicy: 'blank-line',
    enableClickToFix: true,
  });
  const plugin = app.plugins.plugins.gremlins;
  const before = JSON.stringify(plugin.settings);
  try {
    app.setting.open();
    app.setting.openTabById('gremlins');
    const tab = app.setting.activeTab;
    await test.waitFor(() => tab.containerEl.isConnected, 'Gremlins settings page is open');
    const groups = [];
    for (const row of tab.containerEl.querySelectorAll('.setting-item')) {
      const name = row.querySelector('.setting-item-name').textContent;
      if (row.classList.contains('setting-item-heading')) groups.push([name, []]);
      else {
        test.assert(groups.length > 0, 'Every setting should belong to a section');
        groups.at(-1)[1].push(name);
      }
    }
    const expected = [
      ['Characters', ['Dangerous and invisible characters', 'Typographic punctuation']],
      ['Indentation', ['Mixed indentation', 'List indentation']],
      ['List markers', ['Duplicate list markers', 'List marker spacing', 'Ambiguous empty list markers', 'Missing list markers']],
      ['List style', ['List item punctuation', 'List item line endings']],
      ['Display and fixes', ['Gutter icons', 'Click gutter icons to fix']],
    ];
    test.assert(JSON.stringify(groups) === JSON.stringify(expected), 'Settings are missing, duplicated, or in the wrong section: ' + JSON.stringify(groups));
    test.assert(JSON.stringify(plugin.settings) === before, 'Opening settings must not change saved preferences');

    const control = name => Array.from(tab.containerEl.querySelectorAll('.setting-item'))
      .find(row => row.querySelector('.setting-item-name').textContent === name)
      .querySelector('.checkbox-container, select');
    // Obsidian renders toggle state on the label, not the hidden checkbox input.
    test.assert(control('Typographic punctuation').classList.contains('is-enabled'), 'Character setting did not retain its value');
    test.assert(control('List item punctuation').value === 'semicolon', 'Punctuation policy did not retain its value');
    test.assert(control('List item line endings').value === 'blank-line', 'Line-ending policy did not retain its value');
    control('Gutter icons').click();
    await test.waitFor(() => !plugin.settings.showGutterIcons && control('Click gutter icons to fix').classList.contains('is-disabled'),
      'Hiding gutter icons disables the click-to-fix control');
    test.assert(control('Click gutter icons to fix').classList.contains('is-enabled'), 'Disabling the control must retain the fix preference');
    for (const policy of ['period', 'by-list-type']) {
      const punctuation = control('List item punctuation');
      punctuation.value = policy;
      punctuation.dispatchEvent(new punctuation.ownerDocument.defaultView.Event('change', {bubbles: true}));
      await test.waitFor(() => plugin.settings.listItemPunctuationPolicy === policy && control('List item punctuation').value === policy,
        'Grouped dropdown must retain the selected policy: ' + policy);
      const expectedSettings = {...JSON.parse(before), showGutterIcons: false, listItemPunctuationPolicy: policy};
      test.assert(JSON.stringify(await plugin.loadData()) === JSON.stringify(expectedSettings), 'Controls must persist only their own settings');
    }
    test.assert(test.leaf.view.editor.getValue() === test.fixtures['zero-width-spaces.md'], 'Changing settings must not edit the note');
    await test.leaf.view.save();
    test.assert(await app.vault.read(test.leaf.view.file) === test.fixtures['zero-width-spaces.md'], 'Changing settings must not change the saved note');
    return 'PASS: settings grouped by responsibility; values, persistence and fix dependency preserved.';
  } finally {
    app.setting.close();
  }
})()
JS
result=$(obsidian_eval "$settings_tab_check")
[[ $result == 'PASS: '* ]] || fail "Unexpected settings result: $result"
printf '%s\n' "$result"
