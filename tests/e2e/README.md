# Live Obsidian tests

```sh
npm test                 # Typecheck, then test the built plugin in Obsidian
npm run test:cleanup     # Deliberately throw in the app and verify failure cleanup
npm run test:unit        # Remaining Node-only tests; not a substitute for npm test
```

Requires desktop Obsidian with its official `obsidian` CLI enabled and Gremlins enabled in `plugin-testing-vault`. Keep the main vault window visible and focus it before starting, rather than a detached Settings window, which can receive inspection notices instead. Do not edit the vault while tests run. The runner builds and copies the current plugin itself; there is no need to run `npm run dev` alongside it.

`OBSIDIAN_TEST_VAULT_NAME` selects another disposable testing vault; `OBSIDIAN_CLI` overrides the CLI executable. The runner verifies the returned vault name before making changes. `npm run build` remains an offline build with Node checks; run `npm test` for live verification.

## Organisation

**Group tests by observable behaviour, not by setting, source function or old unit-test filename.** A setting configures a scenario; it does not automatically need its own suite.

```text
tests/
├── e2e/
│   ├── run.sh
│   ├── check-cleanup.sh
│   ├── detect.sh
│   ├── fix.sh
│   ├── gremlin-icon.sh
│   ├── editor-tooltip.sh
│   ├── fixtures/
│   └── README.md
└── *.test.ts                 # Remaining Node-only checks
```

### Suite ownership

| File | Responsibility |
|---|---|
| `run.sh` | Build/deployment, CLI transport, fixture reset, shared application helpers, waiting, diagnostics, locking and state restoration. Suites are sourced here; they do not implement their own lifecycle. |
| `check-cleanup.sh` | Deliberately fail the runner and verify that files, settings, persisted data and the active tab are restored. |
| `detect.sh` | Read-only detection: exact highlight ranges, grouping, severity, rule defaults/toggles, exclusions and cursor-inspection notices. Editor and saved contents must remain unchanged. Never invoke fixes. |
| `fix.sh` | Command/gutter edits and no-op actions: complete resulting documents, preserved text, saved contents and remaining warnings. Highlights are preconditions, not repeated exact-range/style tests. |
| `gremlin-icon.sh` | Actual rendered icon identity, geometry, size, severity colours and accessibility labels. |
| `editor-tooltip.sh` | Hover behaviour, tooltip appearance and prevention of duplicate tooltips. |
| `fixtures/` | Committed Markdown inputs shared across suites. Settings and expected outcomes belong in scenario definitions, not in a second fixture-management system. |

### Adding or migrating coverage

1. Check existing scenarios first. Extend or replace equivalent coverage rather than adding a duplicate.
2. Assign each assertion to its behaviour owner. Split an old unit-test file across suites when it mixes detection, editing and presentation; do not reproduce the old filename structure.
3. Reuse a fixture when its content fits. The same note under different settings or actions is useful coverage, not duplication. Preserve significant tabs, trailing spaces and line endings.
4. Add scenario data to the existing executor. Reuse `openFixture()`, `waitFor()`, assertions and CLI helpers; do not copy polling loops, setup or cleanup into each rule.
5. Exercise actual application output. Do not import detector functions, manufacture match objects or supply fake parser classifications. If an old synthetic case contradicts Obsidian's parser, document the difference and test the real behaviour instead.
6. Preserve applicable mode/action coverage: detection and fixing run in Source mode and Live Preview; fixes exercise both command and gutter actions. Include negative/default cases and verify persisted contents where relevant.
7. Run `npm test` and `npm run test:cleanup` before removing superseded unit checks. An intentional broken expectation or temporary behavioural mutation should make new coverage fail; CLI success alone is not proof. Update this guide's coverage and migration entries.

Create another suite only for a genuinely different behaviour or UI surface. For example, tests of settings-screen interactions could justify a settings UI suite; checks that a rule defaults to disabled belong with that rule's detection or fixing scenarios.

