# LLP 0006: Shoe Mileage and the Shoes Tab

**Type:** Design
**Status:** Draft
**Systems:** Expo App
**Author:** Claude Opus 5.5
**Date:** 2026-10-06
**Revised:** 2026-10-13
**Related:** LLP 0000, LLP 0003, LLP 0005

## Summary

The app now knows which shoes the runner owns. Each pair has a start date
and a mileage limit. The app adds up the distance of the runner's Apple
Health workouts since the start date. It shows the result as "70% done,
time to replace." A home screen and Lock Screen widget shows the same number.
The app sends the number to the widget through an App Group.

The Shoe Finder was a tab of its own. That tab is now **Shoes**: the pairs
the runner owns, their miles, and the Finder as the way to the next pair.

## The Shoes tab

[confirmed — user, 2026-10-06] The user asked for the Finder to be "a core
part of the app". [inferred] A quiz is something a shopper takes about once
a year. A pair's miles change after every run. So the tab leads with the
pairs, and the Finder is where a worn pair sends the runner:

- **No pairs.** A navy panel ("Every mile, counted."), three steps (add a pair,
  run as usual, replace it at 70%), and two actions: "Add a pair you own"
  and a link to the Finder.
- **Pairs.** One card per active pair: its photo, its start date, the percent
  in the hero size, a bar with a tick at the 70% line, the miles against the
  limit, and the weeks left at the recent pace. At 70% and up, the card adds
  a lime "Time to replace" badge, a "Find its replacement" button, and a
  "Shop the Ghost 17" link to the newest model in the same line. An X in the
  card's top right corner retires the pair, after an alert. Retired pairs are
  listed below.
- **The Finder card.** [superseded 2026-10-09] A navy card under the pairs
  opened the Finder. [confirmed — user, 2026-10-09] The user removed it,
  because "Find its replacement" already opens the Finder from a worn pair.
  With no worn pair, the Shoes tab has no way to the Finder; Browse and
  Profile still have one.

[confirmed — user, 2026-10-09] "Retire this pair" was a gray text link under
the card's actions. The user found it in a strange place and asked for an X
at the card's top right. The X is a 44 pt target. The name column keeps room
for it, so a long name wraps before it.

The route group is renamed from `(finder)` to `(shoes)`:
`src/app/(tabs)/(index,shop,shoes,cart,account)/`. The tab keeps the Finder's
glyph. `finder` is now a screen that every tab's stack declares. The Shoes
tab, the Browse card and the Profile row push it on their own stacks, so
Back returns to where the shopper was. The Finder's panels hide the native
bar, so the Finder draws its own back caret when it was pushed.

Home shows one ink strip under the hero, only while a pair is at 70% or more:
"Your Ghost 16. 72% done, time to replace." It opens the Shoes tab. Without a
worn pair, Home is unchanged.

## The owned-shoes store

`src/store/shoes.ts` follows `store/member.ts`: synchronous `kv-storage` and
`useSyncExternalStore`, so the tab and the widget know every pair before the
first frame. Each `OwnedShoe` (`src/data/mileage.ts`) has:

| Field | Meaning |
|---|---|
| `productId`, `colorCode` | The catalog style and colorway, or null for a pair typed in by hand |
| `name` | Shown everywhere, so a pair the catalog does not list still has a name |
| `startedAt` | Local midnight of the first day that counts |
| `limitMiles` | 300, 400 or 500 |
| `startMiles` | Miles the pair had before it was added |
| `kinds` | Which workouts count: runs, or runs, walks and hikes |
| `retiredAt` | Set when retired; later workouts do not count |

The miles from the last Health read are cached next to the pairs
(`brooks.shoes.miles.v1`), with the time of the read. [inferred] Without them,
a cold launch would show "0 mi" until the background read finished, and the
widget would have nothing to show while the app is closed.

