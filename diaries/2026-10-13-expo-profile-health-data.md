# Profile health data

**Date:** 2026-10-13
**Agent:** Codex / GPT-6.1
**System:** Expo
**Scope:** A minimal Profile screen with live health data and example previews.

## Outcome

[confirmed — user] Real data is the default, with an option to preview examples.
[observed] Profile now pushes Your health using native navigation. The screen
reads the existing Apple Health or Health Connect adapter for seven days of
workouts and steps. It shows distance, workout time, elevation, average steps
and recent activity. Sleep, resting heart rate and active energy appear only
as labeled examples. See [LLP 0005](../llp/0005-activity-informed-finder.design.md#profile-health-summary).

## What worked well

[observed] The shared native summary shapes needed no native changes or added
permissions. The installed iOS development build could load this worktree's
Metro on port 8082, leaving another worktree's server on 8081 alone. The iOS
26.5 iPad simulator returned three existing HealthKit workouts. Screen totals
matched direct native reads: 21.6 miles, 3h 46m, 163 m and 7,362 average steps.
These were existing simulator records, not a real runner's hardware data.

[observed] A temporary throwing reader exercised the error screen. Restoring
the native function and tapping Try again returned the live values. No health
records were written or deleted. Android API 36 read an empty Health Connect
store and displayed No shared activity yet. Both native platforms rendered
the example dashboard with the expected provider name.

[observed] `bun run typecheck` and five Bun calculation tests passed. The
tests cover local calendar boundaries, missing metrics, recorded zero,
steps-only data and formatting. T3 browser checks covered the unavailable
health state and examples at 390 and 320 CSS pixels. At 320 pixels the metric
columns wrap instead of squeezing their values.

[observed] Android's empty state, text actions and native header remained
readable at system font scale 1.5. The original 1.0 setting was restored.
React Doctor's final scan of the three new screen files reported 100/100 with
no issues. The initial scan flagged component complexity, so connection-state
copy and summary rendering now live in separate components.

## Friction and blockers

[observed] This worktree initially had no dependencies or generated native
projects. `bun install --frozen-lockfile` completed without changing the lock.
Android had no installed Brooks app. The existing debug APK from the Android
integration worktree had the same native reader source and avoided a rebuild.
Its first-launch developer-menu walkthrough delayed UI readiness.

[observed] Argent could inspect Android accessibility, but its Metro debugger
did not discover the Android target while two iPad targets were listed. iOS
debugging needed the logical target ID reported by Argent. Browser wheel
scrolling targeted the document by default, while React Native Web scrolls a
nested div; the visible overflow container needed explicit selection.

## What was hard

[observed] HealthKit hides read denials, and Android may share workouts without
their distance or elevation. The screen must avoid claiming a connection from
an answered permission sheet, or presenting a partial distance as a complete
total. All-zero step responses and absent workouts stay unavailable.

## Comparative friction

Not observed.

## Improvement ideas

[inferred] A documented shared HealthKit/Health Connect summary interface in
Expo would reduce application-specific permission and missing-value handling.
Argent could improve target discovery for Android alongside multiple iOS
connections. T3 browser scrolling could pick the visible scroll container.

## Follow-ups

[observed] Sleep, resting heart rate and active energy remain examples only.
They need native reads and explicit permissions before live values can be
shown. No real-device health store was used in this task.
