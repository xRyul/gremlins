#!/usr/bin/env bash
# Responsibilities: actual character/gutter hover tooltips, without duplicate tooltips.
# Accessible label content belongs in gremlin-icon.sh; rule detection/fixes in their suites.
# Sourced by run.sh; fixture lifecycle, CLI transport and waiting are shared.

hover() {
  local selector=$1
  local coordinates
  local x
  local y

  coordinates=$(obsidian_eval "(async () => {
    let element;
    await window.__gremlinsE2E.waitFor(() => {
      element = Array.from(document.querySelectorAll('$selector')).find(candidate => {
        const bounds = candidate.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0;
      });
      return !!element;
    }, 'Visible hover target: $selector');
    const bounds = element.getBoundingClientRect();
    return [
      bounds.x + Math.min(2, bounds.width / 4),
      bounds.y + bounds.height / 2,
    ].join(' ');
  })()")
  [[ -n $coordinates ]] || fail "Could not find visible target: $selector"
  read -r x y <<<"$coordinates"

  obsidian_command dev:cdp method=Input.dispatchMouseEvent \
    'params={"type":"mouseMoved","x":1,"y":1}' >/dev/null
  sleep 0.1
  obsidian_command dev:cdp method=Input.dispatchMouseEvent \
    "params={\"type\":\"mouseMoved\",\"x\":$x,\"y\":$y}" >/dev/null
  sleep 1
}

open_fixture 'tooltips.md' 'source' '{showTypographicCharacters: true}'

obsidian_eval "window.__gremlinsE2E.waitFor(() =>
  app.workspace.getActiveFile()?.path === '$TEST_PATH' &&
  window.__gremlinsE2E.highlights('character').length === 1,
  'Active tooltip fixture and rendered gremlin character')" >/dev/null

character_selector='.workspace-leaf.mod-active .gremlins-character'
tooltip_ready=false
# Retrying the hover gesture is separate from waiting for its rendered result.
for attempt in {1..3}; do
  hover "$character_selector"
  tooltip_ready=$(obsidian_eval "(async () => {
    const message = 'Highlighted character should show its CodeMirror tooltip';
    try {
      await window.__gremlinsE2E.waitFor(() =>
        document.querySelectorAll('.cm-tooltip-hover:has(.gremlins-tooltip)').length === 1, message);
      return true;
    } catch (error) {
      if (error.message !== 'Timed out: ' + message) throw error;
      return false;
    }
  })()")
  if [[ $tooltip_ready == true ]]; then break; fi
done
obsidian_tooltips=$(dom_total 'body > .tooltip')
character_has_aria_label=$(obsidian_eval \
  "document.querySelector('$character_selector')?.hasAttribute('aria-label') ?? false")

assert_equal true "$tooltip_ready" \
  'Highlighted character should show its CodeMirror tooltip'
assert_equal 0 "$obsidian_tooltips" \
  'Highlighted character should not also show an Obsidian tooltip'
assert_equal false "$character_has_aria_label" \
  'Highlighted character should not trigger Obsidian tooltip handling'

gutter_selector='.workspace-leaf.mod-active .gremlins-gutter .cm-gutterElement:not([style*="visibility: hidden"]) .gremlins-gutter-marker'
hover "$gutter_selector"
obsidian_eval "window.__gremlinsE2E.waitFor(() =>
  document.querySelectorAll('body > .tooltip').length === 1,
  'Gutter icon should show its Obsidian tooltip')" >/dev/null
gutter_has_title=$(obsidian_eval \
  "document.querySelector('$gutter_selector')?.hasAttribute('title') ?? false")

assert_equal false "$gutter_has_title" \
  'Gutter icon should not also trigger a browser-native tooltip'

printf 'PASS: Obsidian character and gutter hover tooltips work.\n'