Keep the layout flat while it remains easy to navigate. If a suite becomes unwieldy, split its scenario definitions into smaller files while retaining one executor. Do not introduce a folder or runner for every setting.

### Migration targets for remaining Node suites

These are destinations for future migrations, not a claim that the remaining coverage is already live. Remove or revise each entry as its migration finishes.

| Existing file under `tests/` | Live destination |
|---|---|
| `settings.test.ts` | Application defaults and disabled-rule behaviour in the relevant detection/fixing scenarios, not a separate settings suite. |
| `styles.test.ts` | Add `editor-layout.sh` when migrating: assert actual gutter positioning and layout, not CSS source strings. This suite does not exist yet. |

`list-ending-fallback.test.ts` deliberately remains Node-only: a fully parsed live editor cannot exercise the no-parser branch. Ten input/expected-output vectors run through the parserless detector, whole-document detector and a real CodeMirror state without a language extension (three tests, 30 combinations). They also preserve match counts/order and simultaneous multi-line fix application. No parser classifications are injected.

`code-point-format.test.ts` retains only the supplementary-code-point formatting assertion (`U+1F47E`). None of Gremlins' detected characters is outside the BMP, so this contract has no real hover/inspection path. Padding and uppercase formatting for supported characters are checked live; no character definitions or match objects are injected to make the supplementary case appear reachable.

## Fixtures and isolation

- Markdown inputs are committed in `fixtures/`, not bundled into the released plugin.
- Each run copies them to the fixed `_gremlins_e2e/` folder through Obsidian's vault API. A fresh copy is restored before each scenario and editor mode.
- This directory is reserved for tests. Existing directories must have the runner's ownership marker and contain only known fixtures; unknown files or symlinks are refused, not deleted.
- Scenarios run sequentially. A vault-local `.gremlins-e2e-lock/` directory prevents simultaneous runners, including from other checkouts.
- The runner saves plugin settings, the exact persisted `data.json` (including whether it existed), indent width and the active tab. It closes test tabs, removes its working directory and restores state after success, failure, Ctrl-C or SIGTERM. If restoration fails, the run fails and retains the lock/recovery snapshot rather than allowing another run against unrestored state.
- Fixtures contain significant tabs and trailing spaces. Do not reformat them. Local EditorConfig/Git attributes protect whitespace and LF line endings; the tests also check important fixture bytes.
- `line-endings-no-final-newline.md` deliberately has no final newline. Its EditorConfig exception and exact-byte assertion preserve that input; detection, combined punctuation/hard-break fixes and sibling separators must not append a newline.

The runner uses a short CLI `eval` call to read temporary JavaScript from the lock directory. Large `code=` arguments triggered malformed CLI IPC messages on Windows Obsidian 1.13.7. Assertions still execute in the actual application, one scenario per call. CLI exit codes alone are not trusted: Obsidian can print an evaluation error and exit zero.

## Coverage

`detect.sh` is the read-only detection suite: 152 scenarios in both Source mode and Live Preview (304 executions). It covers the user-visible behaviour from the former detection, ambiguous-empty-list-marker, match-position, presentation, Markdown-context, list-marker-cleanup and list-item-endings unit tests plus regressions moved out of the tooltip suite. All rules use the same detection executor; no detector functions or fabricated parser classifications are used:

- Unicode grouping, NBSP, typographic defaults/toggles, severity and zero-width styling.
- Cursor inspection at opening/closing boundaries, zero-width characters and adjacent gremlins, including no notice outside a match.
- Mixed indentation, pure tabs/spaces, multiline source offsets and the disabled rule.
- Root/orphaned lists, nested alignment at indent widths 2/4, absolute depth when level-four marker styles cycle, non-list content, literal regions and defaults.
- Ambiguous empty list markers: parent/child and sibling contexts, marker/delimiter widths, blockquotes, literal-region exclusions, defaults and tab widths 2/4/8 (21 scenarios).
- Duplicate markers and marker spacing: unordered/ordered delimiters, tabs, compact nesting, quoted lists, digit limits, overlapping-rule suppression, defaults and literal/thematic/Setext exclusions.
- Missing markers in pasted task lists, tabbed/star-marker contexts, and ordinary continuation text.
- Missing list-item punctuation/hard breaks and semantic-ending exceptions, with both rules enabled together.
- All punctuation policies, per-list/nested inference, first-item ties, formal-list endings, semantic punctuation, parent colons and display-math exemptions.
- Multiline/lazy continuations, tasks, formatting, link labels and targets, block IDs, complete astral characters, escapes, and literal-region exclusions.
- Trailing-whitespace removal, exact hard breaks, empty checkboxes, sibling/subtree/blockquote separators, and Unicode trailing-space combinations.

