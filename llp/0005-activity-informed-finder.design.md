# LLP 0005: Activity-Informed Shoe Finder

**Type:** Design
**Status:** Draft
**Systems:** Expo App
**Author:** Claude Opus 5.5
**Date:** 2026-09-29 (Health-first flow and Next button: 2026-09-30; the site's own questions: 2026-10-05)
**Related:** LLP 0000, LLP 0002, LLP 0003, LLP 0006

## Summary

The Shoe Finder can start from the shopper's Apple Health data. It reads
running, walking and hiking workouts and daily step totals from the last eight
weeks. From these it fills in the quiz answers the data supports clearly, shows
the shopper what it filled in and why, and then asks the remaining questions.
Results quote the shopper's own numbers in their reasons.

The Finder is Health-first: where Health is available, Health is the main way
in and the quiz is the fallback (see [Health first](#health-first)).

[observed 2026-10-06] The Finder is no longer a tab. The Shoes tab
(LLP 0006#the-shoes-tab) pushes it, and so do Browse and Profile. Opened from
a worn pair, it also knows the pair it is replacing
(LLP 0006#replacing-a-pair). The same Health workouts now also count the
miles on the runner's shoes (LLP 0006#mileage-is-workout-distance).

The reader is a local Expo module, `modules/brooks-activity`. It is iOS only
today. On Android and web, the module resolves to `null` and the Finder shows no
Health entry point.

## Health first

[observed 2026-09-30] The Health start used to be an underlined link below the
quiz's "Let's go" button. It is now the Finder's front door on any device where
`isActivityAvailable()` is true:

1. **Intro.** The Apple Health app icon and the Brooks app icon sit side by
   side with a link badge between them, over the Finder's flat navy. The
   headline is "Link to / Apple Health", with "Apple Health" in lime. One line
   says what is read, and a lock line says the data stays on the phone. The
   primary button is "Connect Apple Health". The quiz is a text link below it:
   "Answer the questions instead". [observed 2026-09-30] The layout follows a
   reference the user supplied, without its gradient. An earlier version with
   a list of data types was cut as too busy.
2. **Summary.** The headline ("3 answers down already.") and one row for each
   filled answer, with its evidence. The Continue button says how many
   questions are left. The checkpoint beat is not counted, because it asks
   nothing. An earlier version also had a grid of headline numbers; it
   repeated the evidence rows and was cut.
3. **Quiz.** Only the questions the data could not answer. Back from the
   first question returns to the summary, not the intro.
4. **Results.** The reasons quote the shopper's numbers, as before.

The Health icon is `assets/apple-health-icon.png`, copied from the
`expo-ui-examples` repo and reduced to 384 px. The Brooks icon is the app's
own `assets/icon.png`. Both get the iOS icon corner radius: they are app
icons, so the square Brooks corner rule (LLP 0003) does not apply to them.

The quiz is the fallback in three cases: the shopper picks "Answer the
questions instead", the profile is empty or too thin to fill an answer, or
Health is not available at all. In the last case (Android, web) the Finder
shows the old welcome screen and "Let's go". There is no Health copy there.

The profile still lives in screen state only. "Retake the quiz" keeps the
Health answers and asks the rest again. "Start over" and "Answer every
question instead" drop them.

## The site's own questions

[observed 2026-10-05] The quiz is now the one brooksrunning.com runs, word for
word. brooksrunning.com/en_us/shoefinder/ embeds its whole config as JSON in a
`data-quiz` attribute: "Shoe Finder S26 US", version 24, 17 pages. It was read
with the Playwright browser in `tools/harvest` (headed Chrome; headless Chrome
gets a 403 from Akamai). `src/screens/finder/quiz.ts` copies from it:

- Every question, answer label and page order.
- The branches (`jumpToPage`): Run or Treadmill and Workout Class or Gym go to
  Training, Trail Run or Hike goes to Trail Type first, Walk or Everyday Wear
  skips to Recent Injuries, and Health skips Training Use.
- The per-answer scores, the progress-bar labels (shown as each page's
  eyebrow), the "Behind the Science" text, each answer's "What does this
  mean?" text, the "Take 'em off" checkpoint copy, and the US size charts.
- Injuries and Features are multi-select and optional. With nothing chosen,
  the button says the site's "None of these".

The barefoot tests use the site's own clips, downloaded from
finders.brooksrunning.com into `assets/finder` (five MP4s, 2.2 MB). Balance
and Flexibility show both answers as looping clips side by side, so the
shopper compares them and taps one. The knee test plays its single clip above
the three text answers, as the site does. All clips are muted, loop, and mix
with other audio.

What the app does differently:

- The email page ("Want your results sent to your email?") is left out. The
  app has no backend to send results from (LLP 0002).
- "What does this mean?" is a box under the answers, not the site's modal, so
  the Next flow below does not gain a second tap.
- [inferred] The site decides results on its server. The app sums the site's
  answer scores and gives a support shoe at 20 or more, or when the shopper
  picks Extra Support. 20 is the score of one "I feel a bit unstable" or "My
  knees bend" answer. Support shoes are the GTS models and those the catalog
  marks `structured_support`. Not checked against the site's results.
- The welcome copy, "Let's go", "Take 'em off" and "Okay, they're off" were
  already verbatim; the results headline now uses the site's "The results are
  in." and "We suggest:".

## The quiz waits for Next

[observed 2026-09-30, still true 2026-10-05 with the site's questions] The quiz used to advance 260 ms after a tap on an
answer. Now a tap only selects the answer. The shopper moves on with a Next
button at the bottom, which is disabled until an answer is selected. On the
last question the button says "See my matches". A mis-tap no longer costs a
step, and the shopper can look at the choice before committing to it. This
replaces the auto-advance that LLP 0003#shoe-finder inferred.

Answers are `radio` elements with a `selected` state, so VoiceOver reads the
choice before the shopper moves on.

## Why a local module

[observed 2026-09-29] Two maintained libraries exist:
`@kingstinct/react-native-healthkit` 16.0.0 (iOS, Nitro Modules) and
`react-native-health-connect` 4.1.3 (Android). We need about 5% of either
surface: read-only access to three data types.

[inferred] A local module is the smaller dependency and gives better defaults:

- It needs only `expo-modules-core`, which the app already has. The HealthKit
  library also needs `react-native-nitro-modules`.
- [superseded 2026-10-12] Avoiding the library's background-delivery entitlement
  and `NSHealthUpdateUsageDescription` was an original reason for the local
  module. The usage string became required by App Store validation, and shoe
  tracking now uses background delivery. See LLP 0006#background-health-sync.

The cost is that we maintain the native code ourselves.

## Native returns summaries, JS decides

[observed] The Swift module (`BrooksActivityModule.swift`) has five read
functions: `isAvailable`, `shouldRequestAccessAsync`, `requestAccessAsync`,
`getWorkoutsAsync(days)` and `getDailyStepsAsync(days)`. It also has the
development-only `seedSampleDataAsync` (see below). It returns one small
record per workout (`kind`, `start`, `durationMinutes`, `distanceMeters`,
`elevationGainMeters`, `indoor`) and one step total per day. This is at most a
few hundred records.

Daily steps come from an `HKStatisticsCollectionQuery`, not a sample sum.
[inferred — Apple's documented statistics behavior, not tested here] HealthKit
removes duplicate samples when both an iPhone and an Apple Watch
count the same walk. A plain sum would count that walk twice.

Workout distance comes from `workout.statistics(for: .distanceWalkingRunning)`.
`HKWorkout.totalDistance` is deprecated from iOS 18.

Finder interpretation is in TypeScript (`src/data/activity.ts`,
`src/screens/finder/from-activity.ts`). Thresholds can change with Fast
Refresh, and an Android reader only has to return the same two record shapes.

[observed 2026-10-12] Shoe mileage now also has native configuration, snapshot
and refresh methods plus change events. Its calculations run in Swift so a
HealthKit wake can finish while JavaScript is suspended. The Finder still
uses the original summary methods. See LLP 0006#background-health-sync.

## Answer only what the data shows

`answersFromActivity` fills an answer only when the data points at one option
clearly. Every threshold below is `[inferred]` and has not been checked against
real runners' data.

[observed 2026-10-05] The answer codes below are the site's own (see
[The site's own questions](#the-sites-own-questions)). The thresholds are
unchanged from 2026-09-29 except the mileage bands, which now follow the
site's 0-10 / 11-30 / 31+ bands instead of the old quiz's 10 / 25.

| Answer | Rule | Evidence shown |
|---|---|---|
| `use: useroadtread` (Run or Treadmill) | 4 or more runs in the window (one every two weeks), and fewer than half are trail runs | "18 runs in 8 weeks, mostly on the road", or "Most of your N runs were on a treadmill" |
| `use: usetrail` (Trail Run or Hike) | Half or more of the runs climb 40 m or more per mile | "N of your M runs climbed like trail runs" |
| `trailtype` | `rugged` (Rocky and Rugged) when half or more of the trail runs climb 80 m or more per mile, otherwise `smooth` | "Most of them climbed steeply" |
| `rundistance` | Weekly run miles, rounded: 10 or less, 11–30, or 31 and up | "About 22 miles a week" |
| `training` | Longest run of 16 mi or more → Marathon, 9 mi or more → Half Marathon. Otherwise the step is asked: Health cannot separate a 5k plan from running for health, and cannot see an ultra plan. | "Your longest run was 13.1 miles" |
| `use: usewalk` (Walk or Everyday Wear) | Fewer than 4 runs, and 4 or more walks or 7,500 or more steps a day | "About 9,400 steps a day" |

The data cannot see training use (race days or training days), experience,
injuries, the three barefoot tests, how each step should feel, features or fit,
so those steps stay in every flow. A walker skips the training steps because
the site's own branch sends "Walk or Everyday Wear" straight to injuries.

The summary screen lists each filled answer with the quiz's own eyebrow and
option label, so the shopper can check it against the question it replaces.
"Answer every question instead" drops the Health answers entirely.

## Nothing leaves the device

[observed — LLP 0002] The app has no Brooks backend. The profile is computed
when the shopper taps "Connect Apple Health", held in Finder screen state, and
dropped on "Start over" or "Answer every question instead". It is never
written to storage and never sent over the network. The `NSHealthShareUsageDescription`
string says so.

The app never asks for Health access at launch. It asks only after the tap.

[observed 2026-10-06] This section is about the Finder's profile, and it is
still true for it. Shoe mileage stores one total per pair on the device and
copies one pair's widget strings into the App Group. See
LLP 0006#this-changes-llp-0005s-privacy-rule.

## Read-only by default

The config plugin (`modules/brooks-activity/app.plugin.js`) adds
`com.apple.developer.healthkit`, `NSHealthShareUsageDescription` and
`NSHealthUpdateUsageDescription`.

[superseded 2026-10-12] Background delivery was previously excluded.
[observed] The plugin now adds
`com.apple.developer.healthkit.background-delivery` for shoe mileage.
Release builds still request no Health write permissions and contain no
sample-writing methods. See LLP 0006#background-health-sync.

[observed 2026-09-30] The write string is required even though the store
build never writes. The first TestFlight upload left it out and App Store
Connect rejected the build with ITMS-90683 ("Missing purpose string in
Info.plist ... should contain a NSHealthUpdateUsageDescription key"). The
message says either the code or the HealthKit entitlement can trigger this.
So the key is always present, and its text says that Brooks does not save data
to Apple Health.

The store binary stays read-only because the write code does not compile
into it: `seedSampleDataAsync` and its helpers sit inside `#if DEBUG`. [observed
2026-09-30] The Pods project defines `DEBUG` for the Debug configuration only.
`nm` on the Release `libBrooksActivity.a` finds no `HKWorkoutBuilder`,
`deleteObjects` or `seedSampleData` symbols; the Debug library has them.

`seedSampleDataAsync` writes eight weeks of road-runner data to an empty
simulator. It deletes only samples this app wrote, then writes the new set, so
it can run more than once. It is not called from any screen, and it is
undefined in Release builds. Call it from a debugger in a Debug build:

```js
await globalThis.expo.modules.BrooksActivity.seedSampleDataAsync()
```

## Verified on a simulator

[observed 2026-09-29, iPhone 17 Pro simulator, iOS 26.5, Debug build]

- The read sheet lists Steps, Walking + Running Distance and Workouts, and shows
  the `NSHealthShareUsageDescription` text. In this development build, the
  sheet header says the app wants to "access and update" Health data.
  [inferred] The cause is the `NSHealthUpdateUsageDescription` key. Every
  build has that key now (see above), so a store build probably shows the same
  header. Not checked on a store build yet.
- With an empty Health store, the Finder shows "Nothing to go on yet" and
  the full 7-step quiz.
- After `seedSampleDataAsync`: 23 runs and 8 walks, 55 days with steps. The
  newest run read back as 21,082 m with 104.8 m of climb, so
  `statistics(for:)` and the elevation metadata both work for
  builder-saved workouts. The summary filled Road, A half marathon and 10–25
  ("About 21 miles a week"). The quiz dropped to 4 steps. The results said
  "Loved for long runs like your 13.1-miler".

## HealthKit hides read denials

[inferred — Apple's documented privacy behavior, not tested here] HealthKit
never tells an app whether read access was denied. A denied request returns the same empty results as a Health
store with no workouts. So the Finder treats an empty profile as a normal
state: "Nothing to go on yet", with a pointer to the Health app, and the full
quiz.

## Android

Not built. [observed 2026-09-29] `android/` is generated by prebuild and
gitignored, and it has not been generated in this worktree, so no Android
build has been tried. The Health Connect work is:

- A Kotlin reader for `StepsRecord` (aggregate), `ExerciseSessionRecord` and
  `DistanceRecord`, returning the same two record shapes.
- The permission request through `RegisterActivityContracts` (in
  `expo-modules-core`, used by `expo-file-system`).
- The manifest entries that `react-native-health-connect`'s plugin adds: the
  `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` intent filter (Android 13
  and earlier) and the `ViewPermissionUsageActivity` alias (Android 14 and
  later), plus a privacy-policy screen.
- `minSdkVersion` 26, and the Google Play health-permissions declaration.

## Open questions

- Should the thresholds above be checked against real runners' data before a
  demo?
- [observed 2026-09-30] The TestFlight workflow build failed until the App ID
  had the HealthKit capability: the stored App Store profile "doesn't include
  the HealthKit capability". EAS syncs capabilities when `eas build` runs
  locally with an Apple sign-in, not in a workflow build on EAS servers. After
  a capability change, run one local `eas build -p ios --profile production`,
  or enable it in the Apple Developer portal and regenerate the profile with
  `eas credentials`.
- Should the Finder remember that the shopper connected Health, and offer the
  Health start by default next time? [observed 2026-10-06] Shoe mileage now
  reads Health on every return to the app once the sheet is answered
  (LLP 0006#health-access), so the Finder could skip its intro for those
  runners. Not done yet.
