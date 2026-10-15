# Change the weekly challenge to 10K, with no hardcoded goal

**Date:** 2026-10-15
**Agent:** Claude Opus 5.5 (Claude Code)
**System:** Expo
**Scope:** Change the weekly running goal from 5 km to 10 km, then make the
goal and its labels a JavaScript-only change, as the user asked.

## Outcome

`WEEKLY_GOAL_METERS` is 10,000, and `WEEKLY_GOAL` derives the title, badge
text and distance label from it. Screens, route titles, the widget (through
its props) and the badges read those labels. The badge PNGs are text-free
frames, and the widget gallery name is the goal-neutral "Weekly Challenge".
Challenge tests pass (10/10) and `tsc --noEmit` is clean. See
[LLP 0008](../llp/0008-us-run-club-promotions.research.md#the-goal-is-javascript-only).

## What worked well

- One constant already drove completion, share and remaining distance. The
  tests caught every hard-coded distance expectation.
- `expo-widgets` sends the widget layout from the app's JavaScript at runtime,
  so most widget copy was never native. `ZStack` is supported by the widget
  renderer (`DynamicView.swift`), so text can sit over an image frame.

## Friction and blockers

- The worktree had no `node_modules`; tests failed with "Cannot find package
  'react'" until `bun install --frozen-lockfile`.
- The first pass changed the widget `displayName` to "Weekly 10K". That changed
  the native fingerprint, so no dev-client build matched and the `eas-sim-dev`
  loop needed a 15-20 minute build. The user then asked for a design where the
  name can change without a native build. The build was cancelled during upload.
- The badge PNGs had "5K" drawn into them and were white on transparent, so
  they had to be composited onto navy to inspect. The repo has no source for
  them; they were redrawn with a short AppKit script from the `badge.tsx`
  geometry.

## What was hard

- Knowing which widget parts are native. Only the config plugin's
  `displayName` is; layout, copy and badge images come from JavaScript.
- The App Group copy never replaces an existing file, so a changed image needs
  a new file name.

## Comparative friction

Not observed.

## Improvement ideas

- `expo-widgets` docs could state which widget properties need a native build
  (gallery name, families) and which ship with JavaScript (layout, images).
- `expo-widgets` could document an asset-versioning pattern for App Group copies.
- A fingerprint diff that names the changed config key would make the cause of
  a "no matching build" result clear at once.