Checks compare actual highlighted source ranges and inspection notices, then verify that both the editor and saved note remain unchanged. This suite never invokes a fix; editing and no-op fix actions belong in `fix.sh`. Obsidian can split one indentation highlight into several DOM spans; contiguous fragments are compared as a source range, while Unicode grouping is checked separately.

Live Preview replaces inactive Markdown delimiters with rendered content. Detection enters the first expected source range before checking its decoration; fix scenarios can specify a cursor column for the same reason. Assertions still inspect real DOM ranges and real editor/saved text.

Unlike the old parserless indentation examples, `deep-list-indentation.md` and `list-indent-width.md` have real parent lists. Independent root markers are tested as orphaned even at four spaces or one tab; an aligned child is tested separately. `fenced-parent.md` and `tabbed-parent.md` are reused across rules, with different settings and expectations.

The old tabbed empty-marker example without a root list is actually indented code in Obsidian and is retained as a negative fixture. `tabbed-nested-parent.md` adds a real root list to exercise the intended positive tab-width cases. The old parserless checks are represented by real fenced/indented-code documents, not by simulating a missing parser.

`fix.sh` owns user-requested edits and no-op actions: 111 scenarios covering the user-visible behaviour from the former fixing, list-marker-cleanup and list-item-endings unit tests plus unique fix expectations moved out of the detection and tooltip suites. Each starts from a fresh fixture for both the fix command and gutter click, in both editor modes (444 executions). Highlights are preconditions, not a repeat of the detection suite's exact range/style assertions. Checks cover gutter interactivity, the entire document after each edit, persisted file contents, and remaining warnings.

- All 31 currently supported Unicode characters: deletion-only controls (including grouped zero-width spaces), repeated/other Unicode spaces, line/paragraph separators and all six typographic replacements. Unknown astral characters remain untouched.
- Block dedentation from parents and deeper children, preserving nested lists, tabbed delimiters and continuation lines, and respecting blank lines and heading boundaries. Independent roots and mixed ordered/unordered code-shaped blocks are included.
- Combined block/character and block/empty-marker fixes, missing markers (including copying a following star and tabs) and empty-marker delimiters.
- Tab-led and space-led mixed indentation, list rounding at widths 2/4, and the disabled-fixing default.
- No-op actions for disabled detection rules, pure indentation, non-list/literal content, aligned children and ordinary list continuation.
- Empty-marker delimiter insertion across parent widths, blockquotes and tabs at widths 2/4/8; no-op actions for all negative/default empty-marker cases in `detect.sh`.
- Duplicate-marker removal and space/tab normalization, separately and together in one action; retained marker styles and quote prefixes survive. Literal syntax, empty retained markers, valid delimiters, ten-digit prefixes and disabled rules remain untouched.
- Inserting a missing period and two-space hard break together.
- Period/semicolon/removal policies, formal-list punctuation, multiline endpoints, formatted tasks, link labels/targets, escaped punctuation, and inline-code preservation.
- Whitespace and separator edits preserve prose, nested subtrees, blockquote prefixes, block IDs and empty checkboxes; combined Unicode-space fixes leave no overlapping warnings.
- Multiline formulas remain unchanged under every punctuation policy and the hard-break policy. Prose following a formula remains eligible for punctuation.

