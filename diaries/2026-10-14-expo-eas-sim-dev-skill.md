# EAS Simulator dev skill and the agent-validate label

**Date:** 2026-10-14
**Agent:** Claude Opus 5.5
**System:** Expo
**Scope:** A skill for live development on EAS Simulator with Metro, the
Expo tunnel, and argent; one shared session script for CI and local runs;
an `agent-validate` PR label that starts the CI verification.

## Outcome

[observed] Added `tools/agent/sim-session.sh` (dev-build lookup, tunnel URL,
session start and wait, argent pass-through, `argent link`, evidence page,
stop) and `.claude/skills/eas-sim-dev/SKILL.md`. The CI scripts now start
sessions and build evidence pages through the same script. `eas.json` has a
`development-simulator` profile. `expo-bot-verify.yml` has a
`pull_request_labeled` trigger for `agent-validate`; `eas workflow:validate`
accepts it. LLP 0009 has new sections for the session script, the local loop,
and the label.

[observed] Tested locally: `sim-session.sh dev-build` computes the iOS
fingerprint and reports that no `development-simulator` build exists yet.
`sim-session.sh metro-url` read `https://c-keithco-….on.expo.app` from a
Metro started with `EXPO_UNSTABLE_TUNNEL_V2=1 bunx expo start --tunnel`, and
the manifest answered over https (HTTP 200). `simulator:availability` is
`true` for `keithco`. [inferred] No simulator session was started, so the
start, argent, link, and evidence commands are not run end to end yet.

## What worked well

- [observed] The official `eas-simulator` skill's Mode C, Method 1
  (`simulator:start --build-id … --launch-arg … --open-url …`) fits argent
  sessions too, so the session needs no launcher taps.
- [observed] `eas fingerprint:generate --build-profile` plus `build:list
  --fingerprint-hash --build-profile` finds a dev-client build by profile.
  `--build-fingerprint` on `simulator:start` could pick a release build
  with the same native fingerprint, so the script passes `--build-id`.

## Friction and blockers

- [observed] Metro's manifest reports the tunnel launch asset as `http://`;
  the official skill builds the dev-client URL with `https://`. Both answer,
  so the script prints `https`.
- [observed] `CI=1 expo start` disables the file watcher ("reloads are
  disabled"), which would silently break Fast Refresh in a background
  Metro. The skill says not to set it.

## What was hard

- [inferred] Keeping one session code path for CI (release build, repacked
  JS, no Metro) and local work (dev build, tunnel, launch args) without
  forking the script. Flags (`--dev`, `--open-url`) cover the difference.

## Comparative friction

Not observed.

## Improvement ideas

- [inferred] `simulator:start --json` could print the device udid, so argent
  users do not need a `list-devices` round trip.
- [inferred] The official skill says to use the app `scheme` for the
  dev-client link; Expo CLI prints `exp+<slug>://` for the same purpose.
  The skill could name both.

## Follow-ups

- Build the first `development-simulator` binary, then run the skill once
  end to end, including `link` with the argent MCP server.
- Connect the GitHub repository to the EAS project and create the
  `agent-validate` label (LLP 0009, Setup).
