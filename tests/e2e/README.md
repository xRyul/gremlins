# Live Obsidian tests

`npm test` tests the built Gremlins plugin inside a running Obsidian vault. Scenarios use real Markdown files, Obsidian's parser, rendered editor elements, commands and pointer events. Setup uses application APIs through the official CLI; assertions check application output rather than importing detector functions or manufacturing match objects.

## Running the tests

From the repository root:

```sh
npm ci                  # Install dependencies once
npm test                # Typecheck, build/deploy, then run the live suites
npm run test:cleanup    # Verify recovery from an intentional application error
npm run test:unit       # The two intentional Node-only test files
npm run build           # Node checks, typecheck and build; no live tests
npm run lint
```

`npm run test:obsidian` is the explicit alias used by `npm test`. Unit and cleanup checks are separate commands; passing a build is not a substitute for live verification.

### Requirements

- Node.js and Bash, plus desktop Obsidian with its official `obsidian` CLI enabled. The runner uses `eval` and `dev:*` commands.
- A disposable vault named `plugin-testing-vault`, with Gremlins installed and enabled.
- The main testing-vault window visible and focused. A detached Settings window can receive inspection notices instead and cause timeouts.
- No manual editing, competing test run or development watcher while the tests run. The runner builds and deploys the current source itself.

To select another disposable vault or CLI executable:

```sh
OBSIDIAN_TEST_VAULT_NAME="My Test Vault" OBSIDIAN_CLI="/path/to/obsidian" npm test
```

The same environment variables apply to `npm run test:cleanup`. The runner asks Obsidian for the selected vault's name and filesystem path, verifies the name, and deploys to that path. The fresh plugin build remains installed after testing; cleanup restores settings and test data, not the previous plugin bundle.

## Organisation

Group tests by observable behaviour, not by setting, source function or former unit-test filename.

| File | Responsibility |
|---|---|
| [run.sh](run.sh) | Shared lifecycle: deployment, CLI transport, locking, fixtures, application helpers, diagnostics and restoration. |
| [detect.sh](detect.sh) | Read-only detection: exact highlight ranges, grouping, severity, zero-width styling, rule defaults/toggles, exclusions and cursor-inspection notices. |
| [fix.sh](fix.sh) | Command and gutter-click edits, combined fixes and no-ops. Checks the complete document, saved contents and remaining warnings. Highlights are preconditions, not repeated detection assertions. |
| [editor-layout.sh](editor-layout.sh) | Actual gutter geometry, line-number/folding coexistence, marker alignment, no added layout width and restoration when the gutter is disabled. |
| [gremlin-icon.sh](gremlin-icon.sh) | Rendered mascot identity, geometry, size, severity precedence, colour inheritance and accessibility labels. Excludes CodeMirror's hidden spacer icon. |
| [editor-tooltip.sh](editor-tooltip.sh) | Hover messages, opening/closing boundaries, zero-width and adjacent matches, and prevention of duplicate tooltips. |
| [settings-tab.sh](settings-tab.sh) | Settings-page grouping, retained values, control persistence and the gutter/click-to-fix dependency. |
| [check-cleanup.sh](check-cleanup.sh) | Deliberately fail after setup and verify that fixture files, lock, test globals, settings, persisted data, editor options and the active tab are restored. |
| [fixtures/](fixtures/) | Committed Markdown inputs. Settings and expected results belong in the suite's scenario definitions. Fixtures are not bundled into the released plugin. |

Suites are sourced by `run.sh`; do not run them as standalone scripts or give them separate setup/cleanup code. Detection never invokes fixes. Non-editing suites verify unchanged editor and saved contents. Setting defaults belong with the relevant detection or fixing behaviour, not in a separate settings UI suite.

### Coverage

Detection and fixing cover Unicode characters, mixed/list indentation, missing/duplicate/ambiguous list markers, marker spacing, list punctuation and line endings. Scenarios include defaults, disabled rules, valid inputs, literal Markdown exclusions, combined rules and boundary cases.

