# Android health integration research

**Date:** 2026-10-13
**Agent:** Codex / gpt-6.1-sol
**System:** Research
**Scope:** Health Connect counterpart to the existing BrooksActivity reader, Finder and shoe mileage. Research only, with no builds or device checks.

## Outcome

[observed] The local module currently registers Apple only and returns workout summaries and daily steps. LLP 0005 describes an Android reader using the same shapes; LLP 0006 now uses Expo BackgroundTask for both scheduled and foreground mileage refreshes.

[observed] Health Connect requires Android 9 or newer with Google Play services. Android 14 and newer include it in Settings; older supported phones need the Play Store app. Its SDK supports API 26, which does not make Health Connect usable on Android 8. The client provides `getSdkStatus` for availability. [Availability](https://developer.android.com/health-and-fitness/health-connect/availability), [architecture](https://developer.android.com/health-and-fitness/health-connect/architecture), [setup](https://developer.android.com/health-and-fitness/health-connect/get-started).

[observed] `ExerciseSessionRecord` supplies start/end, exercise type, optional laps and segments. Running, treadmill running, walking and hiking can map to Brooks' run/walk/hike kinds. Distance and elevation are separate records read within that session's interval. [Workout guide](https://developer.android.com/health-and-fitness/health-connect/experiences/workouts), [session reference](https://developer.android.com/reference/androidx/health/connect/client/records/ExerciseSessionRecord).

[observed] Use `DistanceRecord.DISTANCE_TOTAL` for each workout window and `StepsRecord.COUNT_TOTAL` in local calendar-day buckets. The aggregate API dedupes activity distance/steps using the user's app priorities. This does not establish that raw session lists are deduped or that every distance record in a window belongs to that particular workout. Source filters are available. [Aggregation](https://developer.android.com/health-and-fitness/health-connect/aggregate-data).

[observed] Android exposes granted permissions through `getGrantedPermissions` and requests them with `createRequestPermissionResultContract`. Grants can be partial or revoked; check before each read. Manifest permissions, the privacy rationale activity and Android 14 permission-usage alias are required. [Setup](https://developer.android.com/health-and-fitness/health-connect/get-started).

[observed] The default history boundary is 30 days before the first permission grant, not a continuously moving 30-day window. Older reads require `READ_HEALTH_DATA_HISTORY`; history and background reading each have feature-availability checks and separate grants. Background reading needs `READ_HEALTH_DATA_IN_BACKGROUND` even when a scheduler runs the app. Google's example uses WorkManager. [Read restrictions and background reads](https://developer.android.com/health-and-fitness/health-connect/read-data), [feature checks](https://developer.android.com/health-and-fitness/health-connect/features/availability), [permission examples](https://developer.android.com/codelabs/health-connect).

[observed] Health Connect does not notify readers when other apps add data. Refresh on foreground visits and scheduled background runs. Optional changes tokens support upserts/deletions and pagination, expire after 30 days unused, and require stored record IDs to interpret deletion changes. [Synchronization](https://developer.android.com/health-and-fitness/health-connect/sync-data).

[observed] Provider apps must write workouts into Health Connect before Brooks can read them. Newer Android 14 devices can also supply Health Connect's own steps with SDK extension 20 or newer. June 2026 changed those steps' origin to a device-specific, app-scoped synthetic package; unfiltered aggregates include them. [Setup](https://developer.android.com/health-and-fitness/health-connect/get-started), [on-device steps](https://developer.android.com/health-and-fitness/health-connect/read-data).

[observed] Play publishing requires the Health apps declaration and an explanation for each requested data type. The Play privacy policy must match the policy displayed from Health Connect. [Publishing](https://developer.android.com/health-and-fitness/health-connect/publish).

## What worked well

[observed] The existing summary contract makes most Finder and mileage calculations reusable. Official documentation covers the two permissions that would otherwise break the current eight-week and scheduled-read assumptions.

## Friction and blockers

[observed] Several old `guides/health-connect/develop` URLs redirected; guessed exercise/background paths failed. Current `health-connect/experiences/workouts`, `read-data` and `sync-data` URLs worked. Python HTTPS source reads hit the environment's certificate validation error; browser source retrieval worked. No runtime validation was attempted.

## What was hard

[inferred] Keep distance/elevation absent when their records or grants are absent. Add capability and coverage metadata rather than interpreting missing permission or partial history as zero exercise. With only 30 readable days, the Finder must not divide totals by eight weeks, and mileage must not replace a complete cached total with a partial reread. The existing shoe reader can request up to three years.

[observed] Session `endTime - startTime` is elapsed time. AndroidX's `EXERCISE_DURATION_TOTAL` uses an `ActiveTime` metric and says duration requires exercise-event/session processing. Optional laps need not cover the session. [AndroidX source](https://raw.githubusercontent.com/androidx/androidx/androidx-main/health/connect/connect-client/src/main/java/androidx/health/connect/client/records/ExerciseSessionRecord.kt).

[inferred] Duration semantics need explicit validation against paused workouts. Generic running/walking also has no direct indoor flag in the inspected session fields. Treadmill running is identifiable; unknown indoor status should not become a factual outdoor claim.

## Comparative friction

[observed] Android exposes read grants; the current HealthKit flow cannot distinguish denial from an empty store. Android adds installation, feature and history gates. Both can share the current deferred Expo BackgroundTask approach, but Android additionally requires a background-read grant. Device-level reliability comparison was not observed.

## Improvement ideas

[inferred] Start with a Kotlin reader in the existing Expo module, read-only exercise/distance/steps, an explicit Health Connect connection state and foreground refresh. Request optional elevation only for the Finder's trail inference. Represent readable coverage and optional history/background capability before enabling the existing scheduled sync. Preserve cache on permission loss or incomplete history.

[inferred] Keep full recomputation for the first version so deletions remain simple and no raw-workout database is needed. Add changes tokens only if repeated large reads prove too costly. Select a source or define duplicate-session policy before summing workout distances; aggregates alone cannot fix counting the same workout twice.

## Follow-ups

[inferred] Verify partial grants, revocation, history unavailable/denied, duplicate provider workouts, missing distance/elevation, paused sessions, local-day/DST boundaries, deleted workouts and actual scheduled reads on Android. Confirm real recording apps write the expected records. Update LLP 0005/0006 with the implementation decisions when this work is built.
