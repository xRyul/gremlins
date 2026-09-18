#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$PROJECT_ROOT"
VAULT=${OBSIDIAN_TEST_VAULT_NAME:-plugin-testing-vault}
OBSIDIAN=("${OBSIDIAN_CLI:-obsidian}" "vault=$VAULT")
TEST_FOLDER='_gremlins_e2e'
TEST_PATH=''
saved_state=''
lock_path=''
eval_path_json=''
owns_folder=false
debugger_started=false

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

[[ $# == 0 || ( $# == 1 && $1 == --fail-after-setup ) ]] || fail 'Usage: run.sh [--fail-after-setup]'

obsidian_command() {
  local output
  output=$("${OBSIDIAN[@]}" "$@") || return
  if [[ $output == Error:* ]]; then
    printf 'Obsidian %s failed: %s\n' "$1" "$output" >&2
    return 1
  fi
  printf '%s' "$output"
}

obsidian_eval() {
  local output
  local code="(async () => {
    try {
      const result = await ($1);
      return result === undefined ? 'undefined' : result;
    } catch (error) {
      if (window.__gremlinsE2E) window.__gremlinsE2E.failure = error.stack;
      throw error;
    }
  })()"
  if [[ -n $eval_path_json ]]; then
    # Long code= arguments can break the Windows CLI's IPC header. Send only a file read.
    printf '%s' "$code" >"$lock_path/eval.js"
    code="eval(require('fs').readFileSync($eval_path_json, 'utf8'))"
  fi
  output=$(obsidian_command eval "code=$code") || return
  # The CLI currently exits zero even when evaluated JavaScript throws.
  if [[ $output != '=> '* ]]; then
    printf 'Obsidian eval failed: %s\n' "$output" >&2
    return 1
  fi
  printf '%s' "${output#'=> '}"
}

assert_equal() {
  [[ $1 == "$2" ]] || fail "$3 (expected $1, got $2)"
}

dom_total() {
  local output
  output=$(obsidian_command dev:dom "selector=$1" total)
  if [[ $output == 'No elements found.' ]]; then
    printf '0'
  elif [[ $output =~ ^[0-9]+$ ]]; then
    printf '%s' "$output"
  else
    fail "DOM inspection failed: $output"
  fi
}

open_fixture() {
  TEST_PATH="$TEST_FOLDER/$1"
  obsidian_eval "window.__gremlinsE2E.openFixture('$1', '$2', ${3:-\{\}})" >/dev/null
}

cleanup() {
  local exit_code=$?
  local cleanup_ok=true
  cleanup_failed() {
    printf 'FAIL: %s\n' "$1" >&2
    cleanup_ok=false
    if [[ $exit_code == 0 ]]; then exit_code=1; fi
  }
  trap - EXIT INT TERM
  set +e
  if [[ $exit_code != 0 && $owns_folder == true ]]; then
    mkdir -p test-results
    {
      printf 'Exit status: %s\n' "$exit_code"
      obsidian_eval "JSON.stringify({error: window.__gremlinsE2E?.failure, file: window.__gremlinsE2E?.leaf?.view.file?.path, text: window.__gremlinsE2E?.leaf?.view.editor?.getValue(), tree: window.__gremlinsE2E?.leaf?.view.editor?.cm.state.values.find(value => value?.context?.isDone)?.tree.toString(), html: window.__gremlinsE2E?.leaf?.view.contentEl.innerHTML}, null, 2)"
      printf '\n'
      obsidian_command dev:errors
      printf '\n'
      obsidian_command dev:console level=error
    } >test-results/e2e-failure.txt 2>&1
    printf 'Failure diagnostics: test-results/e2e-failure.txt\n' >&2
  fi
  if [[ $owns_folder == true ]]; then
    obsidian_eval "(async () => {
      for (const leaf of app.workspace.getLeavesOfType('markdown')) {
        if (leaf.view.file?.path.startsWith('$TEST_FOLDER/')) {
          await leaf.view.save();
          leaf.detach();
        }
      }
      const folder = app.vault.getAbstractFileByPath('$TEST_FOLDER');
      if (folder) {
        const entries = await app.vault.adapter.list('$TEST_FOLDER');
        const allowed = new Set(Object.keys($fixtures).map(name => '$TEST_FOLDER/' + name));
        allowed.add('$TEST_FOLDER/.gremlins-e2e-owner');
        if (entries.folders.length || entries.files.some(path => !allowed.has(path))) throw Error('Unexpected files appeared in the fixture folder; refusing deletion');
        await app.vault.delete(folder, true);
      }
      if (await app.vault.adapter.exists('$TEST_FOLDER')) throw Error('Fixture folder survived cleanup');
      delete window.__gremlinsE2E;
      return true;
    })()" >/dev/null || cleanup_failed 'fixture cleanup failed'
  fi
  if [[ -n $saved_state ]]; then
    obsidian_eval "(async () => {
      const saved = $saved_state;
      try {
        if (!app.plugins.plugins.gremlins) throw Error('Gremlins is unavailable after reload');
        await app.plugins.plugins.gremlins.updateSettings(saved.settings);
        if (JSON.stringify(app.plugins.plugins.gremlins.settings) !== JSON.stringify(saved.settings)) throw Error('Settings were not restored');
      } finally {
        // Restore persisted data even if the new plugin failed to load.
        if (saved.data === null) {
          if (await app.vault.adapter.exists(saved.dataPath)) await app.vault.adapter.remove(saved.dataPath);
        } else {
          await app.vault.adapter.write(saved.dataPath, saved.data);
        }
      }
      return true;
    })()" >/dev/null || cleanup_failed 'settings restoration failed; recovery snapshot retained'
    obsidian_eval "(async () => {
      const saved = $saved_state;
      app.vault.setConfig('tabSize', saved.tabSize);
      app.workspace.updateOptions();
      const leaf = app.workspace.getLeafById(saved.leafId);
      if (leaf) app.workspace.setActiveLeaf(leaf, {focus: true});
      return true;
    })()" >/dev/null || cleanup_failed 'editor restoration failed'
  fi
  if [[ $debugger_started == true ]]; then
    obsidian_command dev:debug off >/dev/null || cleanup_failed 'debugger restoration failed'
  fi
  if [[ -n $lock_path ]]; then
    if [[ $cleanup_ok == true ]]; then
      rm -f -- "$lock_path/eval.js" "$lock_path/state.json" && rmdir -- "$lock_path" || cleanup_failed 'lock removal failed'
    else
      printf 'Recovery state and lock retained: %s\n' "$lock_path" >&2
    fi
  fi
  if [[ $exit_code == 0 ]]; then printf 'PASS: live Obsidian E2E suite; fixtures and settings restored.\n'; fi
  exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

