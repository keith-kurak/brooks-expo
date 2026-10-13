# Simplify shoe sync with Expo BackgroundTask

**Date:** 2026-10-13
**Agent:** Codex / GPT-6 Astra
**System:** Expo
**Scope:** Replace native HealthKit observers with scheduled JavaScript mileage sync

## Outcome

[confirmed — user] Prefer Expo BackgroundTask for simplicity, accepting delayed
updates. [observed] The task reuses `readShoeMiles`, SQLite totals and the public
Expo widget publisher. Removed three Swift sync/model/publisher files, native
snapshot methods/events, the AppDelegate subscriber and the private widget
storage adapter. [LLP 0006](../llp/0006-shoe-mileage.design.md#background-health-sync)
describes the current implementation; the earlier diary records the superseded
native implementation.

## What worked well

[observed] SDK 57's config plugin adds the scheduler identifier and processing
mode. Autolinking includes BackgroundTask and TaskManager in the full app and
excludes both from the Clip. The Health plugin removes the old background-delivery
entitlement even on incremental prebuild.

[observed] Four Bun integration tests (27 assertions) passed with mocked native
boundaries and the real store/calculations: authorization-gated registration,
unregistration, repeated reads, workout deletion, failures, shoe removal during
a query and restricted scheduling. TypeScript checking, iOS/Android production
bundle export and React Doctor (100/100) passed. The signed iOS simulator build
also succeeded with Expo's task modules linked and the custom observer removed.

## Friction and blockers

[observed] Both new Expo packages require their native modules at import time.
The store uses guarded imports, as the existing widget code does, so the Clip,
Expo Go without Health, and older development binaries still load. The custom
`index.ts` imports the task definition before Router, without depending on a
component effect.

[observed — Expo documentation] Actual iOS scheduler execution is unsupported
on simulators. Unit tests and bundle/build checks cannot establish wake timing.

## What was hard

[observed] Sharing the existing refresh function required returning a failure
result to the worker instead of swallowing Health errors. Concurrent changes
to the shoe list require rereading before committing, so a removed pair cannot
return in cached totals.

## Comparative friction

[observed] Compared with the preceding native implementation, this removes the
second mileage calculator, native/JS snapshot ownership boundary and dependency
on Expo's private widget storage format. It trades workout-triggered delivery
for an OS-scheduled task with an inexact 60-minute minimum interval.

## Improvement ideas

[inferred] Expo's BackgroundTask docs could show an Expo Router custom entry
and an optional-module pattern for bundles shared with App Clips.

## Follow-ups

[observed] A new native build is required. Verify registration and
`triggerTaskWorkerForTestingAsync` on an iPhone, then verify an actual scheduled
run and catch-up after locked-Health failures. Do not promise hourly execution.
