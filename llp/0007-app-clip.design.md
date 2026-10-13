# LLP 0007: The App Clip

**Type:** Design
**Status:** Draft
**Systems:** Expo App, Web
**Author:** Claude Opus 5.5
**Date:** 2026-10-08
**Related:** LLP 0000, LLP 0002, LLP 0003, LLP 0006

## Summary

[confirmed — user, 2026-10-08] The user asked for an App Clip, designed
for e-commerce, and for the full implementation.

The App Clip opens from a link on `ecommerce-demo.expo.app`. A link to a
product opens that product's page (PDP) with no install. The shopper picks a
size and width and adds the shoe to the bag. The bag offers the full app.
When the full app opens for the first time, the bag is already in it.

The Clip is the same JS bundle as the app, built into a second binary. One
native constant tells the JS which binary it is in.

## What the Clip is

[inferred] An App Clip should do one task fast. For a shoe store the task is
"buy the shoe in this link". So the Clip is:

- **New Arrivals**, as the first screen (the PLP);
- **the PDP**, with Complete the look and the Shop the look sheet;
- **the bag**, with a panel that offers the full app.

The link sets the screen. `/product/<id>?color=<code>` opens the PDP with the
colorway already chosen. `/category/<id>` opens that PLP. Any other link opens
New Arrivals.

The target is `targets/clip`, made with `@bacons/apple-targets` 5.0.0
(`bun create target clip`). [observed] `create-target` could not add the
plugin to a dynamic `app.config.ts`; it printed the snippet, and the plugin
entry was added by hand. The template's `AppDelegate.swift` starts React
Native and passes universal links to `RCTLinkingManager`. Its
`pods.rb` is evaluated inside a `target 'clip'` block of the generated
Podfile.

[observed 2026-10-08] The plugin derives the bundle identifier
`com.exponathan.ecommercedemo.clip`. It adds
`com.apple.developer.parent-application-identifiers` itself and registers
the Clip in `extra.eas.build.experimental.ios.appExtensions` next to
`ExpoWidgetsTarget` (checked with `expo config --type prebuild`).

## Size decides the invocations

[observed — Apple, *Choosing the right functionality for your App Clip*]
An App Clip may be at most 15 MB uncompressed for iOS 16 and earlier. An App
Clip that supports only iOS 17 and later may be up to 100 MB, but only when
it is opened from digital links (websites, Messages, Spotlight). It must not
support physical invocations: App Clip Codes, QR codes or NFC tags.

[observed 2026-10-08] `expo export --platform ios` gives a 6.0 MB Hermes
bundle. The exported assets (shared with web) are another 12 MB. That is
more than 15 MB before React Native, Hermes and the Expo modules are added.
In EAS simulator build `138b4391`, `clip.app` is 115 MB with x86_64 and
arm64 slices. [inferred] Its arm64 slices plus the other files come to about
65 MB, so a device build should be well under 100 MB.

So the Clip targets iOS 17.6 (`deploymentTarget: '17.6'`, the value in Expo's
App Clip skill) and is opened from links only. In-store QR codes or NFC tags
on shoe boxes would need a native SwiftUI Clip under 15 MB. Apple lists one
exception: the App Clip demo link from App Store Connect gets 100 MB and
physical invocations. [inferred] Check what a demo link may show before
designing in-store codes around it.

## One bundle, two binaries

`modules/brooks-app-clip` is a local Expo module, linked into the app and the
Clip. Its `isAppClip` constant is true when `Bundle.main` has an `NSAppClip`
Info.plist dictionary, which only the Clip's Info.plist has.
`src/utils/app-clip.ts` is the one file screens ask. It exports
`isAppClip`, `bagHref`, `shopHref` and `promptFullApp()`. On Android, on the
web and in Expo Go the module is not linked, so `isAppClip` is false.

## What the Clip leaves out

`targets/clip/pods.rb` excludes these autolinked modules:

