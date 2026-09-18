#!/usr/bin/env bash
# Sourced by run.sh. Inspect the icon Obsidian actually inserts into the gutter.
read -r -d '' icon_cases <<'JS' || true
(() => {
  const test = window.__gremlinsE2E;
  test.iconCases = [
    {file: 'zero-width-spaces.md', text: '\u200b\u200b', severity: 'error', color: '--text-error'},
    {file: 'non-breaking-space.md', text: '\u00a0', severity: 'warning', color: '--color-orange'},
    {file: 'typographic-punctuation.md', text: '“”–—', severity: 'info', color: '--color-blue',
      settings: {showTypographicCharacters: true}},
  ];
  test.runIconCase = async (index, mode, interactive) => {
    const scenario = test.iconCases[index];
    const label = `${mode}/${interactive ? 'interactive' : 'passive'}: ${scenario.severity} gutter icon`;
    try {
      await test.openFixture(scenario.file, mode, {enableClickToFix: interactive, ...scenario.settings}, 4, 0);
      const markers = () => Array.from(test.leaf.view.contentEl.querySelectorAll('.gremlins-gutter-marker'))
        // CodeMirror also creates an invisible spacer containing an icon. It is not a rendered warning.
        .filter(marker => getComputedStyle(marker).visibility === 'visible' && marker.getBoundingClientRect().width > 0);
      await test.waitFor(() => test.highlights('character').map(mark => mark.text).join('') === scenario.text &&
        markers().length === 1 && markers()[0].querySelector('svg'), label + ': highlighted text and one visible SVG');
      const marker = markers()[0];
      const svg = marker.querySelector('svg');
      test.assert(marker.classList.contains('gremlins-severity-' + scenario.severity), 'Wrong gutter severity');
      test.assert(marker.classList.contains('gremlins-gutter-marker-interactive') === interactive, 'Wrong gutter interactivity');
      test.assert(marker.getAttribute('aria-label') === (interactive ? 'Fix highlighted gremlins' : 'Line contains one or more gremlins'),
        'Gutter icon lost its accessible label');

      // Recognize the mascot's eyes in the rendered SVG, not an imported constant or a source-code regex.
      const paths = Array.from(svg.querySelectorAll('path'));
      test.assert(paths.some(path => path.getAttribute('d') === 'm7.1 12 3 .8-2.2 1.7Zm9.8 0-3 .8 2.2 1.7Z'),
        'Expected the registered Gremlin mascot, not a built-in/fallback icon');
      test.assert(paths.length > 0 && paths.length <= 4, 'Gutter mascot should use at most four paths');
      test.assert(new TextEncoder().encode(svg.innerHTML).length < 1000, 'Rendered mascot geometry should stay below 1 KB');
      test.assert(!svg.querySelector('linearGradient, radialGradient, filter'), 'Tiny gutter icon should not need gradients or filters');
      test.assert(getComputedStyle(svg).filter === 'none', 'Unexpected SVG filter');

      const bounds = svg.getBoundingClientRect();
      const markerBounds = marker.getBoundingClientRect();
      test.assert(bounds.width >= 12 && bounds.width <= 16 && Math.abs(bounds.width - bounds.height) < 0.1,
        'Expected a visible square icon at 12–16 px; actual ' + JSON.stringify(bounds.toJSON()));
      test.assert(bounds.left >= markerBounds.left - 0.5 && bounds.right <= markerBounds.right + 0.5 &&
        bounds.top >= markerBounds.top - 0.5 && bounds.bottom <= markerBounds.bottom + 0.5, 'SVG does not fit its gutter marker');
      const box = svg.getBBox();
      const viewBox = svg.viewBox.baseVal;
      test.assert(viewBox.width > 0 && viewBox.height > 0 && box.width >= viewBox.width * 0.7 && box.height >= viewBox.height * 0.7 &&
        box.x >= viewBox.x && box.y >= viewBox.y && box.x + box.width <= viewBox.x + viewBox.width &&
        box.y + box.height <= viewBox.y + viewBox.height, 'Mascot should fill its viewBox without clipping');

      const assertPaint = expected => {
        let painted = 0;
        for (const path of paths) {
          const style = getComputedStyle(path);
          test.assert(style.filter === 'none' && Number(style.opacity) > 0 && style.visibility === 'visible', 'Invisible or filtered mascot path');
          for (const attribute of ['fill', 'stroke']) {
            if (style[attribute] === 'none') continue;
            painted++;
            test.assert(style[attribute] === expected, `${attribute} must inherit the gutter colour: expected ${expected}, got ${style[attribute]}`);
          }
        }
        test.assert(painted > 0, 'SVG has no painted paths');
      };
      assertPaint(getComputedStyle(marker).color);
      const originalStyle = marker.style.cssText;
      try {
        // Change only this marker's theme token; do not change the vault's theme or global CSS.
        const color = 'rgb(17, 93, 151)';
        marker.style.setProperty(scenario.color, color);
        await test.waitFor(() => getComputedStyle(marker).color === color, label + ': severity theme token applied');
        assertPaint(color);
      } finally {
        marker.style.cssText = originalStyle;
      }
      test.assert(test.leaf.view.editor.getValue() === test.fixtures[scenario.file], 'Rendering an icon must not edit the note');
      return 'PASS: ' + label;
    } catch (error) {
      throw Error(label + ': ' + error.message);
    }
  };
  return test.iconCases.length;
})()
JS
case_count=$(obsidian_eval "$icon_cases")
[[ $case_count =~ ^[1-9][0-9]*$ ]] || fail "Invalid icon scenario count: $case_count"
for mode in source live; do
  for interactive in false true; do
    for ((index = 0; index < case_count; index++)); do
      result=$(obsidian_eval "window.__gremlinsE2E.runIconCase($index, '$mode', $interactive)")
      [[ $result == 'PASS: '* ]] || fail "Unexpected icon result: $result"
      printf '%s\n' "$result"
    done
  done
done
printf 'PASS: %s gutter-icon scenarios in real Obsidian.\n' "$((case_count * 4))"
