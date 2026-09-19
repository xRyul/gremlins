#!/usr/bin/env bash
# Responsibilities: actual character/gutter hover tooltips, without duplicate tooltips.
# Accessible label content belongs in gremlin-icon.sh; rule detection/fixes in their suites.
# Sourced by run.sh; fixture lifecycle, CLI transport and waiting are shared.

hover_at() {
  obsidian_command dev:cdp method=Input.dispatchMouseEvent \
    'params={"type":"mouseMoved","x":1,"y":1}' >/dev/null
  sleep 0.1
  obsidian_command dev:cdp method=Input.dispatchMouseEvent \
    "params={\"type\":\"mouseMoved\",\"x\":$1,\"y\":$2}" >/dev/null
  # Allow the real hover timer to run, including when expecting no tooltip.
  sleep 1
}

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

  hover_at "$x" "$y"
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

read -r -d '' hover_cases <<'JS' || true
(() => {
  const test = window.__gremlinsE2E;
  const nbsp = 'non-breaking space · Unicode U+00A0 · Warning';
  const zwsp = 'zero-width space · Unicode U+200B · Error';
  test.assert(test.fixtures['character-boundaries.md'] === 'a\u00a0b\nabcd\u200be\na\u00a0\u200cb\na\u00a0\u2007b\n',
    'Character-boundary fixture bytes changed');
  test.hoverCases = [
    {name: 'outside opening boundary', line: 0, ch: 1, side: -1, tooltip: null},
    {name: 'inside opening boundary', line: 0, ch: 1, side: 1, tooltip: nbsp},
    {name: 'inside closing boundary', line: 0, ch: 2, side: -1, tooltip: nbsp},
    {name: 'outside closing boundary', line: 0, ch: 2, side: 1, tooltip: null},
    {name: 'zero-width opening from the left', line: 1, ch: 4, side: -1, tooltip: zwsp},
    {name: 'zero-width opening from the right', line: 1, ch: 4, side: 1, tooltip: zwsp},
    {name: 'adjacent NBSP/non-joiner from the left', line: 2, ch: 2, side: -1, tooltip: nbsp},
    {name: 'adjacent NBSP/non-joiner from the right', line: 2, ch: 2, side: 1,
      tooltip: 'zero-width non-joiner · Unicode U+200C · Warning'},
    {name: 'adjacent visible-width gremlins from the left', line: 3, ch: 2, side: -1, tooltip: nbsp},
    {name: 'adjacent visible-width gremlins from the right', line: 3, ch: 2, side: 1,
      tooltip: 'figure space · Unicode U+2007 · Warning'},
  ];
  test.prepareHoverCase = async (index, mode) => {
    const scenario = test.hoverCases[index];
    await test.openFixture('character-boundaries.md', mode, {}, 4, scenario.line);
    const editor = test.leaf.view.editor, cm = editor.cm;
    const pos = editor.posToOffset(scenario);
    const before = cm.coordsAtPos(pos);
    const boundary = Math.round(before.left);
    const transform = cm.contentDOM.style.transform;
    // Trusted mouse events use integer CSS coordinates. Align this fixture's boundary
    // by less than a pixel so the zero-width opening is reachable from side +1 too.
    cm.contentDOM.style.transform = `translateX(${(boundary - before.left) / cm.scaleX}px)`;
    cm.requestMeasure();
    await test.waitFor(() => cm.coordsAtPos(pos).left === boundary, 'Pixel-aligned hover boundary');
    const rect = cm.coordsAtPos(pos);
    const state = {scenario, cm, pos, transform, label: `${mode}: ${scenario.name}`};
    state.observe = event => {
      const position = cm.posAtCoords({x: event.clientX, y: event.clientY});
      const coords = position === null ? null : cm.coordsAtPos(position);
      state.pointer = {position, side: coords && (event.clientX < coords.left ? -1 : 1), trusted: event.isTrusted};
    };
    cm.dom.addEventListener('mousemove', state.observe);
    test.hoverState = state;
    return [boundary + (scenario.side < 0 ? -1 : 0), (rect.top + rect.bottom) / 2].join(' ');
  };
  test.checkHoverCase = async () => {
    const {scenario, cm, pos, transform, observe, pointer, label} = test.hoverState;
    const tooltips = () => Array.from(document.querySelectorAll('.gremlins-tooltip'), element => element.textContent);
    try {
      test.assert(pointer?.trusted && pointer.position === pos && pointer.side === scenario.side,
        label + ': pointer missed the intended boundary/side: ' + JSON.stringify(pointer));
      const expected = scenario.tooltip === null ? [] : [scenario.tooltip];
      await test.waitFor(() => JSON.stringify(tooltips()) === JSON.stringify(expected),
        label + ': expected tooltip ' + JSON.stringify(expected));
      test.assert(!document.querySelector('body > .tooltip'), 'Duplicate Obsidian tooltip');
      const original = test.fixtures['character-boundaries.md'];
      test.assert(test.leaf.view.editor.getValue() === original, 'Hover must not edit the note');
      await test.leaf.view.save();
      test.assert(await app.vault.read(test.leaf.view.file) === original, 'Hover must not change the saved note');
      return 'PASS: ' + label;
    } catch (error) {
      throw Error(error.message + '\nActual tooltips: ' + JSON.stringify(tooltips()));
    } finally {
      cm.dom.removeEventListener('mousemove', observe);
      cm.contentDOM.style.transform = transform;
      cm.requestMeasure();
      delete test.hoverState;
    }
  };
  return test.hoverCases.length;
})()
JS
hover_count=$(obsidian_eval "$hover_cases")
[[ $hover_count =~ ^[1-9][0-9]*$ ]] || fail "Invalid hover scenario count: $hover_count"
for mode in source live; do
  for ((index = 0; index < hover_count; index++)); do
    coordinates=$(obsidian_eval "window.__gremlinsE2E.prepareHoverCase($index, '$mode')")
    read -r x y <<<"$coordinates"
    hover_at "$x" "$y"
    result=$(obsidian_eval 'window.__gremlinsE2E.checkHoverCase()')
    [[ $result == 'PASS: '* ]] || fail "Unexpected hover result: $result"
    printf '%s\n' "$result"
  done
done
printf 'PASS: %s hover-boundary scenarios in real Obsidian.\n' "$((hover_count * 2))"