The old synthetic first-line ambiguous match had no preceding list item. `fix-orphaned-empty-root.md` therefore verifies only a block dedent; `fix-orphaned-empty-siblings.md` supplies real preceding/following siblings for the combined fix. The old one-space misaligned match is exercised as a real orphaned root, while larger misalignments use genuine children. Internal helper-only no-op checks are represented by real unknown-character and disabled-fixing scenarios, not injected match objects.

A blank-line boundary must leave the second block's text untouched. After the first block is dedented, Obsidian can parse that untouched second block as a valid child list, so the test does not invent a remaining orphan warning.

`gremlin-icon.sh` covers the former icon tests and presentation severity selection with 20 live executions: error/warning/info icons, mixed-severity precedence, passive/interactive gutters, and both editor modes. It reuses the Unicode and single-dash tooltip fixtures plus two single-line mixed-severity fixtures and inspects the actual SVG inserted by Obsidian, excluding CodeMirror's invisible spacer. The precedence cases first verify the character severities present, then require error over info/warning, warning over info, and info for a single info match.

Assertions recognize the custom mascot rather than a blank or built-in icon, check its 12–16 px size and viewBox fit, and retain the lightweight geometry limits (at most four paths, SVG body below 1 KB, no gradients/filters). Computed fill/stroke colours must follow the severity token, including when that token changes locally on the marker. The local style is restored without changing the vault theme. This replaces the literal source-transform check with rendered geometry checks and the source-code registration checks with actual rendering.

`editor-tooltip.sh` owns character/structural/gutter hover behaviour: the existing Source-mode duplicate-tooltip checks plus ten boundary and eleven message-content scenarios in both Source mode and Live Preview (42 executions). It uses one hover executor, the runner's `waitFor()` helper and trusted CDP pointer movements. Exact gutter accessibility-label text belongs to `gremlin-icon.sh`; detection/inspection and fixing belong to `detect.sh` and `fix.sh`.

## Presentation migration

The 12 checks formerly in `tests/presentation.test.ts` are covered by live inspection, hover content and gutter severity, except for the single supplementary-code-point assertion retained in `code-point-format.test.ts`. This adds one detection scenario, eleven hover-content scenarios and two icon scenarios (32 live executions), extending existing executors rather than introducing a presentation suite.

| Original assertion | Replacement coverage |
|---|---|
| Code-point padding/case: `U+000B`, `U+200B` | Real inspection notices and hover text from `fix-separators.md` and `zero-width-spaces.md`; leading zeros and uppercase hexadecimal are compared exactly. |
| Five-digit `U+1F47E` is not truncated | Focused Node formatter contract: the plugin does not detect this emoji, so a live formatting assertion would require a fabricated match. |
| Grouped character count/plural and error label | `zero-width-spaces.md`: exact `2 zero-width spaces · Unicode U+200B · Error` hover and inspection text. |
| Mixed indentation description without a code point | `mixed-indentation.md`: exact hover text and existing inspection notice. |
| Two-space malformed child description | `misaligned-leaf.md`: exact `2 leading spaces` hover text; the existing two-space case in `list-indent-width.md` also checks its inspection notice. |
| Orphaned marker description | `root-list-indentation.md`: hover the four-space root and compare the complete orphan-specific warning; existing inspection coverage remains. |
| Missing marker description | `missing-list-marker.md`: exact hover text and existing inspection notice. |
| Ambiguous empty marker description | `parent-child.md`: exact hover text explaining the missing space and potential heading interpretation. |
| Duplicate marker description | `duplicate-markers.md`: exact hover text and existing inspection notice. |
| Marker spacing description | `list-marker-spacing.md`: exact hover text and existing inspection notice. |
| Expected semicolon description | `punctuation-formal.md`: exact semicolon-specific hover text and existing inspection notice. |
| Expected hard-break description | `line-endings-hard-break.md`: exact two-trailing-spaces hover text and existing inspection notice. |
| Severity selection for `[info, error, warning]`, `[info, warning]`, `[info]` | `gutter-mixed-severities.md`, `gutter-warning-info.md` and `tooltips.md`: exact character severity vectors, actual gutter class and computed colour, in passive/interactive states and both editor modes. |

