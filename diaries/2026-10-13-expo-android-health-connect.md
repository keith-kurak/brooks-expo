# Android Health Connect integration

**Date:** 2026-10-13
**Agent:** Codex / gpt-6.1-sol
**System:** Expo
**Scope:** Android reader, connection UI, permission/history handling, shared mileage sync and verification.

## Outcome

[observed] Added a Kotlin Health Connect reader to the existing local Expo module. Running, treadmill, walking and hiking sessions, source-scoped distance/elevation and daily steps feed the shared Finder and mileage code. The connection UI offers settings recovery; Android uses an exact Material start-date picker. Reads remain local and read-only. LLP 0005/0006 and the README explain the implementation.

[observed] TypeScript, iOS/Android bundle exports, 10 Bun integration tests with 65 assertions, four Kotlin unit tests, the Android debug APK build and React Doctor passed. React Doctor reported no issues. The merged manifest has six health read permissions, no health write permissions, the rationale activity and the Android 14 alias.

[observed] On the API 36 emulator, the connected Finder read an empty store and offered the full quiz. Health Connect showed the four data read toggles and separate past-data/background toggles. Revocation was detected; denial returned to the manual path after the callback fix below. The settings link opened the public Health Connect settings page and allowed access to be restored. The exact date picker saved September 28 without a day shift. Adding a Ghost 17 with 100 starting miles and an empty Health store showed 25% and 100 of 400 miles, with a successful read time and background-access note.

[observed] The OS job showed a 60-minute minimum latency. With the app backgrounded, `adb shell cmd jobscheduler run -f com.exponathan.ecommercedemo 0` executed `brooks.shoe-mileage`. Logcat recorded `Task successfully finished`, `Worker result SUCCESS`, and another worker queued for 60 minutes. This was a forced execution, not proof of an automatic scheduled wake.

## What worked well

[observed] Reusing the summary contract kept interpretation and shoe aggregates in TypeScript. Integration tests verified foreground-only access, history and distance revocation, cache/freshness preservation, missing distances, deletions, concurrent shoe changes and older iOS binaries. Native tests verified duplicate imports, nested/independent sessions and unknown fields.

[observed] Version-pinned Expo SDK 57 docs plus the actual installed Expo/Health Connect sources helped resolve platform behavior. `create-expo-module add-platform-support` generated the Android module. The existing Android SDK had an API 36 Play Store image; an AVD was created for QA.

## Friction and blockers

[observed] This worktree needed `bun install --frozen-lockfile`. The first Gradle invocation needed `android/local.properties` pointing at the installed SDK. Health Connect 1.2.0-alpha06 required AGP 9.1 and a newer compile SDK; stable 1.1.0 compiled with Expo's AGP 8.12/compile SDK 36 but raised the app minimum to API 26.

[observed] Zero-argument Coroutine overloads were ambiguous; explicitly typed `SuspendBody` functions compiled. The scaffold could not infer the Expo SDK from a local module and downloaded its latest template. Generated module build outputs needed their own `.gitignore`.

[observed] `MANAGE_HEALTH_PERMISSIONS` looked suitable in the Android SDK reference, but launching it as an ordinary app failed with `SecurityException`, requiring `GRANT_RUNTIME_PERMISSIONS`. The public `HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS` works. Its Kotlin property is exposed under a different JVM getter name, so the pinned sources were more useful than Java method inspection.

[observed] The first AVD boot exited before readiness; a clean Argent retry worked. Some UI captures showed a navigation transition while the later tree already described its destination. Waiting for a stable tree before tapping reduced missed actions. An existing Metro occupied 8081, so this task used 8082. Android debugger calls needed the logical device ID because another device was attached to that Metro. After Android process restarts, a stale logical ID sometimes returned the iPad runtime instead; response identity was checked and later acceptance relied on Android UI evidence. Gboard's stylus tutorial intercepted the first text entry; cancelling it and selecting a catalog result allowed the form check to continue.

## What was hard

[observed] The Health Connect contract uses runtime permission requests on Android 14+, whose result arrives through `onRequestPermissionsResult`. Expo's activity-contract adapter launched that screen but did not resolve the declined request in this app. Android 14+ now uses Expo's PermissionsService; Android 9–13 retains the activity contract. Denied access then returned to the quiz instead of leaving a spinner running.

[inferred — implemented] Use 28 conservative days without earlier-history access rather than guessing a first-grant timestamp. Do not replace a complete mileage cache with a partial window or a workout lacking distance. Keep missing indoor/elevation data unknown. Duplicate-session handling is a heuristic and must still be checked against real recording-app exports.

## Comparative friction

[observed] Android exposes grants and adds provider installation, history and background gates. HealthKit hides read denials. The shared Expo background task and TypeScript sums serve both platforms. Real-device scheduling reliability was not compared.

## Improvement ideas

[inferred] Expo should make RegisterActivityContracts route runtime permission results too, or document this Health Connect split explicitly. Provide a version-matched local-module add-platform example, including package visibility, rationale aliases and history/background capability checks. Android reference docs should state the privileged launch restriction on the direct permission-management intent.

## Follow-ups

[inferred] Validate nonempty imports, paused workouts, deletion and source deduplication with real recording apps, plus actual OS-scheduled runs on hardware. Android 9–13 installation/provider UI was not exercised. Before publishing, complete the Play Health apps declaration and align the public privacy policy with the native rationale. Android widgets remain separate work.
