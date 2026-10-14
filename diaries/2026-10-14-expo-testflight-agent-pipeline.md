# TestFlight feedback to verified PR pipeline

**Date:** 2026-10-14
**Agent:** Claude Opus 5.5
**System:** Expo
**Scope:** Port the TestFlight feedback → issue → fix PR → verification
pipeline from `jacobhammerle/employee-onboarding` to Brooks.

## Outcome

[observed] Added four EAS workflows (`testflight-feedback`,
`testflight-crash`, `expo-bot-issue`, `expo-bot-verify`), the
`expo-bot-bridge` GitHub Action, eight scripts and five prompts under
`tools/agent/`, and the `eas-simulator-evidence@0.2.2` dev dependency. The
`simulator` build profile now sets `environment: preview` and
`channel: simulator`. Design and setup steps are in
[LLP 0009](../llp/0009-testflight-agent-pipeline.design.md).

[observed] `eas workflow:validate` and the Expo MCP validator accept all four
EAS workflows. All scripts pass `bash -n` and `shellcheck -S warning`. The
verdict helpers give the expected output locally, and `bun run typecheck`
passes. [inferred] Nothing ran end to end: that needs the setup steps in
LLP 0009 (Issues are disabled on the fork, and the secrets are not set).

## What worked well

- [observed] Upstream keeps all logic in scripts and prompt files, with thin
  YAML. Porting was mostly path, identity, and gate changes.
- [observed] Reading the bundle identifier, name, and slug from
  `brand.config.js` in `tools/agent/comment-lib.sh` removed the hard-coded
  bundle identifier from the scripts and prompts.
- [observed] `eas-simulator-evidence --help` documents every flag the
  scripts use, so the flags could be checked without running a session.

## Friction and blockers

- [observed] The evidence tool reads the app name and slug from `app.json`
  by default. Brooks keeps them in `brand.config.js` through
  `app.config.ts`, so the scripts pass `--name` and `--slug`.
- [observed] EAS workflows have a `pull_request_comment` trigger but no
  issue-comment trigger, so a GitHub Action is still needed for
  `@expo-bot` on issues.
- [observed] Upstream gates on `expo lint`; Brooks has no ESLint setup, so
  the gate is the type check alone.

## What was hard

- [inferred] The `fingerprint` job's environment must match the build
  profile's environment, or `get-build` never finds a match and every run
  builds a new binary. The `simulator` profile had no environment, so it
  got `preview` explicitly.

## Comparative friction

Not observed.

## Improvement ideas

- [inferred] An EAS issue-comment trigger would remove the GitHub Action
  and the second `EXPO_TOKEN` secret.
- [inferred] `eas-simulator-evidence` could read the resolved app config
  (`expo config --json`) instead of `app.json`, so dynamic configs work
  without extra flags.

## Follow-ups

- Complete the setup steps in LLP 0009, then run `expo-bot-issue.yml` by
  hand on a test issue before relying on the TestFlight trigger.
- [observed] `updates.url` in `app.json` pointed to the old project
  `9510f33f-…` after the identity change to `keithco`. It now matches the
  `projectId` `5db41437-…`.
