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
| `list-item-endings.test.ts` | Recognition and policy exclusions in `detect.sh`; punctuation/line-ending edits in `fix.sh`. |
| `list-marker-cleanup.test.ts` | Duplicate-marker and spacing detection in `detect.sh`; removal/normalisation in `fix.sh`. |
| `markdown-context.test.ts` | Real Markdown fixtures and their detection outcomes in `detect.sh`. |
| `match-position.test.ts` | Cursor inspection in `detect.sh`; hover-boundary behaviour in `editor-tooltip.sh`. |
| `presentation.test.ts` | Actual inspection notices, tooltip content or icon severity, according to the visible output being checked. |
| `settings.test.ts` | Application defaults and disabled-rule behaviour in the relevant detection/fixing scenarios, not a separate settings suite. |
| `styles.test.ts` | Add `editor-layout.sh` when migrating: assert actual gutter positioning and layout, not CSS source strings. This suite does not exist yet. |


## Fixtures and isolation

- Markdown inputs are committed in `fixtures/`, not bundled into the released plugin.
- Each run copies them to the fixed `_gremlins_e2e/` folder through Obsidian's vault API. A fresh copy is restored before each scenario and editor mode.
- This directory is reserved for tests. Existing directories must have the runner's ownership marker and contain only known fixtures; unknown files or symlinks are refused, not deleted.
- Scenarios run sequentially. A vault-local `.gremlins-e2e-lock/` directory prevents simultaneous runners, including from other checkouts.
- The runner saves plugin settings, the exact persisted `data.json` (including whether it existed), indent width and the active tab. It closes test tabs, removes its working directory and restores state after success, failure, Ctrl-C or SIGTERM. If restoration fails, the run fails and retains the lock/recovery snapshot rather than allowing another run against unrestored state.
- Fixtures contain significant tabs and trailing spaces. Do not reformat them. Local EditorConfig/Git attributes protect whitespace and LF line endings; the tests also check important fixture bytes.

The runner uses a short CLI `eval` call to read temporary JavaScript from the lock directory. Large `code=` arguments triggered malformed CLI IPC messages on Windows Obsidian 1.13.7. Assertions still execute in the actual application, one scenario per call. CLI exit codes alone are not trusted: Obsidian can print an evaluation error and exit zero.

## Coverage

`detect.sh` is the read-only detection suite: 47 scenarios in both Source mode and Live Preview (94 executions). It covers the former detection and ambiguous-empty-list-marker unit tests plus list-ending regressions moved out of the tooltip suite. All rules use the same detection executor; no detector functions or fabricated parser classifications are used:

- Unicode grouping, NBSP, typographic defaults/toggles, severity and zero-width styling.
- Mixed indentation, pure tabs/spaces, multiline source offsets and the disabled rule.
- Root/orphaned lists, nested alignment at indent widths 2/4, non-list content, literal regions and defaults.
- Ambiguous empty list markers: parent/child and sibling contexts, marker/delimiter widths, blockquotes, literal-region exclusions, defaults and tab widths 2/4/8 (21 scenarios).
- Missing markers in pasted task lists, tabbed/star-marker contexts, and ordinary continuation text.
- Missing list-item punctuation/hard breaks and semantic-ending exceptions, with both rules enabled together.

Checks compare actual highlighted source ranges and inspection notices, then verify that both the editor and saved note remain unchanged. This suite never invokes a fix; editing and no-op fix actions belong in `fix.sh`. Obsidian can split one indentation highlight into several DOM spans; contiguous fragments are compared as a source range, while Unicode grouping is checked separately.

Unlike the old parserless indentation examples, `deep-list-indentation.md` and `list-indent-width.md` have real parent lists. Independent root markers are tested as orphaned even at four spaces or one tab; an aligned child is tested separately. `fenced-parent.md` and `tabbed-parent.md` are reused across rules, with different settings and expectations.

The old tabbed empty-marker example without a root list is actually indented code in Obsidian and is retained as a negative fixture. `tabbed-nested-parent.md` adds a real root list to exercise the intended positive tab-width cases. The old parserless checks are represented by real fenced/indented-code documents, not by simulating a missing parser.

