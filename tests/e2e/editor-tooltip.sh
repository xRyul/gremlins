#!/usr/bin/env bash
set -euo pipefail

# Runs against a live vault through the official Obsidian CLI.
PROJECT_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$PROJECT_ROOT"
VAULT=${OBSIDIAN_TEST_VAULT_NAME:-plugin-testing-vault}
TEST_PATH="_gremlins-tooltip-e2e-$$.md"
OBSIDIAN_CLI=${OBSIDIAN_CLI:-obsidian}
OBSIDIAN=("$OBSIDIAN_CLI" "vault=$VAULT")
previous_path=''
original_settings=''
debugger_started=false

obsidian_eval() {
  local output
  output=$("${OBSIDIAN[@]}" eval "code=$1")
  printf '%s' "${output#'=> '}"
}

dom_total() {
  local output
  output=$("${OBSIDIAN[@]}" dev:dom "selector=$1" total)
  if [[ $output == 'No elements found.' ]]; then
    printf '0'
  else
    printf '%s' "$output"
  fi
}

cleanup() {
  local exit_code=$?
  trap - EXIT

  "${OBSIDIAN[@]}" eval \
    "code=app.workspace.getLeavesOfType('markdown').find((leaf) => leaf.view.file?.path === '$TEST_PATH')?.detach()" \
    >/dev/null 2>&1 || true
  "${OBSIDIAN[@]}" delete "path=$TEST_PATH" permanent \
    >/dev/null 2>&1 || true
  if [[ -n $original_settings ]]; then
    "${OBSIDIAN[@]}" eval \
      "code=app.plugins.plugins.gremlins.updateSettings($original_settings)" \
      >/dev/null 2>&1 || true
  fi
  if [[ -n $previous_path ]]; then
    "${OBSIDIAN[@]}" open "path=$previous_path" \
      >/dev/null 2>&1 || true
  fi
  if [[ $debugger_started == true ]]; then
    "${OBSIDIAN[@]}" dev:debug off >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_equal() {
  local expected=$1
  local actual=$2
  local message=$3
  [[ $actual == "$expected" ]] ||
    fail "$message (expected $expected, got $actual)"
}

hover() {
  local selector=$1
  local coordinates
  local x
  local y

  coordinates=$(obsidian_eval "(() => {
    const element = Array.from(document.querySelectorAll('$selector'))
      .find((candidate) => {
        const bounds = candidate.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0;
      });
    if (!element) return '';
    const bounds = element.getBoundingClientRect();
    return [
      bounds.x + Math.min(2, bounds.width / 4),
      bounds.y + bounds.height / 2,
    ].join(' ');
  })()")
  [[ -n $coordinates ]] || fail "Could not find visible target: $selector"
  read -r x y <<<"$coordinates"

  "${OBSIDIAN[@]}" dev:cdp method=Input.dispatchMouseEvent \
    'params={"type":"mouseMoved","x":1,"y":1}' >/dev/null
  sleep 0.1
  "${OBSIDIAN[@]}" dev:cdp method=Input.dispatchMouseEvent \
    "params={\"type\":\"mouseMoved\",\"x\":$x,\"y\":$y}" >/dev/null
  sleep 1
}

previous_path=$(obsidian_eval "app.workspace.getActiveFile()?.path ?? ''")
vault_path=$(obsidian_eval "app.vault.adapter.basePath")
build_output=$(OBSIDIAN_TEST_VAULT="$vault_path" \
  node esbuild.config.mjs production 2>&1)
[[ $build_output == *'Copied plugin files to '* ]] ||
  fail 'Build did not copy the current plugin into the vault under test'
"${OBSIDIAN[@]}" plugin:reload id=gremlins >/dev/null
original_settings=$(obsidian_eval \
  "JSON.stringify(app.plugins.plugins.gremlins.settings)")
# Isolate scenarios from the vault's saved rules; cleanup restores them.
test_settings=$(node_modules/.bin/tsx --eval \
  "import { DEFAULT_SETTINGS } from './src/settings-model.ts'; console.log(JSON.stringify({...DEFAULT_SETTINGS, showGutterIcons: true, showTypographicCharacters: true}));")
"${OBSIDIAN[@]}" eval \
  "code=app.plugins.plugins.gremlins.updateSettings($test_settings)" \
  >/dev/null
