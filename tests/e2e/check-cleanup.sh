#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
OBSIDIAN=("${OBSIDIAN_CLI:-obsidian}" "vault=${OBSIDIAN_TEST_VAULT_NAME:-plugin-testing-vault}")
snapshot='(async () => {
  const plugin = app.plugins.plugins.gremlins;
  const path = plugin.manifest.dir + "/data.json";
  return JSON.stringify({settings: plugin.settings,
    editorOptions: Object.fromEntries(["tabSize", "showLineNumber", "foldHeading", "foldIndent", "rightToLeft"]
      .map(key => [key, app.vault.getConfig(key)])),
    leafId: app.workspace.getMostRecentLeaf()?.id,
    data: await app.vault.adapter.exists(path) ? await app.vault.adapter.read(path) : null});
})()'
before=$("${OBSIDIAN[@]}" eval "code=$snapshot")
[[ $before == '=> {'* ]] || { printf '%s\n' "$before" >&2; exit 1; }
mkdir -p test-results
if bash tests/e2e/run.sh --fail-after-setup >test-results/cleanup-check.log 2>&1; then
  printf 'FAIL: an application exception incorrectly passed the runner\n' >&2
  exit 1
fi
log=$(<test-results/cleanup-check.log)
[[ $log == *'Intentional E2E cleanup check'* ]] || { printf '%s\n' "$log" >&2; exit 1; }
after=$("${OBSIDIAN[@]}" eval "code=$snapshot")
[[ $before == "$after" ]] || { printf 'FAIL: settings, saved data, editor options or active tab changed\nBefore: %s\nAfter: %s\n' "$before" "$after" >&2; exit 1; }
clean=$("${OBSIDIAN[@]}" eval 'code=(async () => !(await app.vault.adapter.exists("_gremlins_e2e")) && !(await app.vault.adapter.exists(".gremlins-e2e-lock")) && !window.__gremlinsE2E)()')
[[ $clean == '=> true' ]] || { printf 'FAIL: leftover E2E state: %s\n' "$clean" >&2; exit 1; }
printf 'PASS: real application exception failed the runner; fixtures, lock, settings, editor options and active tab were restored.\n'