- Detection runs in **Source mode and Live Preview**, including exact inspection messages and positions outside matches where no notice should appear.
- Fixing starts from a fresh fixture for **each mode and each action**: `gremlins:fix-current-line` and a click dispatched to the real gutter marker. Success requires the expected complete document and persisted contents, not merely a command return value.
- Layout runs in **both editor modes and LTR/RTL**, with line numbers, folding and custom/fallback folding offsets. Measurements must settle and allow 0.5 CSS px for rounding.
- Icon checks run in **both modes with passive and interactive gutters**. Colour probes are local to the marker and restored afterward.
- Tooltip boundary/content scenarios run in **both modes** using trusted CDP pointer events, alongside a Source-mode character/gutter duplicate-tooltip check.

Scenario definitions and the runner's `PASS` output are the source of truth for execution counts. The README does not maintain a second scenario inventory or migration ledger.

## Fixtures and isolation

The repository's `fixtures/*.md` files are the originals. The vault's fixed `_gremlins_e2e/` directory contains disposable working copies; there are no per-run fixture directories.

### Run lifecycle

1. Verify the target vault and enabled plugin. Acquire the vault-local `.gremlins-e2e-lock/` so another checkout cannot run against the same vault concurrently.
2. Refuse an existing fixture directory unless it has the expected `.gremlins-e2e-owner` marker and only known fixture files. Unexpected files, subdirectories or symlinks are not silently deleted.
3. Save plugin settings, the exact persisted `data.json` contents or its absence, the active tab ID and editor options: `tabSize`, `showLineNumber`, `foldHeading`, `foldIndent` and `rightToLeft`. Write the recovery snapshot to `.gremlins-e2e-lock/state.json`.
4. Build and copy the plugin to the selected vault. Start debugger capture as needed, clear captured errors/console messages, and reload Gremlins with empty saved settings to obtain genuine application defaults.
5. Create fixture copies through Obsidian's vault API. Before each scenario, reset its file from the original, apply defaults plus scenario settings, and select the editor mode and tab width.
6. Wait for the expected text, complete parsing and viewport readiness. Run assertions sequentially; newly captured application or console errors fail the run.
7. On success, failure, Ctrl-C or SIGTERM, attempt cleanup: save and close test tabs, delete the owned fixture directory and test globals, restore settings/persisted data/editor options, and reactivate the previous tab if it still exists. Detach the debugger if this run attached it, then remove the lock.