- **`expo-updates`.** [observed — apple-targets README and the template's
  `pods.rb`] An App Clip with `expo-updates` fails to build. So the Clip runs
  only the JS bundle it was built with. EAS Update OTA releases reach the full
  app only. A Clip change ships with a store build.
  [observed] `expo-updates` calls `requireNativeModule('ExpoUpdates')` at
  import time, so `src/utils/updates.ts` now requires it only when the native
  module exists. The Account row reads "Off in this build" there.
- **`brooks-activity`.** [observed — Apple] HealthKit gives an App Clip no
  data: `isHealthDataAvailable()` returns false. The JS already loads the
  module with `requireOptionalNativeModule`, so a missing module reads as "no
  Health". The PDP hides its "Already run in these?" row in the Clip.
- **`expo-widgets`.** An App Clip has no widget. The widget JS already reads
  a missing module as "no widget" (LLP 0006).
- **`expo-background-task` and `expo-task-manager`.** [observed 2026-10-13]
  Scheduled Health sync belongs to the full app. The shared JavaScript entry
  guards their imports in the Clip, so no task is defined or registered there
  (LLP 0006#background-health-sync).

## Routes

[observed] The root layout wraps `(tabs)`, `add-shoe` and `login` in
`<Stack.Protected guard={!isAppClip}>`, and the Clip's own `new-arrivals` and
`bag` screens in `<Stack.Protected guard={isAppClip}>`. Expo Router removes a
protected screen from the navigator's screen list (`useSortedScreens` in
`expo-router/build/useScreens.js`).

- `unstable_settings.initialRouteName` is `new-arrivals` in the Clip only.
  A product link then opens with New Arrivals under the PDP, so the PDP has a
  back chevron. A link to `/` lands on New Arrivals, because `(tabs)` is not
  in the Clip's screen list. The app keeps its default: a link opens its
  screen alone.
- `new-arrivals` is a route of its own because `initialRouteName` names a
  screen and cannot pass `category/[id]`'s `id`.
- `bag` renders the same `Cart`. The app's bag is a tab; the Clip pushes this
  screen under the transparent native bar. `Cart` pads its content by
  `useHeaderHeight()` when that is not 0. It is 0 in the Bag tab, because
  every level above it hides its header.
- The add-to-bag sheet and the Shop the look sheet go to `bagHref`: `/cart`
  in the app, `/bag` in the Clip. The empty bag's button goes to `shopHref`.
- `+native-intent.tsx` sends App Store Connect's default App Clip link,
  `https://appclip.apple.com/id?p=<clip bundle id>`, to `/`. [inferred] The
  Clip receives that URL when it is opened from the default link; not yet
  checked on a device.

## The bag lives in the App Group

[observed — Apple, *Sharing data between your App Clip and your full app*]
A Clip shares data with its full app through an App Group container that both
targets list. When the full app is installed, it replaces the Clip and can
read the container.

The app already has `group.com.exponathan.ecommercedemo` for the widget
(LLP 0006). `brand.config.js` now exports it as `appGroup`, and the Clip's
`expo-target.config.js` lists it. [observed] The plugin copies App Groups
only from `ios.entitlements`, and `expo-widgets` adds the app's group in its
own plugin, so the Clip must name the group itself.

`src/utils/shared-storage.ts` stores one JSON file per key in
`Paths.appleSharedContainers[appGroup]`. [observed] Expo autolinking reads
each target's own `CODE_SIGN_ENTITLEMENTS`, so the Clip's container shows up
in `appleSharedContainers`, and Expo's file permissions allow App Group
directories. Where there is no container (Android, Expo Go, web) it is the
app's own `storage`.

[observed — Apple Developer Forums threads 655225 and 762093] iOS can end an
app with `0xdead10cc` when it is suspended while holding a file or SQLite
lock in a shared container. A JSON file written with one `write` holds no
lock, and the bag is small. So the bag is not in SQLite.

