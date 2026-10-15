# e2e bug bash on EAS Simulators

**Date:** 2026-10-15
**Agent:** Claude Opus 5.5
**System:** Expo
**Scope:** Add what an agent needs to run an e2e (TesterArmy) bug bash from
this machine: https://e2e.tester.army/docs/bug-bash.

## Outcome

[observed] Added `e2e@0.21.0`, `@e2e-dev/mobile@0.12.1`,
`@e2e-dev/eas@0.3.1`, `ai@^7`, and `@ai-sdk/anthropic@^4`; `e2e.config.ts`
(one `ios` target on EAS Simulators, the dev-client build, `--initialUrl`
to the tunneled Metro); `e2e.bugbash.config.ts` (budgets, personas, Brooks
context); `e2e/smoke.e2e.ts`; the `e2e-bug-bash` skill; `.e2e/` in
`.gitignore`; `test:e2e` (`e2e run --exclude-tag bugbash`). Both configs
type-check and load in `e2e list`. Nothing ran on a device: no
`development-simulator` build exists yet, and `ANTHROPIC_API_KEY` was not
set in this shell.

## What worked well

- [observed] `npx e2e guide <topic>` prints the installed version's
  procedure, so the skill can defer to it instead of copying it.
- [observed] The setup guide documents the Expo dev-build launch arguments
  (`--initialUrl`, dev-menu flags), which pair with `easSimulators` so the
  bug bash runs on this branch's JavaScript in the cloud.
- [observed] Jacob Hammerle's `employee-onboarding` repo had a working
  `e2e.config.ts` on EAS Simulators to compare against.

## Friction and blockers

- [observed] A `require` in the config failed the guide's ESM rule, and
  `createRequire` from `node:module` failed the app's type check (no Node
  types). A default import of the CommonJS `brand.config.js` worked for both.
- [observed] Spreading the base `agents.default` into a persona failed to
  type-check (a union of agent configs); exporting `model` and `tools` from
  the base config fixed it.

## What was hard

- [inferred] The guide's advice for parallel explorers ("one target per
  device") is about local devices. With a device provider each explorer
  process leases its own hosted session, so one target is enough; this is
  not yet observed.

## Comparative friction

Not observed.

## Improvement ideas

- [inferred] `@e2e-dev/eas` could take a `metroUrl` and set `--initialUrl`
  itself for Expo development builds, or start a session with
  `simulator:start --open-url`.
- [inferred] `e2e init` could offer an "Expo on EAS Simulators" engine choice.

## Follow-ups

- Build the `development-simulator` dev client, set `ANTHROPIC_API_KEY`,
  and run `npx e2e run e2e/smoke.e2e.ts`; then one charter alone before a
  full bug bash.
