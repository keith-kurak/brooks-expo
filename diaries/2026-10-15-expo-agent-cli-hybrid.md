# Favor the Expo Agent CLI, alongside the argent session tooling

**Date:** 2026-10-15
**Agent:** Claude Opus 5.5
**System:** Expo
**Scope:** Tell agents to favor `npx @expo/agent-cli` for Expo commands,
without breaking the argent-based `eas-sim-dev` loop.

## Outcome

[observed] AGENTS.md has a new "Expo commands" section: agent-cli for
`status`, `install`, `typecheck`, `doctor`, `start`, `runtime:reload |
errors | tree`, and `feedback`; not `dev --ios`, `smoke`, or `--eas`. The
`eas-sim-dev` and `eas-sim-preview` skills, the SessionStart hook,
`MEMORY.md`, and LLP 0009 ("The Expo Agent CLI") follow it. The user chose
this hybrid over agent-cli owning the session.

## What worked well

- [observed] `npx @expo/agent-cli help <command>` answers flags, JSON keys,
  and exit codes without running anything, and `dev --plan` and `status`
  show what a run would do.
- [observed] `EXPO_UNSTABLE_TUNNEL_V2=1 npx @expo/agent-cli start --
  --tunnel --port 8096` gave a working `https://<id>.on.expo.app` tunnel.

## Friction and blockers

- [observed] `dev --ios --plan` for this project plans `expo prebuild` and
  a local `expo run:ios` build because Xcode is installed, and drops
  `--tunnel`. A cloud-only loop cannot use `dev --ios` here.
- [observed] agent-cli's `--eas` commands drive only `agent-device`
  sessions (package source, 1.0.18), so they cannot share an argent
  session with `sim-session.sh`.
- [observed] `sim-session.sh metro-port` ended silently on the first free
  port: `lsof` exits 1 there, and `pipefail` with `set -e` stopped the
  script. Fixed with `|| true`; it now also prefers a tunneled Metro.
- [observed] `agent-cli start` printed an `exp+brooks-expo://` dev-client
  link (from the folder or package name); Expo CLI uses
  `exp+ecommerce-demo://` (the slug).

## What was hard

- [inferred] Two tools that each own "the EAS Simulator session" with
  different controller types. The split by responsibility (agent-cli for
  the project and the runtime, sim-session.sh for the session) avoids two
  billed sessions.

## Comparative friction

Not observed.

## Improvement ideas

- [inferred] agent-cli `--eas` could accept an argent session for the
  commands that only need Metro (`runtime:reload`), or take
  `--session-id`, so per-worktree sessions are explicit.
- [inferred] `dev --ios --eas --no-build` or a "serve only, tunneled"
  plan would cover projects that build on EAS while Xcode is installed.
- [inferred] `start`'s suggested dev-client link should use the app
  config slug, as Expo CLI does.

## Follow-ups

- Observe `runtime:reload` and `runtime:errors` against a cloud app
  connected through the tunnel (first `eas-sim-dev` run).