`store/cart.tsx` reads the shared file first. If there is none, it reads the
bag the app saved before this change, once; the first effect writes it to the
App Group. On iOS the bag's only home is now the App Group, for both binaries.
The Run Club member stays in the app's own storage: the Clip has no sign-in,
and Apple advises against personal data in shared containers.

## The full-app offer

The Clip's bag ends with a "Your bag comes with you" panel and a "Get the
app" button. The button calls `promptFullAppAsync`, which presents
`SKOverlay.AppClipConfiguration` at the bottom of the screen. [inferred] The
overlay is not shown on its own: at the bottom it would cover the Checkout
button.

Checkout stays inert, as in the app (LLP 0000: no order is ever placed).
[inferred] Apple Pay is the natural next step for a shopping Clip. It needs
a merchant identifier and the in-app payments entitlement on both targets.

## The domain

[observed] `brand.config.js` has `domain: 'ecommerce-demo.expo.app'` (the EAS
Hosting address for the `ecommerce-demo` slug) and `appleTeamId:
'PH3XBLZS8A'` (from the Xcode log of store build 33). The app lists
`applinks:` and `appclips:` for the domain; the Clip lists `appclips:`.

- `public/.well-known/apple-app-site-association` names
  `PH3XBLZS8A.com.exponathan.ecommercedemo` for universal links on
  `/product/*` and `/category/*`, and the Clip for `appclips`.
  `/shop-the-look` is left out: it needs the PDP's parameters.
- `public/index.html` (from `expo customize`) carries the Smart App Banner
  tag with `app-clip-display=card`. [observed] With `web.output: "single"`,
  Expo CLI uses `public/index.html` when it exists, so the web build did not
  need static rendering. `expo export` copied both files.

[confirmed — user, 2026-10-08] The user approved the EAS Hosting deploy,
which makes the web build and its catalog snapshot public (LLP 0000,
LLP 0002).

[observed 2026-10-08] `npx expo export -p web` and `eas deploy --prod
--non-interactive --dev-domain ecommerce-demo` claimed the subdomain and
published deployment `ecommerce-demo--snqbk0w0dk`. The production alias
answered 404 ("No worker deployment was found") for about five minutes, then:

- `/.well-known/apple-app-site-association` returned 200 as
  `application/json`, with the app and Clip app IDs above;
- `/` carried the App Clip banner tag;
- `/product/221684` and `/category/featured-new-arrivals` returned 200 with
  `index.html`, so the single-page fallback serves product links.

[observed 2026-10-08 16:16] Apple's CDN
(`app-site-association.cdn-apple.com/a/v1/ecommerce-demo.expo.app`) still
served a cached 404 (`max-age=3600`). iOS reads the file through that CDN, so
links open the app or the Clip only after the CDN refreshes. A device in
developer mode can skip the CDN with `applinks:<domain>?mode=developer`.

## Shipping