Hover content is compared in full, including punctuation, Unicode labels, severity capitalization and the absence of Unicode text for structural rules. All suites preserve editor and saved contents. Content cases require a trusted pointer on the intended source line; boundary cases additionally retain their exact offset/side assertions. Adjacent zero-width characters can share a pixel, so a content hover may resolve inside the grouped match rather than at its first offset.

`misaligned-leaf.md` has a real parent and a two-space leaf item. In the existing multi-child fixture, Obsidian's fold control covers that indentation and receives the pointer instead of the warning. The leaf fixture makes the same warning directly hoverable without hiding controls or injecting a tooltip.

## Match-position migration

All four checks formerly in `tests/match-position.test.ts` are exercised through real pointer events in `editor-tooltip.sh`, using `character-boundaries.md`. One additional detection scenario runs eight cursor-inspection assertions in each mode. Both suites verify unchanged editor and saved content; neither imports the position helper or creates match objects.

| Original boundary check | Live assertions in each editor mode |
|---|---|
| Visible-width opening, side +1 versus -1 | Hover at NBSP's opening returns its exact tooltip from the right and no tooltip from the left. Inspection at the opening returns the NBSP notice. |
| Zero-width opening, either side | Hover resolves to the actual U+200B opening with side -1 and +1; both show the zero-width-space tooltip. Cursor inspection checks its opening and closing offsets. |
| Visible-width closing, side -1 versus +1 | Hover at NBSP's closing shows its tooltip from the left and nothing from the right. Cursor inspection still finds it through the command's left-side fallback. |
| Adjacent matches selected by pointer side | At the shared NBSP/U+200C boundary, left shows NBSP and right shows the non-joiner. A second pair, NBSP/figure-space, covers two genuinely visible-width characters. Cursor inspection prefers the right-hand match for both pairs. |

The old synthetic NBSP had error severity and its adjacent U+200C inherited `zeroWidth: false`. The fixture uses their genuine warning/zero-width definitions; the figure-space pair preserves ordinary visible-width adjacency coverage. Two cursor positions outside the isolated NBSP must produce no new notice.

Chromium quantizes trusted mouse coordinates to integer CSS pixels. Before each hover case, a subpixel translation aligns only the temporary editor's tested boundary to an integer; this makes side +1 reachable at a zero-width opening without changing character widths or faking pointer-side arguments. The actual event must be trusted and resolve to the intended document offset and side. The transform and event listener are restored after the assertion; the shared runner removes the temporary editor on failure. Negative cases wait past the real hover delay before asserting absence.

## List-item-ending migration

The 44 tests formerly in `tests/list-item-endings.test.ts` are split between the existing live behaviour suites and the focused Node fallback contracts described above. This migration adds 81 detection scenarios and 40 fix/no-op scenarios (322 live executions), including additional formula and formatted-continuation regressions. The existing simultaneous punctuation/hard-break and semantic-ending scenarios are reused.

A follow-up parity audit restored the original dated wikilink targets and the child prose ending in multiple wikilinks; a standalone link remains exempt, but prose ending in a link does not. The blockquote inference check asserts the period-specific inspection notice, not just a warning range. End-of-file input without a final newline is also covered.

Live testing exposed gaps hidden by fabricated/parserless contexts:

- HyperMD omits list depth inside display math. The plugin now retains the item through the actual math delimiters, exempts formula endings, and resumes checking subsequent prose. Formula items still occupy their proper position in formal lists.
- Quoted lists, lazy continuations and indented literal blocks do not consistently expose list tokens. The plugin preserves their real item/quote ownership rather than losing the list or checking an earlier marker line.
- Unindented lazy continuations beginning with inline code or emphasis retain their endpoint; they are not mistaken for literal blocks. Real block syntax is still excluded.

Some old inputs did not mean what their injected contexts claimed:

- A standalone `> 2. continuation` is a valid ordered list. It is now a positive quoted-list scenario, not a manufactured parser rejection.
- The old nested lazy example renders both following lines inside the child. `punctuation-lazy-nested.md` uses deeper child indentation and a blank line before the parent paragraph to test the intended distinct owners; root and quoted lazy continuation cases retain their original inputs.
- A truly root-level fenced block replaces the invented root-literal classification of an indented continuation. Nested fences/comments and root fences are tested separately.
- Separate prose in the trailing-whitespace fixture has a blank separator; without it Obsidian renders that prose as a lazy list continuation.
- The live suite waits for a complete parse. Missing-parser and `unknown`-context detection are checked separately in `list-ending-fallback.test.ts`, using a real CodeMirror state with no language extension rather than fabricated parser classifications.

These distinctions were checked against Obsidian's editor syntax tree and, for lazy ownership, its Reading view output. Fixtures preserve the behaviour under test without manufacturing parser classifications.

## List-marker-cleanup migration

The 16 tests formerly in `tests/list-marker-cleanup.test.ts` are covered by 19 detection scenarios and 14 fix/no-op scenarios in the existing executors (38 detection + 56 fix executions). Both editor modes run; edits and no-ops use both command and gutter actions. No detector imports, fabricated matches or parser classifications are used.

| Original coverage | Live fixtures and assertions |
|---|---|
| First duplicate marker, match properties and source offset | `duplicate-markers.md`: exact highlighted `- ` at offsets 10–12 on line 2, warning/non-zero-width styling and inspection notice. |
| Nested/quoted plus and star styles | `duplicate-quoted-markers.md`: highlighted `+ ` at offsets 24–26; fixing preserves `>   * Item`. |
| Duplicate and spacing exclusions in literal Markdown | `list-marker-literals.md`: original `- - example` and `1.  example` inside a real fence; both rules stay silent and actions do nothing. |
| Three thematic-break variants | `list-marker-thematic-breaks.md`: root dashes, quoted dashes and double-spaced quoted stars; both rules enabled, no edits. |
| Root/quoted potential Setext underlines | `list-marker-setext.md`: two trailing spaces preserved on bare empty items and real heading underlines; no warnings or edits. |
| Empty retained markers | `duplicate-empty-markers.md`: both `- -` and `- -  ` remain intact under duplicate cleanup. |
| Both rules disabled by default | `list-marker-defaults.md`: original `- - Item` and `-  Item`; genuine application defaults checked, no detection or edits. |
| Duplicate fixability and exact removal | `duplicate-markers.md`: interactive gutter and command remove only the first marker/delimiter, preserving the complete surrounding document and saved bytes. |
| Combined duplicate removal and retained spacing | `list-marker-compact.md`: `-  -  Item` has separate non-overlapping duplicate/spacing highlights and becomes `- Item` in one action. |
| Extra spaces after unordered, dot-ordered and parenthesis-ordered markers | `list-marker-spacing.md`: all three original `Detect space` variants, exact delimiter ranges and two-space widths. |
| Tab delimiter versus one ordinary space | `list-marker-tabs.md` and `list-marker-valid.md`: single-tab highlights, tab-to-space fixes and valid-space no-ops. |
| Maximum nine-digit ordered marker | `list-marker-nine-digits.md` and `list-marker-ten-digits.md`: original independent inputs, positive/negative detection and edit/no-op outcomes. |
| Every delimiter in four compact-list forms | `list-marker-compact.md`: original unordered, ordered, quoted and double-delimiter inputs; exact highlight counts/ranges and all four spacing-only outputs. |
| Unordered/ordered delimiter normalization and fixability | `list-marker-spacing.md` and `list-marker-tabs.md`: space/tab replacements via interactive gutters and commands, complete editor/saved results and no remaining warnings. |

Significant trailing spaces, thematic-break spacing and digit-boundary inputs have explicit byte guards. Synthetic literal classifications are replaced with actual fenced Markdown; potential Setext examples additionally exercise real headings. The original nonzero source offsets are retained using real preceding text.