Cleanup failures fail the run and retain the lock/recovery snapshot. A forced kill or an Obsidian crash can prevent cleanup; see [Failures and interrupted runs](#failures-and-interrupted-runs).

### Preserve fixture bytes

Tabs, invisible characters, trailing spaces and EOF newlines are test data. Do not run a formatter over fixtures. Their [.editorconfig](fixtures/.editorconfig) and [.gitattributes](fixtures/.gitattributes) preserve LF endings and significant whitespace; suites also guard important input bytes.

`line-endings-no-final-newline.md` intentionally has no final newline. Its punctuation, hard-break and sibling-separator tests must not append one. Keep the nine- and ten-digit ordered-marker examples in separate files: combining them allows Obsidian's automatic numbering to rewrite the second example during edits.

## Adding coverage

1. Find the behaviour owner above and check for an existing equivalent scenario. Extend its data and reuse fixtures before adding another suite or executor.
2. Put new Markdown inputs in `fixtures/`. Keep files small enough for `openFixture()` to expose the whole document in the viewport. Preserve significant bytes and add explicit input checks when accidental formatting would change the case.
3. Add explicit expected outcomes to the existing scenario definitions. Include positive, negative and default/disabled cases as appropriate. Do not derive expected results by calling the implementation under test.
4. Reuse the application helpers on `window.__gremlinsE2E`:
   - `openFixture(name, mode, settings, tabSize, line)` resets the note and settings, opens the editor and waits for readiness. Modes are `source` and `live`; line positions are zero-based.
   - `waitFor(check, message)` requires repeated successful observations within a bounded wait.
   - `highlights(kind)` reads actual rendered ranges, text, severity and zero-width styling.
   - `assert(condition, message)` throws an application error that the runner treats as failure.
5. Use the runner's `obsidian_eval` and `obsidian_command` wrappers. Obsidian can return exit code zero after a JavaScript exception, so shell exit status alone is insufficient. Long JavaScript payloads go through the lock directory's temporary `eval.js` file to avoid Windows CLI IPC limits.
6. Preserve the suite's mode/action matrix and verify saved contents. Wait for readiness before accepting an absence of warnings; an unparsed or offscreen note is not a valid negative result. Restore any scenario-local styles or listeners in `finally`.
7. Run the live suite and cleanup check, plus Node/build/lint checks. Temporarily break an expectation or behaviour to prove the new assertion fails, then revert the deliberate change. If replacing coverage, compare all original input variants and assertions before deleting it.

Add a new suite only for a distinct behaviour or UI surface. If a suite's data becomes unwieldy, split the scenario definitions while retaining one executor. Do not add a runner or folder per rule.

### Parser and rendering details

These details matter when extending the tests:

- **Use actual Markdown semantics.** A tab-indented list shape without a parent can be indented code. Lazy continuation text can belong to a preceding child, and a quoted ordered marker can be a real list item. Check the app's parse/output rather than supplying a desired classifier label. Document any necessary change to an existing input or expectation.
- **Preserve structural boundaries.** Fixes must retain unrelated prose, blank-line boundaries, nested subtrees, quote prefixes, links and block IDs. Formula-ending list items require neither added punctuation nor a hard break; subsequent prose remains eligible for checking.
- **Expose source delimiters in Live Preview.** Detection moves the cursor into the first expected range; fix scenarios can set a cursor column. Do not remove rendering or fabricate highlights to make assertions easier.
- **Compare source ranges, not incidental DOM fragments.** Obsidian can split indentation decorations across multiple spans. Detection joins contiguous structural fragments while retaining separate Unicode-grouping assertions.
- **Target real hover boundaries.** Chromium quantizes trusted pointer coordinates. Tooltip tests temporarily align the disposable editor's boundary to an integer pixel, verify the event's trust and intended offset/side, then restore the transform/listener. Content cases require the intended source line and exact message; negative cases wait past the hover delay.

## Remaining Node-only contracts

Two files intentionally remain outside E2E. They are four Node tests, not unfinished migrations:

| File | Why it stays in Node |
|---|---|
| [list-ending-fallback.test.ts](../list-ending-fallback.test.ts) | Eleven input/output vectors run through parserless detection, whole-document detection and a real CodeMirror state without a language extension: three tests, 33 combinations. They check unavailable syntax, warning counts/order and simultaneous multi-line fixes. The live runner waits for complete parsing and therefore does not exercise this fallback. No parser classifications are injected. |
| [code-point-format.test.ts](../code-point-format.test.ts) | One assertion preserves the five-digit `U+1F47E` representation. No currently detected character is outside the Basic Multilingual Plane, so there is no real hover/inspection path for it. Supported-character padding and uppercase formatting are tested live. |

Running these helpers through `obsidian eval` would relocate the unit tests, not make them E2E. Keep them as explicit internal contracts; do not inject character definitions or fake matches to manufacture a UI path.

## Failures and interrupted runs

After fixture setup, a failed run writes `test-results/e2e-failure.txt` in the repository **before cleanup**. It captures the evaluation error, active test path and text, syntax tree, rendered DOM, and application/console errors where available. Reports are ignored by Git. The most recent failure remains after a later successful run, so check the current command output before treating an old report as a new failure.

`npm run test:cleanup` deliberately throws in Obsidian, expects the runner to fail, then compares the before/after state and checks for leftover fixtures, lock and test globals. Its log is `test-results/cleanup-check.log`; it also replaces the failure report with the intentional failure's diagnostics.

For timeouts, first confirm the testing-vault window is visible and focused, the note is fully rendered, and no other window or plugin is intercepting the interaction. Inspect the report rather than weakening an assertion or hiding the target behind test-only replacements.

### Recovering a retained lock

There is no automatic force-unlock command. After an application crash, forced kill or failed restoration:

1. Confirm that no runner is still using the vault. Do not delete an active lock.
2. Inspect the vault's `.gremlins-e2e-lock/state.json` before removing it. Restore `settings` and `editorOptions` if needed; `leafId` identifies the previously active tab.
3. Restore the original persisted plugin data at `dataPath` from the exact `data` string. A `null` value means the file did not exist and should be absent after recovery. Do not discard the snapshot until restoration is complete.
4. Save/close leftover test tabs and remove any lingering `window.__gremlinsE2E` state. If the crash left debugger capture attached, review that state too.
5. Remove only `eval.js` and `state.json` from the lock directory, then remove the empty directory. The next run can reset an owned `_gremlins_e2e/` folder safely. If ownership or file checks fail, inspect the contents instead of bypassing the guard.