vault_json=$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$VAULT")
vault_path=$(obsidian_eval "(() => {
  if (app.vault.getName() !== $vault_json) throw Error('Wrong vault: ' + app.vault.getName());
  if (!app.plugins.plugins.gremlins) throw Error('Enable Gremlins in the testing vault first');
  return app.vault.adapter.basePath;
})()")
# Refuse unknown folders/symlinks, and serialize runs even from different checkouts.
lock_path=$(node --input-type=module - "$vault_path" <<'JS'
import fs from 'node:fs';
import path from 'node:path';
const raw = process.argv[2];
const windows = /^([A-Za-z]):[\\/](.*)$/.exec(raw);
const vault = process.platform !== 'win32' && windows
  ? `/mnt/${windows[1].toLowerCase()}/${windows[2].replace(/\\/g, '/')}` : raw;
const root = path.join(fs.realpathSync(vault), '_gremlins_e2e');
const lock = path.join(fs.realpathSync(vault), '.gremlins-e2e-lock');
fs.mkdirSync(lock); // EEXIST means another runner, or a stale lock after a forced kill.
try {
  const entry = fs.lstatSync(root, {throwIfNoEntry: false});
  if (entry) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw Error('Unsafe fixture directory');
    const allowed = new Set([...fs.readdirSync('tests/e2e/fixtures').filter(name => name.endsWith('.md')), '.gremlins-e2e-owner']);
    for (const name of fs.readdirSync(root)) {
      const entry = fs.lstatSync(path.join(root, name));
      if (!allowed.has(name) || !entry.isFile() || entry.isSymbolicLink()) throw Error(`Refusing to remove unexpected fixture entry: ${name}`);
    }
    if (fs.readFileSync(path.join(root, '.gremlins-e2e-owner'), 'utf8') !== 'gremlins-e2e\n') throw Error('Fixture directory is not test-owned');
  }
  process.stdout.write(lock);
} catch (error) {
  fs.rmdirSync(lock);
  throw error;
}
JS
)
eval_path_json=$(obsidian_eval "JSON.stringify(app.vault.adapter.basePath + '/.gremlins-e2e-lock/eval.js')")
saved_state=$(obsidian_eval "(async () => {
  const plugin = app.plugins.plugins.gremlins;
  if (typeof plugin.manifest.dir !== 'string') throw Error('Cannot locate the plugin data safely');
  const dataPath = plugin.manifest.dir + '/data.json';
  return JSON.stringify({settings: plugin.settings, tabSize: app.vault.getConfig('tabSize'),
    leafId: app.workspace.getMostRecentLeaf()?.id, dataPath,
    data: await app.vault.adapter.exists(dataPath) ? await app.vault.adapter.read(dataPath) : null});
})()")
printf '%s\n' "$saved_state" >"$lock_path/state.json"
fixtures=$(node --input-type=module <<'JS'
import fs from 'node:fs';
const folder = 'tests/e2e/fixtures';
console.log(JSON.stringify(Object.fromEntries(fs.readdirSync(folder)
  .filter(name => name.endsWith('.md'))
  .map(name => [name, fs.readFileSync(`${folder}/${name}`, 'utf8')]))));
JS
)
build_output=$(OBSIDIAN_TEST_VAULT="$vault_path" node esbuild.config.mjs production 2>&1)
[[ $build_output == *'Copied plugin files to '* ]] || fail "Build did not reach the testing vault: $build_output"
debug_status=$(obsidian_command dev:debug on)
if [[ $debug_status != *'already attached'* ]]; then debugger_started=true; fi
obsidian_command dev:errors clear >/dev/null
obsidian_command dev:console clear >/dev/null
# Load genuine application defaults, not an imported detector/settings substitute.
obsidian_eval "app.plugins.plugins.gremlins.saveData({})" >/dev/null
obsidian_command plugin:reload id=gremlins >/dev/null
owns_folder=true
obsidian_eval "(async () => {
  const old = app.vault.getAbstractFileByPath('$TEST_FOLDER');
  if (old) {
    for (const leaf of app.workspace.getLeavesOfType('markdown')) {
      if (leaf.view.file?.path.startsWith('$TEST_FOLDER/')) { await leaf.view.save(); leaf.detach(); }
    }
    await app.vault.delete(old, true);
  }
  await app.vault.createFolder('$TEST_FOLDER');
  await app.vault.adapter.write('$TEST_FOLDER/.gremlins-e2e-owner', 'gremlins-e2e\\n');
  window.__gremlinsE2E = {fixtures: $fixtures, defaults: {...app.plugins.plugins.gremlins.settings}};
  for (const [name, text] of Object.entries(window.__gremlinsE2E.fixtures)) {
    await app.vault.create('$TEST_FOLDER/' + name, text);
  }
  return true;
})()" >/dev/null