"${OBSIDIAN[@]}" create "path=$TEST_PATH" 'content=em—dash' \
  overwrite open newtab >/dev/null
debug_status=$("${OBSIDIAN[@]}" dev:debug on)
if [[ $debug_status != *'already attached'* ]]; then
  debugger_started=true
fi

for _ in {1..50}; do
  active_path=$(obsidian_eval "app.workspace.getActiveFile()?.path ?? ''")
  character_count=$(dom_total \
    '.workspace-leaf.mod-active .gremlins-character')
  if [[ $active_path == "$TEST_PATH" && $character_count == 1 ]]; then
    break
  fi
  sleep 0.1
done
assert_equal "$TEST_PATH" "$active_path" 'Temporary test note did not become active'
assert_equal 1 "$character_count" 'Gremlin character was not rendered'

character_selector='.workspace-leaf.mod-active .gremlins-character'
code_mirror_tooltips=0
for attempt in {1..3}; do
  hover "$character_selector"
  for poll in {1..20}; do
    code_mirror_tooltips=$(dom_total \
      '.cm-tooltip-hover:has(.gremlins-tooltip)')
    if [[ $code_mirror_tooltips == 1 ]]; then
      break 2
    fi
    sleep 0.1
  done
done
obsidian_tooltips=$(dom_total 'body > .tooltip')
character_has_aria_label=$(obsidian_eval \
  "document.querySelector('$character_selector')?.hasAttribute('aria-label') ?? false")

assert_equal 1 "$code_mirror_tooltips" \
  'Highlighted character should show its CodeMirror tooltip'
assert_equal 0 "$obsidian_tooltips" \
  'Highlighted character should not also show an Obsidian tooltip'
assert_equal false "$character_has_aria_label" \
  'Highlighted character should not trigger Obsidian tooltip handling'

gutter_selector='.workspace-leaf.mod-active .gremlins-gutter .cm-gutterElement:not([style*="visibility: hidden"]) .gremlins-gutter-marker'
hover "$gutter_selector"
obsidian_tooltips=$(dom_total 'body > .tooltip')
gutter_aria_label=$(obsidian_eval \
  "document.querySelector('$gutter_selector')?.getAttribute('aria-label') ?? ''")
gutter_has_title=$(obsidian_eval \
  "document.querySelector('$gutter_selector')?.hasAttribute('title') ?? false")

assert_equal 1 "$obsidian_tooltips" \
  'Gutter icon should show its Obsidian tooltip'
[[ -n $gutter_aria_label ]] || fail 'Gutter icon should retain its accessible label'
assert_equal false "$gutter_has_title" \
  'Gutter icon should not also trigger a browser-native tooltip'

"${OBSIDIAN[@]}" eval \
  "code=app.plugins.plugins.gremlins.updateSettings({...app.plugins.plugins.gremlins.settings, showAmbiguousEmptyListMarkers: true, enableClickToFix: true})" \
  >/dev/null
"${OBSIDIAN[@]}" eval \
  "code=app.workspace.getMostRecentLeaf().view.editor.setValue('2. **Audit trail**\\n    -\\n    - Child')" \
  >/dev/null

ambiguous_selector='.workspace-leaf.mod-active [data-gremlin="ambiguous-empty-list-marker"]'
for _ in {1..50}; do
  ambiguous_count=$(dom_total "$ambiguous_selector")
  if [[ $ambiguous_count == 1 ]]; then
    break
  fi
  sleep 0.1
done
assert_equal 1 "$ambiguous_count" \
  'Ambiguous empty list marker was not highlighted'

clicked=$(obsidian_eval "(() => {
  const marker = document.querySelector(
    '.workspace-leaf.mod-active .gremlins-gutter-marker-interactive',
  );
  if (!marker) return false;
  marker.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  return true;
})()")
assert_equal true "$clicked" \
  'Ambiguous empty list marker did not provide an interactive gutter fix'

for _ in {1..50}; do
  ambiguous_count=$(dom_total "$ambiguous_selector")
  if [[ $ambiguous_count == 0 ]]; then
    break
  fi
  sleep 0.1
done
has_list_delimiter=$(obsidian_eval \
  "app.workspace.getMostRecentLeaf().view.editor.getLine(1) === '    - '")