`fix.sh` owns user-requested edits and no-op actions: 57 scenarios covering the former `tests/fix.test.ts` checks plus unique fix expectations moved out of the detection and tooltip suites. Each starts from a fresh fixture for both the fix command and gutter click, in both editor modes (228 executions). Highlights are preconditions, not a repeat of the detection suite's exact range/style assertions. Checks cover gutter interactivity, the entire document after each edit, persisted file contents, and remaining warnings.

- All 31 currently supported Unicode characters: deletion-only controls (including grouped zero-width spaces), repeated/other Unicode spaces, line/paragraph separators and all six typographic replacements. Unknown astral characters remain untouched.
- Block dedentation from parents and deeper children, preserving nested lists, tabbed delimiters and continuation lines, and respecting blank lines and heading boundaries. Independent roots and mixed ordered/unordered code-shaped blocks are included.
- Combined block/character and block/empty-marker fixes, missing markers (including copying a following star and tabs) and empty-marker delimiters.
- Tab-led and space-led mixed indentation, list rounding at widths 2/4, and the disabled-fixing default.
- No-op actions for disabled detection rules, pure indentation, non-list/literal content, aligned children and ordinary list continuation.
- Empty-marker delimiter insertion across parent widths, blockquotes and tabs at widths 2/4/8; no-op actions for all negative/default empty-marker cases in `detect.sh`.
- Inserting a missing period and two-space hard break together.

The old synthetic first-line ambiguous match had no preceding list item. `fix-orphaned-empty-root.md` therefore verifies only a block dedent; `fix-orphaned-empty-siblings.md` supplies real preceding/following siblings for the combined fix. The old one-space misaligned match is exercised as a real orphaned root, while larger misalignments use genuine children. Internal helper-only no-op checks are represented by real unknown-character and disabled-fixing scenarios, not injected match objects.

A blank-line boundary must leave the second block's text untouched. After the first block is dedented, Obsidian can parse that untouched second block as a valid child list, so the test does not invent a remaining orphan warning.

`gremlin-icon.sh` replaces both checks in `tests/gremlin-icon.test.ts` with 12 live executions: error/warning/info icons, passive/interactive gutters, and both editor modes. It reuses the Unicode and typographic fixtures and inspects the actual SVG inserted by Obsidian, excluding CodeMirror's invisible spacer.

Assertions recognize the custom mascot rather than a blank or built-in icon, check its 12–16 px size and viewBox fit, and retain the lightweight geometry limits (at most four paths, SVG body below 1 KB, no gradients/filters). Computed fill/stroke colours must follow the severity token, including when that token changes locally on the marker. The local style is restored without changing the vault theme. This replaces the literal source-transform check with rendered geometry checks and the source-code registration checks with actual rendering.

`editor-tooltip.sh` owns only character/gutter hover behaviour in Source mode: the intended tooltip appears without an additional Obsidian or browser-native tooltip. It uses the runner's `waitFor()` helper, retaining retries of the actual hover gesture. Exact gutter accessibility-label text belongs to `gremlin-icon.sh`; list-ending detection and fixing belong to `detect.sh` and `fix.sh`.

## Failures and interrupted runs

Failures save the current test note, rendered DOM, syntax tree, evaluation error and captured application/console errors to `test-results/e2e-failure.txt` **before** removing fixtures. This ignored report retains the most recent failure, even after a subsequent successful run. `npm run test:cleanup` also writes its expected-failure log there.

A forced kill or Obsidian crash can prevent cleanup. Do not blindly delete a lock while another runner is active. Once you have confirmed the runner has stopped, inspect `.gremlins-e2e-lock/state.json`: `settings` and `tabSize` contain the saved application options, while `dataPath` and `data` contain the original persisted plugin data (`null` means the file did not exist). Restore them if necessary, remove only `eval.js` and `state.json` from that lock directory, then remove the empty lock directory. The next run safely resets an owned `_gremlins_e2e/` folder. If ownership or file checks fail, inspect the folder rather than bypassing the guard.