read -r -d '' application_helpers <<'JS' || true
(() => {
  const test = window.__gremlinsE2E;
  test.assert = (condition, message) => { if (!condition) throw Error(message); };
  test.waitFor = async (check, message) => {
    let stable = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
      stable = check() ? stable + 1 : 0;
      if (stable === 3) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error('Timed out: ' + message);
  };
  test.openFixture = async (name, mode, settings = {}, tabSize = 4, line = 1) => {
    test.assert(Object.hasOwn(test.fixtures, name), 'Unknown fixture: ' + name);
    test.assert(mode === 'source' || mode === 'live', 'Unknown editor mode');
    if (test.leaf) await test.leaf.view.save();
    await app.plugins.plugins.gremlins.updateSettings({...test.defaults, ...settings});
    app.vault.setConfig('tabSize', tabSize);
    app.workspace.updateOptions();
    const file = app.vault.getAbstractFileByPath('_gremlins_e2e/' + name);
    await app.vault.modify(file, test.fixtures[name]);
    test.leaf ??= app.workspace.getLeaf('tab');
    await test.leaf.openFile(file);
    await test.leaf.setViewState({type: 'markdown', state: {file: file.path, mode: 'source', source: mode === 'source'}});
    app.workspace.setActiveLeaf(test.leaf, {focus: true});
    const editor = test.leaf.view.editor;
    editor.setCursor({line, ch: editor.getLine(line).length});
    editor.scrollIntoView({from: {line: 0, ch: 0}, to: {line: editor.lastLine(), ch: 0}}, true);
    await test.waitFor(() => {
      const cm = editor.cm;
      // Read Obsidian's actual CodeMirror parse state; no fabricated Markdown context.
      const language = cm.state.values.find(value => value?.context?.isDone);
      return cm.inView && editor.getValue() === test.fixtures[name] && cm.state.tabSize === tabSize &&
        language?.context.isDone(cm.state.doc.length) && cm.viewport.to >= cm.state.doc.length;
    }, name + ': editor text, tab width, parser and viewport ready');
    test.assert(test.leaf.view.getState().source === (mode === 'source'), 'Wrong editor mode');
    for (const [key, value] of Object.entries(settings)) {
      test.assert(app.plugins.plugins.gremlins.settings[key] === value, 'Setting not applied: ' + key);
    }
    return true;
  };
  test.highlights = kind => Array.from(test.leaf.view.contentEl.querySelectorAll(`[data-gremlin="${kind}"]`))
    .map(element => ({from: test.leaf.view.editor.cm.posAtDOM(element),
      to: test.leaf.view.editor.cm.posAtDOM(element, element.childNodes.length), text: element.textContent,
      severity: ['error', 'warning', 'info'].find(level => element.classList.contains('gremlins-severity-' + level)),
      zeroWidth: element.classList.contains('gremlins-zero-width'),
      warning: element.classList.contains('gremlins-severity-warning')}));
  return true;
})()
JS
obsidian_eval "$application_helpers" >/dev/null

if [[ ${1:-} == --fail-after-setup ]]; then
  obsidian_eval "(async () => {
    await window.__gremlinsE2E.openFixture('parent-child.md', 'live', {showAmbiguousEmptyListMarkers: true}, 8);
    throw Error('Intentional E2E cleanup check');
  })()" >/dev/null
  fail 'The intentional application error was not detected'
fi

source tests/e2e/fix.sh
source tests/e2e/detect.sh
source tests/e2e/editor-tooltip.sh
source tests/e2e/ambiguous-empty-list-marker.sh
errors=$(obsidian_command dev:errors)
assert_equal 'No errors captured.' "$errors" 'Obsidian captured application errors'
console_errors=$(obsidian_command dev:console level=error)
assert_equal 'No console messages captured.' "$console_errors" 'Obsidian captured console errors'