- The Clip's bundle identifier needs the App Groups and Associated Domains
  capabilities. [observed 2026-10-07, build `92245c38`] EAS failed to turn on
  App Groups for `ExpoWidgetsTarget`: "Apple API error: The request entity is
  not a valid request document object". The Clip's capabilities will meet the
  same step. Turn them on in the Apple Developer portal, or run one local
  `eas build -p ios --profile production` (LLP 0006#open-questions).
- [observed 2026-10-08] The user ran `eas credentials:configure-build -p ios
  -e production` with an Apple ID session. It registered
  `com.exponathan.ecommercedemo.clip` as an App Clip bundle identifier and
  turned on Associated Domains for the app. The widget's capabilities and App
  Group showed "No updates". The Clip's capability update failed: "The
  relationship 'parentBundleId' is required but was not provided with this
  request." [observed — `@expo/apple-utils` in eas-cli 24.12.0] The App Clip
  bundle ID is created with a `parentBundleId` relationship, but
  `updateBundleIdCapabilityAsync` sends only `bundleIdCapabilities`. So EAS
  cannot change an App Clip ID's capabilities. Turn on Associated Domains and
  App Groups (with `group.com.exponathan.ecommercedemo`) for the Clip in the
  Apple Developer portal. [inferred] A re-run then finds both on and sends no
  update.
- App Store Connect needs an App Clip experience: a 1800×1200 header image,
  a subtitle, and the action. `eas metadata` can push it, but only after a
  build with the Clip is uploaded: until then `metadata:push` prints
  "Skipping app clip - no App Clip is registered for this app in App Store
  Connect" (eas-cli 24.12.0 source).
- `eas.json` has a `simulator` profile (unsigned, no channel) for EAS
  Simulator tests.

## Build numbers

[observed 2026-10-08, EAS build `49b851e7`] The first store build with the
Clip, from the deploy workflow, failed in Xcode: "The CFBundleVersion of an
App Clip ('1') must match that of its containing parent app ('35')." The
widget logged the same mismatch as a warning.

- EAS sets the build number after prebuild by writing `CFBundleVersion` into
  each target's Info.plist file (`updateVersionsAsync` in
  `@expo/build-tools`). It wrote 35 into all three files.
- The app's target does not generate its Info.plist, so the file's 35 is
  what ships. The Clip and the widget do (`GENERATE_INFOPLIST_FILE = YES`).
  Apple's build setting reference says `CURRENT_PROJECT_VERSION` then sets
  `CFBundleVersion`, and in this build it replaced the file's 35.
- `@bacons/apple-targets` sets the Clip's `CURRENT_PROJECT_VERSION` from
  `EAS_BUILD_IOS_BUILD_NUMBER` ("This only works with EAS Build") and falls
  back to 1. EAS set that variable (34) for simulator build `138b4391`,
  which the CLI started with the number already known. The workflow build
  incremented 34 → 35 on the build machine, after the environment was set
  up, so the variable was missing. `expo-widgets` always writes 1.

`plugins/with-target-versions.js` adds a "Match the app version" run-script
phase to every app extension and App Clip target. At build time it copies
`CFBundleVersion` and `CFBundleShortVersionString` from the app's Info.plist
file, which EAS has already updated, into the target's processed Info.plist.
The processed Info.plist is a declared input, so the phase runs after Xcode
writes it. The plugin is a finalized mod because apple-targets adds the Clip
in a custom mod (`xcodeProjectBeta2`) that runs after the regular Xcode
project mod.

[observed 2026-10-08, EAS simulator build `730cdbd9`] With
`EAS_BUILD_IOS_BUILD_NUMBER=35` (so the Clip's `CURRENT_PROJECT_VERSION` was
35) and the app's Info.plist at 1, the phase ran for the widget and the Clip
and all three bundles shipped `1`. A store build with the fix has not run
yet.

## Testing

[observed 2026-10-08] On EAS Simulator, with EAS build `138b4391`:

- The Clip, opened with no URL, showed New Arrivals with no tabs.
- PDP, add to bag and the Clip's `/bag` worked. The mileage row was hidden.
- "Get the app" presented the `SKOverlay` card.
- The full app, installed afterwards, opened with all five tabs, and its Bag
  tab held the line added in the Clip. Its own storage was new, so the line
  came from the App Group file.

Not yet checked: a link opening a PDP in the Clip. EAS Simulator's
`agent-device` cannot set `_XCAppClipURL`, and universal links need the live
AASA file. Details in `diaries/2026-10-08-expo-app-clip.md`.

## Open questions

- Should the PDP's share button share the app's own URL on the domain? Then
  Messages would show the App Clip card. Today it shares the
  brooksrunning.com page (LLP 0003), and the domain is not deployed.
- Should the Clip ask for ephemeral notifications (8 hours after each launch)
  for "your bag is waiting"? It needs `expo-notifications`.
- Are in-store codes a goal? Then the Clip needs a native SwiftUI build under
  15 MB, or the demo-link exception.