The nine- and ten-digit examples remain separate notes, matching the original separate detector calls. Combining them into one ordered-list note caused Obsidian's native automatic numbering to rewrite the second number during an edit; a plain `editor.replaceRange()` reproduced that independently of Gremlins. The tests keep their original isolated inputs rather than accepting that unrelated edit or changing the vault's numbering settings.

## Markdown-context migration

The 11 checks formerly in `tests/markdown-context.test.ts` are represented by observable detection outcomes and the existing unavailable-parser contract. Three new scenarios (six Source/Live Preview executions) close the depth-four and literal-boundary gaps; the other cases reuse existing scenarios rather than duplicating executors or fixtures. No production code changes were needed.

| Original classification check | Coverage |
|---|---|
| Root list without a parent | `root-list-indentation.md`: indented roots receive orphaned-list highlights and an orphan-specific inspection notice. |
| Nested list level | `deep-list-indentation.md` and `list-indent-width.md`: malformed children receive alignment warnings, while `aligned-list.md` stays unflagged. |
| Absolute depth when styles cycle at level four | `list-context-depth-four.md`: the aligned 12-space child stays unflagged; the 13-space sibling receives a misalignment highlight and notice, not an orphan warning. Obsidian exposes `list-1` styling but `HyperMD-list-line-4` depth for both. |
| Continuation without a marker | `punctuation-multiline.md`: the warning belongs to the final continuation, not the earlier marker line. |
| Inline code on a list continuation | `punctuation-code-continuation.md`: the closing backtick is the item endpoint and receives the punctuation warning. |
| Comments/fences take precedence over list tokens | `list-context-nested-literals.md`: real nested comments/fences contain indented list-shaped text but receive neither indentation nor punctuation warnings; the following real item still requires a period. Existing nested-comment/fence inference scenarios also remain. |
| Blockquote outside literal syntax | `blockquote.md`: the ambiguous hyphen inside the quote is highlighted; `punctuation-ordered-quote.md` checks a quoted ordered item. |
| Parsed plain text remains eligible for detection | `root-siblings.md`: Obsidian exposes only `Document` at the lone hyphen; the ambiguous-marker warning still appears. |
| Parser-recognized indented code | `list-shaped-code.md`: the opt-in indentation rule flags orphaned list shapes; `indented-code.md` remains excluded from punctuation and ambiguous-marker rules. |
| Other inline-code literal content | The standalone inline-code line in `list-context-nested-literals.md` creates no list warning. Existing inline-code and lazy-code scenarios retain the contrasting cases where code belongs to an actual list item. |
| Incomplete/unavailable syntax tree | `list-ending-fallback.test.ts`: a real unparsed CodeMirror state has `syntaxTreeAvailable(...) === false` and returns `unknown` through `getMarkdownListLineContext()`. This guard is not claimed as fully parsed E2E coverage. |

These tests assert rendered ranges, notices and unchanged editor/saved content, not internal classifier labels or fabricated token arrays. The live runner deliberately waits for a complete parse, so the existing focused Node fallback assertion remains necessary.

## Failures and interrupted runs

Failures save the current test note, rendered DOM, syntax tree, evaluation error and captured application/console errors to `test-results/e2e-failure.txt` **before** removing fixtures. This ignored report retains the most recent failure, even after a subsequent successful run. `npm run test:cleanup` also writes its expected-failure log there.

A forced kill or Obsidian crash can prevent cleanup. Do not blindly delete a lock while another runner is active. Once you have confirmed the runner has stopped, inspect `.gremlins-e2e-lock/state.json`: `settings` and `tabSize` contain the saved application options, while `dataPath` and `data` contain the original persisted plugin data (`null` means the file did not exist). Restore them if necessary, remove only `eval.js` and `state.json` from that lock directory, then remove the empty lock directory. The next run safely resets an owned `_gremlins_e2e/` folder. If ownership or file checks fail, inspect the folder rather than bypassing the guard.
