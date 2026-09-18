# Live Obsidian tests

```sh
npm test                 # Typecheck, then test the built plugin in Obsidian
npm run test:cleanup     # Deliberately throw in the app and verify failure cleanup
npm run test:unit        # Remaining Node-only tests; not a substitute for npm test
```

Requires desktop Obsidian with its official `obsidian` CLI enabled and Gremlins enabled in `plugin-testing-vault`. Keep the vault window visible and do not edit it while tests run. The runner builds and copies the current plugin itself; there is no need to run `npm run dev` alongside it.

`OBSIDIAN_TEST_VAULT_NAME` selects another disposable testing vault; `OBSIDIAN_CLI` overrides the CLI executable. The runner verifies the returned vault name before making changes. `npm run build` remains an offline build with Node checks; run `npm test` for live verification.

## Fixtures and isolation

- Markdown inputs are committed in `fixtures/`, not bundled into the released plugin.
- Each run copies them to the fixed `_gremlins_e2e/` folder through Obsidian's vault API. A fresh copy is restored before each scenario and editor mode.
- This directory is reserved for tests. Existing directories must have the runner's ownership marker and contain only known fixtures; unknown files or symlinks are refused, not deleted.
- Scenarios run sequentially. A vault-local `.gremlins-e2e-lock/` directory prevents simultaneous runners, including from other checkouts.
- The runner saves plugin settings, the exact persisted `data.json` (including whether it existed), indent width and the active tab. It closes test tabs, removes its working directory and restores state after success, failure, Ctrl-C or SIGTERM. If restoration fails, the run fails and retains the lock/recovery snapshot rather than allowing another run against unrestored state.
- Fixtures contain significant tabs and trailing spaces. Do not reformat them. Local EditorConfig/Git attributes protect whitespace and LF line endings; the tests also check important fixture bytes.

The runner uses a short CLI `eval` call to read temporary JavaScript from the lock directory. Large `code=` arguments triggered malformed CLI IPC messages on Windows Obsidian 1.13.7. Assertions still execute in the actual application, one scenario per call. CLI exit codes alone are not trusted: Obsidian can print an evaluation error and exit zero.

## Coverage

`ambiguous-empty-list-marker.sh` replaces the former Node-only test file. Its 21 scenarios run in both Source mode and Live Preview (42 executions). They verify real parser/rendering results, warning ranges, gutter fixes, persisted file contents, negative cases, defaults and tab widths 2/4/8. No detector functions or fabricated parser classifications are used.

The old tabbed example without a root list is actually indented code in Obsidian and is retained as a negative fixture. `tabbed-nested-parent.md` adds a real root list to exercise the intended positive tab-width cases. The old parserless checks are represented by real fenced/indented-code documents, not by simulating a missing parser.

`editor-tooltip.sh` retains the live character/gutter tooltip and list-ending regression checks using the same fixture lifecycle.

## Failures and interrupted runs

Failures save the current test note, rendered DOM, syntax tree, evaluation error and captured application/console errors to `test-results/e2e-failure.txt` **before** removing fixtures. This ignored report retains the most recent failure, even after a subsequent successful run. `npm run test:cleanup` also writes its expected-failure log there.

A forced kill or Obsidian crash can prevent cleanup. Do not blindly delete a lock while another runner is active. Once you have confirmed the runner has stopped, inspect `.gremlins-e2e-lock/state.json`: `settings` and `tabSize` contain the saved application options, while `dataPath` and `data` contain the original persisted plugin data (`null` means the file did not exist). Restore them if necessary, remove only `eval.js` and `state.json` from that lock directory, then remove the empty lock directory. The next run safely resets an owned `_gremlins_e2e/` folder. If ownership or file checks fail, inspect the folder rather than bypassing the guard.
