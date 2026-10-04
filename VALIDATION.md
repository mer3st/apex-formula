# Publication checks

Checked on 2026-10-04.

- 28 JavaScript files passed Node syntax checks; local ES module imports resolved.
- Node test suite: 134 passed, 1 failed, 135 total.
- Remaining failure: `tests/handling-feel.test.mjs`, "fresh pedal presses respond
  within a short tap without an instant force step": a 180 ms gas tap did not
  meet the expected usable-power threshold. Physics was preserved from the
  installed snapshot; this publication does not fix that behavior.
- Browser smoke check: menu rendered, RACE NOW entered a rendered 3D race,
  race timer advanced, and no console errors were captured.
- Lockfile-only dependency install completed; npm audit reported 0 vulnerabilities
  at check time. This is not a guarantee of future security.
- Pattern scan found no matching private keys, common service tokens, credential
  assignments, or local user paths in the initial publication files.
- Compiled executables, archives, backups, profiles and diagnostics are excluded.
- Desktop installation and portable executable building were not tested with the
  newly pinned tooling. No executable release is included in this publication.

Installed baseline SHA-256:
`b70f899a6f0c2ec1aa9c655c81f2b13dfb92cc7ca4d68e7133a3e7b608afbed5`
