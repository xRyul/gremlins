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
  test.assert(test.defaults.showAmbiguousEmptyListMarkers === false, 'Empty-marker rule must be disabled in application defaults');
  test.assert(test.fixtures['delimited-marker.md'].split('\n')[1] === '    - ', 'Fixture lost its significant trailing space');
  test.assert(test.fixtures['tabbed-parent.md'].startsWith('\t-\tParent\n\t\t-\n'), 'Fixture tabs were reformatted');
  test.assert(test.fixtures['line-endings-no-final-newline.md'] === '- First\n- Second', 'Fixture must have no final newline');
  test.assert(test.defaults.showDuplicateListMarkers === false && test.defaults.showListMarkerSpacing === false, 'Marker cleanup rules must be disabled in application defaults');
  test.assert(test.fixtures['duplicate-empty-markers.md'] === '- -\n\n- -  \n', 'Empty retained-marker fixture lost its trailing spaces');
  test.assert(test.fixtures['list-marker-setext.md'] === '-  \n\n> -  \n\nHeading\n-  \n\n> Heading\n> -  \n', 'Potential Setext underlines lost their trailing spaces');
  test.assert(test.fixtures['list-marker-thematic-breaks.md'] === '- - -\n\n> - - -\n\n> *  *  *\n', 'Thematic-break marker spacing changed');
  test.assert(test.fixtures['list-marker-nine-digits.md'] === '123456789.  Item\n' && test.fixtures['list-marker-ten-digits.md'] === '1234567890.  Item\n', 'Ordered-marker digit boundary changed');
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

    // Ambiguous empty list markers: real parser contexts, source columns, defaults and tab widths.
    ...[
      {file: 'parent-child.md', ch: 4},
      {file: 'root-siblings.md', ch: 0},
      {file: 'parent-marker-width-3.md', ch: 3},
      {file: 'parent-marker-width-8.md', ch: 8},
      {file: 'parent-delimiter-valid.md', ch: 7},
      {file: 'parent-delimiter-too-shallow.md'},
      // Without a root list, Obsidian parses the original tabbed unit-test input as code.
      ...[2, 4, 8].map(tabSize => ({file: 'tabbed-parent.md', tabSize})),
      ...[2, 4, 8].map(tabSize => ({file: 'tabbed-nested-parent.md', tabSize, line: 2, ch: 2})),
      {file: 'blockquote.md', ch: 6},
      {file: 'setext-heading.md'},
      {file: 'fenced-parent.md', line: 2},
      {file: 'fenced-siblings.md', line: 2},
      {file: 'indented-code.md'},
      {file: 'deeper-following-item.md'},
      {file: 'different-following-marker.md'},
      {file: 'delimited-marker.md'},
      {file: 'parent-child.md', defaults: true},
    ].map(({file, ch, line = 1, tabSize = 4, defaults = false}) => ({
      name: `ambiguous empty marker in ${file} (${defaults ? 'defaults' : 'enabled'})`,
      file, line, tabSize, kind: 'ambiguous-empty-list-marker',
      settings: defaults ? {} : {showAmbiguousEmptyListMarkers: true},
      marks: ch === undefined ? [] : [{line, ch, text: '-'}],
    })),

    // Marker cleanup: real compact lists, delimiter ranges, exclusions and independent defaults.
    {name: 'redundant first unordered marker at a multiline source offset', file: 'duplicate-markers.md', kind: 'duplicate-list-marker',
      settings: {showDuplicateListMarkers: true}, marks: [{line: 2, ch: 0, text: '- ',
        notice: 'Duplicate list marker · Consecutive unordered markers may create an unintended nested list · Warning'}]},
    {name: 'nested plus/star markers inside a blockquote', file: 'duplicate-quoted-markers.md', kind: 'duplicate-list-marker',
      settings: {showDuplicateListMarkers: true}, marks: [{line: 1, ch: 4, text: '+ '}]},
    {name: 'extra spaces after unordered and both ordered marker styles', file: 'list-marker-spacing.md', kind: 'list-marker-spacing',
      settings: {showListMarkerSpacing: true}, marks: [
        {line: 0, ch: 1, text: '  ', notice: 'List marker spacing · Marker is not followed by exactly one ordinary space · Warning'},
        {line: 1, ch: 2, text: '  '}, {line: 2, ch: 2, text: '  '},
      ]},
    {name: 'single tab delimiters after unordered and ordered markers', file: 'list-marker-tabs.md', kind: 'list-marker-spacing',
      settings: {showListMarkerSpacing: true}, marks: [{line: 0, ch: 1, text: '\t'}, {line: 1, ch: 2, text: '\t'}]},
    {name: 'nine-digit ordered marker accepts delimiter cleanup', file: 'list-marker-nine-digits.md', kind: 'list-marker-spacing',
      settings: {showListMarkerSpacing: true}, marks: [{line: 0, ch: 10, text: '  '}]},
    {name: 'ten-digit prefix is not eligible for marker cleanup', file: 'list-marker-ten-digits.md', kind: 'list-marker-spacing',
      settings: {showListMarkerSpacing: true}, marks: []},
    {name: 'one ordinary marker space is already valid', file: 'list-marker-valid.md', kind: 'list-marker-spacing',
      settings: {showListMarkerSpacing: true}, marks: []},
    {name: 'spacing checks every marker in compact nested lists', file: 'list-marker-compact.md', kind: 'list-marker-spacing',
      settings: {showListMarkerSpacing: true}, marks: [
        {line: 0, ch: 3, text: '  '}, {line: 2, ch: 4, text: '  '}, {line: 4, ch: 5, text: '  '},
        {line: 6, ch: 1, text: '  '}, {line: 6, ch: 4, text: '  '},
      ]},
    {name: 'combined cleanup flags only redundant unordered markers', file: 'list-marker-compact.md', kind: 'duplicate-list-marker',
      settings: {showDuplicateListMarkers: true, showListMarkerSpacing: true}, marks: [
        {line: 0, ch: 0, text: '- '}, {line: 4, ch: 2, text: '- '}, {line: 6, ch: 0, text: '-  '},
      ]},
    {name: 'combined cleanup checks retained delimiters without overlapping the removed marker', file: 'list-marker-compact.md', kind: 'list-marker-spacing',
      settings: {showDuplicateListMarkers: true, showListMarkerSpacing: true}, marks: [
        {line: 0, ch: 3, text: '  '}, {line: 2, ch: 4, text: '  '}, {line: 4, ch: 5, text: '  '}, {line: 6, ch: 4, text: '  '},
      ]},
    {name: 'duplicate cleanup preserves empty retained markers', file: 'duplicate-empty-markers.md', kind: 'duplicate-list-marker',
      settings: {showDuplicateListMarkers: true}, marks: []},
    ...['duplicate-list-marker', 'list-marker-spacing'].flatMap(kind => [
      {name: kind + ' disabled in application defaults', file: 'list-marker-defaults.md', kind, marks: []},
      ...['list-marker-literals.md', 'list-marker-thematic-breaks.md', 'list-marker-setext.md'].map(file => ({
        name: kind + ' ignores literal, thematic or Setext syntax in ' + file, file, kind,
        settings: {showDuplicateListMarkers: true, showListMarkerSpacing: true}, marks: [],
      })),
    ]),

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
    ...[
      {policy: 'period', marks: [{line: 0, ch: 6, text: 't'}, {line: 1, ch: 8, text: ';'}]},
      {policy: 'semicolon', marks: [{line: 0, ch: 6, text: 't'}, {line: 2, ch: 7, text: '.'}]},
      {policy: 'none', marks: [{line: 1, ch: 8, text: ';'}, {line: 2, ch: 7, text: '.'}]},
    ].map(({policy, marks}) => ({
      name: 'explicit punctuation policy: ' + policy, file: 'punctuation-mixed.md', kind: 'list-item-punctuation',
      settings: {listItemPunctuationPolicy: policy}, marks,
    })),
    {name: 'semicolons with a final period', file: 'punctuation-formal.md', kind: 'list-item-punctuation',
      settings: {listItemPunctuationPolicy: 'semicolon-final-period'}, marks: [
        {line: 0, ch: 7, text: '.', notice: 'List item punctuation · Expected a semicolon (;) at the end of this item · Warning'},
        {line: 1, ch: 7, text: 'd'},
        {line: 2, ch: 7, text: ';', notice: 'List item punctuation · Expected a period (.) at the end of this item · Warning'},
      ]},
    ...['list-item-punctuation', 'list-item-line-ending'].map(kind => ({
      name: kind + ' disabled in application defaults', file: 'list-endings.md', kind, marks: [],
    })),
    // Punctuation expectations come from the actual editor and inspection command.
    ...[
      {name: 'infer punctuation independently for each list', file: 'punctuation-inference.md', policy: 'consistent', marks: [
        {line: 1, ch: 7, text: 'd', notice: 'List item punctuation · Expected a period (.) at the end of this item · Warning'},
        {line: 5, ch: 8, text: 'd', notice: 'List item punctuation · Expected a semicolon (;) at the end of this item · Warning'},
      ]},
      {name: 'infer a valid formal list', file: 'punctuation-inferred-formal.md', policy: 'consistent', marks: []},
      {name: 'infer a missing formal-list semicolon', file: 'punctuation-inferred-formal-missing.md', policy: 'consistent', marks: [
        {line: 1, ch: 7, text: 'd', notice: 'List item punctuation · Expected a semicolon (;) at the end of this item · Warning'},
      ]},
      {name: 'first item breaks an inference tie', file: 'list-endings.md', policy: 'consistent', marks: [
        {line: 1, ch: 7, text: 'd', notice: 'List item punctuation · Expected a period (.) at the end of this item · Warning'},
      ]},
      {name: 'questions and exclamations do not drive inference', file: 'punctuation-semantic-inference.md', policy: 'consistent', marks: []},
      ...['consistent', 'none', 'period', 'semicolon', 'semicolon-final-period'].map(policy => ({
        name: 'preserve meaningful sentence endings under ' + policy, file: 'punctuation-sentence-endings.md', policy, marks: [],
      })),
      {name: 'multiline display math does not drive inference', file: 'punctuation-math.md', policy: 'consistent', marks: []},
      {name: 'empty display math needs no period', file: 'punctuation-math-empty.md', marks: []},
      {name: 'inline display math needs no period', file: 'punctuation-math-inline.md', marks: []},
      {name: 'nested lists infer independent punctuation', file: 'punctuation-nested.md', policy: 'consistent', marks: [
        {line: 2, ch: 10, text: 'd', notice: 'List item punctuation · Expected a semicolon (;) at the end of this item · Warning'},
        {line: 3, ch: 7, text: 't', notice: 'List item punctuation · Expected a period (.) at the end of this item · Warning'},
      ]},
      ...['period', 'consistent'].map(policy => ({
        name: 'parent colon is structural under ' + policy, file: 'punctuation-parent-colon.md', policy, marks: [],
      })),
      {name: 'parent colon is structural under none', file: 'punctuation-parent-colon-none.md', policy: 'none', marks: []},
      {name: 'parent colon preserves formal-list position', file: 'punctuation-formal-parent-colon.md', policy: 'semicolon-final-period', marks: []},
      {name: 'leaf colon still requires punctuation', file: 'punctuation-leaf-colon.md', marks: [{line: 0, ch: 6, text: ':'}]},
      {name: 'multiline item uses its final content line', file: 'punctuation-multiline.md', marks: [{line: 3, ch: 10, text: 's'}]},
      {name: 'blockquote list excludes fenced examples', file: 'punctuation-quoted-fence.md', policy: 'consistent', marks: [
        {line: 1, ch: 9, text: 'd', notice: 'List item punctuation · Expected a period (.) at the end of this item · Warning'},
      ]},
      {name: 'punctuation belongs before a block ID', file: 'punctuation-block-ids.md', marks: [{line: 1, ch: 7, text: 'd'}]},
      {name: 'tasks, formatting and link labels', file: 'punctuation-formatting.md', marks: [{line: 3, ch: 15, text: '*'}]},
      {name: 'standalone wikilink exempt but accompanying prose is not', file: 'punctuation-wikilinks.md', marks: [{line: 0, ch: 80, text: 'e'}]},
      {name: 'single-token all-caps task label needs no period', file: 'punctuation-caps.md', marks: []},
      {name: 'parent labels are exempt but child prose ending in wikilinks is not', file: 'punctuation-label-parents.md', marks: [
        {line: 1, ch: 155, text: ']', notice: 'List item punctuation · Expected a period (.) at the end of this item · Warning'},
      ]},
      {name: 'highlight the whole final astral code point', file: 'punctuation-astral.md', marks: [{line: 0, ch: 2, text: '👾'}]},
      ...['consistent', 'none', 'period', 'semicolon', 'semicolon-final-period'].map(policy => ({
        name: 'multiline formula is exempt under ' + policy, file: 'punctuation-math-only.md', policy, marks: [],
      })),
      {name: 'prose after a formula still needs punctuation', file: 'punctuation-math-prose.md', marks: [{line: 4, ch: 7, text: 't'}]},
      {name: 'nested formula preserves sibling inference', file: 'punctuation-math-nested.md', policy: 'consistent', marks: [{line: 6, ch: 9, text: 't'}]},
      {name: 'formula retains its formal-list position', file: 'punctuation-math-formal.md', policy: 'semicolon-final-period', marks: []},
      {name: 'frontmatter list shapes are literal', file: 'punctuation-frontmatter.md', marks: [{line: 5, ch: 7, text: 'l'}]},
      {name: 'indented code list shapes are literal', file: 'indented-code.md', marks: []},
      {name: 'bare wikilink target is not terminal punctuation', file: 'punctuation-bare-wikilink.md', policy: 'semicolon', marks: [{line: 0, ch: 10, text: ']'}]},
      {name: 'balanced link destination preserves a punctuated label', file: 'punctuation-balanced-link.md', marks: []},
      {name: 'punctuation is located inside a balanced link label', file: 'punctuation-balanced-link.md', policy: 'semicolon', marks: [{line: 0, ch: 8, text: '.'}]},
      {name: 'highlight a complete terminal punctuation run', file: 'punctuation-run.md', policy: 'none', marks: [{line: 0, ch: 14, text: '.;'}]},
      {name: 'different marker styles infer independently', file: 'punctuation-marker-styles.md', policy: 'consistent', marks: []},
      {name: 'nested fence is not an item endpoint', file: 'punctuation-nested-fence.md', policy: 'consistent', marks: [
        {line: 4, ch: 7, text: 'd', notice: 'List item punctuation · Expected a period (.) at the end of this item · Warning'},
      ]},
      {name: 'nested comment is not an item endpoint', file: 'punctuation-nested-comment.md', policy: 'consistent', marks: [
        {line: 4, ch: 7, text: 'd', notice: 'List item punctuation · Expected a period (.) at the end of this item · Warning'},
      ]},
      {name: 'root lazy continuation is the endpoint', file: 'punctuation-lazy-root.md', marks: [{line: 3, ch: 10, text: 'g'}]},
      {name: 'nested continuation and following parent paragraph', file: 'punctuation-lazy-nested.md', marks: [{line: 4, ch: 14, text: 'g'}, {line: 5, ch: 12, text: 't'}]},
      {name: 'blockquote lazy continuation is the endpoint', file: 'punctuation-lazy-quote.md', marks: [{line: 2, ch: 9, text: 'd'}]},
      {name: 'inline-code continuation is an item endpoint', file: 'punctuation-code-continuation.md', marks: [{line: 1, ch: 14, text: '`'}]},
      {name: 'do not remove punctuation inside inline code', file: 'punctuation-inline-code.md', policy: 'none', marks: []},
      ...['period', 'semicolon'].map(policy => ({
        name: 'require punctuation outside inline code under ' + policy, file: 'punctuation-inline-code.md', policy, marks: [{line: 0, ch: 15, text: '`'}],
      })),
      ...['none', 'period'].map(policy => ({
        name: 'escaped terminal punctuation under ' + policy, file: 'punctuation-escaped.md', policy, marks: [{line: 0, ch: 8, text: '\\;'}],
      })),
      // A standalone quoted ordered item is valid Markdown, unlike the fabricated rejection in the old test.
      {name: 'ordered list inside a blockquote', file: 'punctuation-ordered-quote.md', marks: [{line: 0, ch: 16, text: 'n'}]},
      {name: 'root literal block separates list groups', file: 'punctuation-root-fence.md', policy: 'consistent', marks: []},
    ].map(({policy = 'period', ...scenario}) => ({
      ...scenario, kind: 'list-item-punctuation', settings: {listItemPunctuationPolicy: policy},
    })),
    ...[
      {name: 'remove list whitespace but preserve separate prose', file: 'line-endings-whitespace.md', policy: 'no-trailing-whitespace', marks: [
        {line: 0, ch: 7, text: '  ', notice: 'List item line ending · Expected no trailing whitespace · Warning'}, {line: 1, ch: 8, text: '\t'},
      ]},
      {name: 'require exactly two hard-break spaces', file: 'line-endings-hard-break.md', policy: 'two-spaces', marks: [
        {line: 0, ch: 5, text: 'e', notice: 'List item line ending · Expected exactly two trailing spaces (Markdown hard break) · Warning'},
        {line: 1, ch: 5, text: ' '}, {line: 3, ch: 7, text: '   '},
      ]},
      {name: 'block IDs must remain at the physical end of the line', file: 'line-endings-block-ids.md', policy: 'two-spaces', marks: [{line: 1, ch: 10, text: 'd'}]},
      {name: 'blank separators only between adjacent siblings', file: 'line-endings-siblings.md', policy: 'blank-line', marks: [
        {line: 0, ch: 6, text: 't', notice: 'List item line ending · Expected a blank line before the next sibling item · Warning'},
      ]},
      {name: 'parent separator follows the whole subtree', file: 'line-endings-subtree.md', policy: 'blank-line', marks: [{line: 1, ch: 10, text: 'd'}]},
      {name: 'separator stays inside a blockquote', file: 'line-endings-quote.md', policy: 'blank-line', marks: [{line: 0, ch: 8, text: 't'}]},
      {name: 'separator follows a quoted lazy continuation', file: 'punctuation-lazy-quote.md', policy: 'blank-line', marks: [{line: 1, ch: 14, text: '.'}]},
      {name: 'different marker styles need no separator', file: 'punctuation-marker-styles.md', policy: 'blank-line', marks: []},
      {name: 'remove empty-checkbox trailing whitespace', file: 'line-endings-empty-spaces.md', policy: 'no-trailing-whitespace', marks: [{line: 0, ch: 5, text: '   '}]},
      {name: 'empty checkbox can receive a hard break', file: 'line-endings-empty-task.md', policy: 'two-spaces', marks: [{line: 0, ch: 4, text: ']'}]},
      {name: 'multiline formula needs no hard break', file: 'punctuation-math-only.md', policy: 'two-spaces', marks: []},
    ].map(({policy, ...scenario}) => ({
      ...scenario, kind: 'list-item-line-ending', settings: {listItemLineEndingPolicy: policy},
    })),
    ...['no-trailing-whitespace', 'two-spaces'].flatMap(policy => ['list-item-punctuation', 'list-item-line-ending'].map(kind => ({
      name: 'Unicode trailing spaces with ' + policy + ': ' + kind, file: 'line-endings-unicode.md', kind,
      settings: {listItemPunctuationPolicy: 'period', listItemLineEndingPolicy: policy},
      marks: ['\u00a0', '\u2007', '\u202f'].map((space, line) => ({line, ch: kind === 'list-item-punctuation' ? 5 : 6, text: kind === 'list-item-punctuation' ? 'm' : space})),
    }))),
    ...[
      {file: 'punctuation-lazy-code.md', ch: 12, text: '`'},
      {file: 'punctuation-lazy-emphasis.md', ch: 14, text: '*'},
    ].map(({file, ch, text}) => ({
      name: 'unindented formatted continuation in ' + file, file, kind: 'list-item-punctuation',
      settings: {listItemPunctuationPolicy: 'period'}, marks: [{line: 1, ch, text}],
    })),
    ...['list-item-punctuation', 'list-item-line-ending'].map(kind => ({
      name: 'combined ' + kind + ' at EOF without a newline', file: 'line-endings-no-final-newline.md', kind,
      settings: {listItemPunctuationPolicy: 'period', listItemLineEndingPolicy: 'two-spaces'},
      marks: [{line: 0, ch: 6, text: 't'}, {line: 1, ch: 7, text: 'd'}],
    })),
    {name: 'sibling separator without a final newline', file: 'line-endings-no-final-newline.md', kind: 'list-item-line-ending',
      settings: {listItemLineEndingPolicy: 'blank-line'}, marks: [{line: 0, ch: 6, text: 't'}]},
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
      // Live Preview replaces inactive Markdown delimiters with rendered content.
      // Enter the highlighted source range so delimiter-based warnings are inspectable.
      if (expected[0]) editor.setCursor(editor.offsetToPos(expected[0].from));
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