assert_equal 0 "$ambiguous_count" \
  'Ambiguous empty list marker remained highlighted after the fix'
assert_equal true "$has_list_delimiter" \
  'Gutter fix did not add the missing list-marker delimiter'

"${OBSIDIAN[@]}" eval \
  "code=app.plugins.plugins.gremlins.updateSettings({...app.plugins.plugins.gremlins.settings, showAmbiguousEmptyListMarkers: false, listItemPunctuationPolicy: 'period', listItemLineEndingPolicy: 'two-spaces'})" \
  >/dev/null
"${OBSIDIAN[@]}" eval \
  "code=app.workspace.getMostRecentLeaf().view.editor.setValue('- First.  \\n- Second')" \
  >/dev/null

punctuation_selector='.workspace-leaf.mod-active [data-gremlin="list-item-punctuation"]'
line_ending_selector='.workspace-leaf.mod-active [data-gremlin="list-item-line-ending"]'
for _ in {1..50}; do
  punctuation_count=$(dom_total "$punctuation_selector")
  line_ending_count=$(dom_total "$line_ending_selector")
  if [[ $punctuation_count == 1 && $line_ending_count == 1 ]]; then
    break
  fi
  sleep 0.1
done
assert_equal 1 "$punctuation_count" \
  'Missing list-item punctuation was not highlighted'
assert_equal 1 "$line_ending_count" \
  'Missing list-item hard break was not highlighted'

fixed_list_ending=$(obsidian_eval "(() => {
  const editor = app.workspace.getMostRecentLeaf().view.editor;
  editor.setCursor({ line: 1, ch: 0 });
  app.commands.executeCommandById('gremlins:fix-current-line');
  return true;
})()")
assert_equal true "$fixed_list_ending" \
  'List-item ending command did not run'

for _ in {1..50}; do
  punctuation_count=$(dom_total "$punctuation_selector")
  line_ending_count=$(dom_total "$line_ending_selector")
  fixed_list_text=$(obsidian_eval \
    "app.workspace.getMostRecentLeaf().view.editor.getLine(1) === '- Second.  '")
  if [[ $punctuation_count == 0 && $line_ending_count == 0 && $fixed_list_text == true ]]; then
    break
  fi
  sleep 0.1
done
assert_equal 0 "$punctuation_count" \
  'List-item punctuation remained highlighted after the fix'
assert_equal 0 "$line_ending_count" \
  'List-item hard break remained highlighted after the fix'
assert_equal true "$fixed_list_text" \
  'List-item ending fix did not add a period and two trailing spaces'

"${OBSIDIAN[@]}" eval \
  "code=app.plugins.plugins.gremlins.updateSettings({...app.plugins.plugins.gremlins.settings, listItemPunctuationPolicy: 'none', listItemLineEndingPolicy: 'two-spaces'})" \
  >/dev/null
"${OBSIDIAN[@]}" eval \
  "code=app.workspace.getMostRecentLeaf().view.editor.setValue(['1. **Report/version history**?', '    - Previous versions remain available!  ', '    - Are historical reports available?  ', '2. **Audit trail**  ', '    - \$\$Supports traceability and internal audit\$\$'].join('\\n'))" \
  >/dev/null

for _ in {1..50}; do
  punctuation_count=$(dom_total "$punctuation_selector")
  line_ending_count=$(dom_total "$line_ending_selector")
  semantic_endings_ready=$(obsidian_eval \
    "(() => { const editor = app.workspace.getMostRecentLeaf().view.editor; return editor.lineCount() === 5 && editor.getLine(4) === '    - \$\$Supports traceability and internal audit\$\$'; })()")
  if [[ $semantic_endings_ready == true && $punctuation_count == 0 && $line_ending_count == 0 ]]; then
    break
  fi
  sleep 0.1
done
assert_equal true "$semantic_endings_ready" \
  'Semantic list-ending test content was not rendered'
assert_equal 0 "$punctuation_count" \
  'Meaningful sentence punctuation was incorrectly highlighted'
assert_equal 0 "$line_ending_count" \
  'Nested-list or display-math ending was incorrectly highlighted'

printf 'PASS: Obsidian tooltips and list-formatting fixes work.\n'