[observed 2026-10-13] SQLite owns both the shoe list and cached totals again.
Foreground and Expo BackgroundTask reads use the same JavaScript store and
widget publisher. The earlier native snapshot owner is superseded; see
[Background Health sync](#background-health-sync).

## Mileage is workout distance

[observed] A pair's miles are `startMiles` plus the distance of the Health
workouts it counts, from its start date. The distance is the per-workout
`distanceWalkingRunning` statistic that the Finder already reads
(`getWorkoutsAsync`, LLP 0005#native-returns-summaries-js-decides). The original
implementation needed no new native code: `readShoeMiles` asks for enough days to reach the
oldest start date (at most three years) and filters by `start` in TypeScript.

[observed 2026-10-13] Both scheduled and foreground reads use `readShoeMiles`
and the same TypeScript calculations. Swift only reads Health summaries.
Android and web still have no Health reader. Steps remain a Finder input,
not shoe wear.

[inferred] It is not the all-day `distanceWalkingRunning` sum. That sum counts
every step a phone or watch records, in whatever shoes. A pair's wear comes
from the runs it was worn for.

The pace is the pair's miles over the last four weeks, per week. "About 3
weeks left at your pace" is the miles left divided by that pace. A pair
younger than a week has no pace yet.

### The 70% line

[confirmed — user, 2026-10-06] "70% done, time to replace." is the user's own
wording, and 70% is the line (`REPLACE_AT`). [inferred] It is early on
purpose: a new pair wants a few easy runs before it takes a long one. Below
the line the status is "45% done."

[confirmed — user, 2026-10-09] The line disappears when the pair reaches its
limit. On a full bar, and on the widget's full ruler, the mark at 70% sat
about three-quarters along. The user read it as "not done yet" on a pair that
was 100% done. The Shoes tab hides the bar's tick at a share of 1 or more.
Below the limit, the bar still shows the line.

[superseded 2026-10-09] The widget's ruler drew the 70% line as a long tick.
[confirmed — user, 2026-10-09] On a pair below 70%, the long tick sat above
the filled ticks, where the progress was not. The user asked for the long
tick to align with the current progress. The widget's ruler no longer shows
the 70% line (see
[The widget design](#the-widget-design)).

[inferred] The limits offered (300, 400 and 500 miles, default 400) follow the
common guidance that running shoes last 300 to 500 miles. Not checked against
a Brooks source.

### Every pair counts its own workouts

[inferred] Each pair counts every matching workout in its own window. Two
active pairs that both count runs both get every run. Health does not record
which shoes a run was in, so there is no correct split without asking. The
runner retires a pair to close its window. See
[Open questions](#open-questions).

## Health access

[observed] Foreground reads happen in three cases:

1. **Add pair.** The tap that adds a pair may show the Health sheet
   (`refreshMileage({ ask: true })`), as "Connect Apple Health" does in the
   Finder.
2. **"Count miles from Apple Health"** on the Shoes tab, shown while Health
   has never been read. Same `ask: true`.
3. **Launch and each return to the foreground** (`useMileageSync` in the root
   layout). This read never asks: it checks `shouldRequestAccessAsync()` and
   reads only if the sheet has already been answered. LLP 0005's rule holds:
   the app never shows the Health sheet at launch.

[observed 2026-10-13] Expo BackgroundTask also refreshes mileage after Health
access has been requested and an active shoe exists. It never requests
authorization. See [Background Health sync](#background-health-sync).

HealthKit hides read denials (LLP 0005#healthkit-hides-read-denials), so a
denied read looks like a pair with no runs. The pair then shows only its
`startMiles`.

The `NSHealthShareUsageDescription` string now names both uses: the shoe
miles and the Finder.

### This changes LLP 0005's privacy rule

[observed] LLP 0005#nothing-leaves-the-device said the Finder's Health
profile is never written to storage. That stays true for the Finder. Shoe
mileage is different. The app stores one total per pair on the device, with
the workout count and pace that produced it. The App Group gets only the
widget's strings for one pair (name, percent, miles, status). No workout
list, date or route is stored. Nothing is sent over the network.

## The widget reads the App Group

[observed] The widget is built with `expo-widgets` 57.0.23 and `@expo/ui`
57.0.22 (`src/widgets/shoe-mileage.ios.tsx`). The SDK 57 docs describe it as
iOS only, and it is not in Expo Go.

- `app.config.ts` adds the plugin with an explicit
  `groupIdentifier: group.<bundle id>` and one widget, `ShoeMileage`, in the
  small, medium, accessory circular, accessory rectangular and accessory
  inline families. The plugin adds the App Group entitlement to the app and to
  a new `ExpoWidgetsTarget` extension (`<bundle id>.ExpoWidgetsTarget`), and
  adds that extension to `extra.eas.build.experimental.ios.appExtensions` so
  EAS signs it.
- `updateSnapshot(props)` writes the props to the App Group's shared
  `UserDefaults` (`WidgetsStorage.swift` uses
  `UserDefaults(suiteName: ExpoWidgetsAppGroupIdentifier)`). The widget
  extension reads them from there. This is the App Group the user asked for.
- [observed 2026-10-08] The App Clip joins the same App Group, and the bag
  now lives in it, so a bag filled in the Clip is in the app when it opens.
  `brand.config.js` exports the group as `appGroup`. See
  [LLP 0007](./0007-app-clip.design.md#the-bag-lives-in-the-app-group).
- The widget shows the active pair closest to its limit. The store builds
  finished strings ("248", "300 mi", "Time to replace") because the widget's
  function runs in its own runtime and can reference nothing outside its
  body: no theme, no helpers, no Filson Pro. The colors are restated in it as
  hex values.
- A tap opens `ecomdemo:///(tabs)/(shoes)/shoes`. [observed 2026-10-06] The
  first version used `ecomdemo://shoes`. That matched the first clone of the
  array group, `(index)/shoes`, so the tap pushed the Shoes screen onto Home's
  stack with a back button. Naming the groups opens the Shoes tab itself.
- On Android and web, `shoe-mileage.tsx` is an empty function. In Expo Go, the
  iOS file finds no `ExpoWidgets` native module and does nothing.

### The widget design

[confirmed — user, 2026-10-06] Four designs were rendered on the simulator
and compared: a navy meter, a white ring, an odometer, and a product photo.
The user picked the odometer, asked for the shoe photo inside it, asked for
less on it, and rejected lime on white for its contrast. The result:

- **Paper white (`#F8F8F8`).** Brooks shoots product on this gray, so the
  photo has no visible edge on the widget.
- **The miles lead.** "248" with "of 300 mi" under it: the number the
  widget counts, not the percent.
- **A ruler down the right edge.** 16 ticks that fill from the bottom; the
  top filled tick is long, a needle at the miles run. An empty ruler has no
  long tick. [superseded 2026-10-09] The long tick was the 12th, the 70% line,
  always ink, to repeat the mark on the Shoes tab's bar (see
  [The 70% line](#the-70-line)). [observed 2026-10-06] The vertical ruler and the
  number-over-limit layout follow GO Club's steps widget on Mobbin
  (https://mobbin.com/screens/08903a39-0096-42fe-ab59-0d65ef36322e).
- **One status line.** "Time to replace" in Brooks blue (`#003789`), or
  "52 mi left" in gray. No lime, no chips, no uppercase eyebrows.
- **Small:** miles, status, and the photo at the bottom left; the ruler on
  the right. **Medium:** the same order as the small: miles and status at the
  top left, the name and "About 2 weeks left" at the bottom left, the photo
  beside them, the ruler on the right. [confirmed — user, 2026-10-06] An
  earlier medium put the name first, above an empty gap; the user found the
  hierarchy weak, and the small widget's order fixed it. A pair typed in by
  hand has no photo; the small widget shows its name in the photo's place.

[observed] The photo pipeline: the store asks the Brooks CDN for the
colorway's hero shot at 600 px and downloads it into the App Group's
`widgetsDirectory` with `expo-file-system` (`File.downloadFileAsync`), named
`<style>-<color>-600.png`. The first publish for a pair has no file yet; the
download publishes again when it lands. The CDN answered a 600×300 request
with a 300×300 square, so the widget gets a square and crops it.

[observed 2026-10-06] Brooks does not center the shoe. Across 26 cached
side-profile shots, the shoe spans 8–92% of the width and 37–82% of the
height; the sole is always at 82%. A centered crop cut off the sole (the user
saw the shoes clipped). The widget now draws the square at a fixed width,
moves it up 10%, and clips it to the band from 34% to 86% of the height. `curl` gets a 403 from the CDN; the app's own URLSession
download works.

### The widget updates when the app runs

[superseded 2026-10-13] The widget previously caught up only on foreground
visits, then briefly used native HealthKit observers. It now updates from the
same JavaScript publisher during foreground and scheduled background runs.

### Background Health sync

[confirmed — user, 2026-10-13] Use Expo BackgroundTask instead of native
HealthKit background delivery for simplicity, accepting deferred updates.

[observed] `index.ts` imports `src/store/shoes.ts` before `expo-router/entry`.
The store defines `brooks.shoe-mileage` at module scope, so a headless launch
can run it without mounting React components. The task calls `refreshMileage`
without `ask`, persists totals in SQLite and publishes through the public
`expo-widgets` `updateSnapshot` API. Foreground refresh uses the same code.
There is one mileage calculation and no custom native timeline writer.

[observed] Scheduling requests a 60-minute minimum interval. Registration is
serialized and checks current state: Health's sheet must already have been
answered, at least one pair must be active, and TaskManager/BackgroundTask
must be available. Retiring or removing the last active pair unregisters the
job. App Clips exclude both packages from native autolinking and skip their
JavaScript imports. Missing native modules and unsupported platforms retain
foreground-only behavior.

[observed] Reads run sequentially. A shoe-list change during a query causes a
reread against the new list. Recomputing totals handles deleted workouts and
repeated task executions. A failed read preserves totals and freshness and
returns `BackgroundTaskResult.Failed`; task errors do the same. A skipped read
(no prior authorization or no pairs) is a successful no-op. The task never
opens a permission sheet. Health read denial still looks like an empty store.

[observed — Expo SDK 57 documentation] iOS chooses when the task runs and can
defer short intervals until much later. Swiping the app away stops background
tasks until it is reopened. The scheduler cannot be validated on an iOS
simulator. `expo-background-task` adds `processing` and its permitted scheduler
identifier to the full app's Info.plist; the HealthKit background-delivery
entitlement is removed. This switch requires a new native build, not an OTA
update to the previous observer binary.
See [BackgroundTask](https://docs.expo.dev/versions/v57.0.0/sdk/background-task/)
and [TaskManager](https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/).

[observed] Health-derived aggregates stay on the device. Workouts exist in
memory only while reading. The App Group receives the selected pair's display
props and cached image through the existing widget API.

[inferred] Remaining device verification: install the new signed build on an
iPhone, add a pair and allow Health, verify task registration, and invoke
`triggerTaskWorkerForTestingAsync` in a development build. Confirm the widget
and app agree after adding/deleting a workout. Then background the app and
verify an actual OS-scheduled run. Repeat with Health locked: the cache should
survive failed reads and catch up on a subsequent task or foreground refresh.

### Native widget publishing

[observed 2026-10-13 — challenge implementation] The scheduled task also serves
the weekly Run Club challenge. It remains registered while there is an active
shoe or a current enrolled challenge, after the Health request has been answered.
Both readers run from the same task and retain their own cached aggregates. See
[LLP 0008](./0008-us-run-club-promotions.research.md#weekly-challenge-implementation).
The existing shoe widget design and App Group remain unchanged.

[Superseded 2026-10-13] The previous HealthKit observer implementation wrote
Expo's private App Group timeline format from Swift and maintained a native
snapshot. Those components and their contract tests have been removed in
favor of Expo BackgroundTask and the public widget API. The original validation
record remains in `diaries/2026-10-13-expo-background-health-sync.md`.

## Adding a pair

[observed] `/add-shoe` is a form sheet on the root stack, like
`Filter & sort`. It asks four things:

1. **Which pair.** A search over the catalog's shoes, or "Add “…”" for a pair
   the store does not list. Runners often wear a model the store no longer
   sells. A PDP opens the sheet with its own shoe and colorway chosen: "Already
   run in these?" sits under the PDP's details and reviews.
2. **Start date.** The system compact date picker on iOS (`@expo/ui`
   `DatePicker`, no future dates). Presets ("2 weeks ago", "1 month ago", …)
   on Android and web, where the date matters less because Health is not read.
3. **Miles already on them.** Optional.
4. **Replace at.** 300, 400 or 500 miles. With Health, also which workouts
   count.

## Replacing a pair

[observed] A worn pair offers two paths:

- **"Shop the Ghost 17".** `successorOf` finds the newest catalog model in the
  same line, by name without the version ("Ghost 15" and "Ghost 17" are both
  "ghost"), in the same gender. [inferred] A runner who wore a pair out often
  buys its successor.
- **"Find its replacement".** Opens the Finder with `replacing=<pair id>`. The
  Finder shows "Replacing your Ghost 16" above its panels. In the results, the
  same line scores +3 with the reason "The next Ghost, the line you put
  312 miles on", and the same cushion +1. The results lead says "To replace
  your Ghost 16, we suggest:". [inferred] +3 is about one quiz answer, so the
  answers can still overrule the old pair.

## Verified

[observed 2026-10-13 — Expo BackgroundTask replacement] Four integration tests
with 27 assertions passed for task registration, shared reads, deletion,
failure and concurrent shoe changes. TypeScript, iOS/Android bundle exports,
React Doctor and the signed iOS simulator build passed. Generated configuration
contains Expo's scheduler identifier and processing mode; the Clip omits the
two task modules. This does not verify real scheduler execution. See
`diaries/2026-10-13-expo-background-task-simplification.md`.

[Superseded 2026-10-13 — native observer implementation] The previous implementation passed its Swift/JS
fixture and coordinator tests (108 assertions), TypeScript checking, React
Doctor and a signed iOS simulator build. In the iOS 26.5 simulator, 24 seeded
runs produced 176 Health miles. The native snapshot, JS store, Shoes tab and
App Group widget timeline agreed on 376 of 300 miles after adding 200 starting
miles. Real background delivery remains an iPhone verification item. See
`diaries/2026-10-13-expo-background-health-sync.md`.

[observed 2026-10-06, iPhone 17 Pro simulator, iOS 26.5, Debug build, after
`seedSampleDataAsync`] A Ghost 16 added by name, with 200 starting miles and a
300-mile limit, read "82% done, time to replace. 248 of 300 mi". The Finder
opened from it led with the Ghost 17 and 18 for neutral answers. The App Group
plist held the widget's strings, and the small and medium widgets showed them.
Details are in `diaries/2026-10-06-expo-shoe-mileage-widget.md`.

[observed] `src/widgets/shoe-mileage.tsx` must stay `.tsx`. Metro tries each
extension in turn, so a `shoe-mileage.ts` stub is found before
`shoe-mileage.ios.tsx`, and iOS silently gets the empty function.

## Open questions

- Rotation: should a run count for only one pair? Options are the most
  recently started pair, or a per-pair "default" flag. Health cannot say.
- Should the widget let the runner pick which pair it shows (a configurable
  widget, iOS 17)?
- The App Group needs the App Groups capability on the App ID and a profile
  for the new extension. As with HealthKit (LLP 0005#open-questions), a
  workflow build on EAS servers may not sync capabilities. Run one local
  `eas build -p ios --profile production`, or set them up in the Apple
  Developer portal, before the next store build.
- Android: Health Connect (LLP 0005#android) would give the same miles.
  `expo-widgets` has an `enableAndroid` option, not documented for SDK 57.
