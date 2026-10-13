# Background Health sync for shoe mileage

**Date:** 2026-10-13
**Agent:** Codex / GPT-6 Astra
**System:** Expo
**Scope:** Native HealthKit delivery, persistent shoe totals and widget publication

## Outcome

[observed] Added launch-time HealthKit observers and a native mileage coordinator
to `brooks-activity`. Foreground and background reads share one authoritative
snapshot. JavaScript imports that snapshot before publishing, so a cold launch
cannot replace newer native totals with its SQLite cache. Details and the
hardware checklist live in [LLP 0006](../llp/0006-shoe-mileage.design.md#background-health-sync).

## What worked well

[observed] Expo's AppDelegate subscriber autolinked from the local module without
editing generated app lifecycle code. The iOS build succeeded, including the
subscriber and background-delivery entitlement. TypeScript checking and React
Doctor passed (100/100).

[observed] `bun run test:health-sync` passed two tests with 108 assertions. A
standalone Swift executable exercises persistence, concurrent deliveries,
configuration changes, workout deletion, failed reads and timeout cancellation.
Shared fixtures compare native mileage and widget strings with the existing
TypeScript calculations. This kept most verification independent of HealthKit.

## Friction and blockers

[observed] `expo-widgets` 57.0.23 exposes its timeline writer only internally to
Swift. Native background publication therefore needs a small adapter to its
App Group storage format, protected by a test against the installed package.

[observed] Passing fixtures through Bun's subprocess pipes caused the Swift
harness to abort or lose output. Temporary input/output files made the same
tests reliable. This affected the test harness, not the app.

[observed] The first simulator build used `CODE_SIGNING_ALLOWED=NO`. It launched,
but HealthKit rejected authorization with a missing-entitlement error. A native
compile alone does not validate permission-sensitive behavior. Manually signing
with the unprocessed source entitlements then failed to launch. Rebuilding with
Xcode's simulator signing (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`)
resolved both issues; Health authorization and reads succeeded.

[observed] On the iOS 26.5 iPad mini simulator, the debug seeder wrote 24 runs
totaling 176 miles. Native and JavaScript snapshots agreed, including freshness.
The Shoes tab showed 376 of 300 miles (200 starting miles), and the App Group's
`__expo_widgets_ShoeMileage_timeline` held the same strings, 125% and the
replacement status, with its registered layout intact. This verifies the live
Health/read/native-event/storage handoff, not a suspended-app background wake.

## What was hard

[observed] Ownership of cached totals matters more than the observer itself:
foreground publication can race a background read, and changes to shoes during
a query can invalidate its window. The coordinator serializes these changes,
reruns invalidated reads and preserves the last successful timestamp on errors.
Health read denial remains indistinguishable from an empty store.

## Comparative friction

Not observed.

## Improvement ideas

[inferred] A public Swift API for updating an Expo widget's props/timeline would
remove the storage-format dependency for HealthKit and other native callbacks.
An SDK 57 example combining AppDelegate subscribers, Health delivery completion
and widget publication would clarify the boundary where JavaScript is optional.

## Follow-ups

[observed — Apple documentation] Background observer deliveries cannot be tested
in the simulator. Verify workout insertion/deletion and locked-device recovery
on a signed iPhone build using the checklist in LLP 0006. iOS schedules delivery
and WidgetKit refreshes; the implementation does not guarantee immediate updates.
