# Brooks mobile commerce prototype

A working mobile shopping prototype inspired by [Brooks Running](https://www.brooksrunning.com), built with Expo SDK 57 and React Native 0.86. It uses real Brooks products and photography for the full browse-to-cart journey. Checkout stops inside the app, and no order is placed.

| Home | Product details |
| --- | --- |
| ![The Ghost Amp home screen](./docs/expo-home.png) | ![Ghost 18 product details](./docs/expo-pdp.png) |

## What works

- Home mirrors the current Brooks campaign with the Ghost Amp video hero, product rails, editorial cards, and the "Longer days. Longer runs." feature.
- Browse covers categories and franchises. Its search field swaps the screen into live Constructor.io results, with suggestions, filters, sorting, and an on-device fallback when the service is unavailable.
- The Shoes tab tracks the pairs you own. It counts recorded workout distance from Apple Health on iOS or Health Connect on Android, starting at each pair's start date, and says when a pair is "70% done, time to replace." The iOS home screen and Lock Screen widget shows the same mileage.
- Shoe Finder reads runs, walks and steps from Apple Health or Health Connect, fills the answers your activity supports, and asks the rest. The questions, branches and barefoot-test videos are the ones brooksrunning.com's own Shoe Finder uses. It ranks products from the bundled catalog.
- Product details include a swipeable gallery, colorways, widths, per-size availability, specifications, fit data, reviews, and a persistent add-to-cart flow.
- Cart supports quantity changes, swipe-to-remove with undo, totals, and persisted items. Checkout displays the prototype boundary instead of contacting Brooks.
- Brooks Run Club membership is a local demo state. Names and email addresses stay on the device.
- The app uses native stack headers and sheets, an app-owned five-tab bar, reduced-motion behavior, and Apple zoom transitions on iOS 18 and newer.

The repository has iOS, Android, and web scripts. The store-delivery workflow ships iOS to TestFlight and Android to the Google Play internal testing track.

## Quick start

You will need [Bun 1.2.22](https://bun.sh) and the native tooling for the platform you plan to run. Expo SDK 57 targets Node 22.13 or newer, React Native 0.86, Xcode 26.4 or newer, iOS 16.4 or newer, and Android API 36. See the [versioned Expo SDK 57 requirements](https://docs.expo.dev/versions/v57.0.0/#each-expo-sdk-version-depends-on-a-react-native-version).

Install dependencies and build a local iOS development client:

```sh
bun install
bun run ios
```

Other targets:

```sh
bun run android
bun run web
```

The native `ios/` and `android/` directories are generated locally and ignored by Git. `expo run:ios` and `expo run:android` create them on the first build.

If a development build is already installed, start Metro without rebuilding:

```sh
bun run start
```

Because this project includes `expo-dev-client`, that command targets the development build. To open the project in Expo Go instead, force that launch target:

```sh
bunx expo start --go
```

## Connect your activity

Health integration requires a development or store build. Expo Go and web use manual mileage and the full Finder quiz. Android builds require Android 8 or newer; Health Connect requires Android 9 or newer with Google Play services. On Android 9–13, install Health Connect from Google Play. Android 14 and newer include it.

Open Shoe Finder and tap **Connect Health Connect**, or add a pair in **Shoes** and allow access when prompted. Your recording app must share workouts and distance with Health Connect. Brooks reads activity and keeps it on your phone.

Allow earlier history to count mileage from an older pair's start date. Without it, the Finder uses four weeks rather than eight. If Brooks cannot read a pair's full history or a workout has no distance, it keeps the last saved total and explains what is missing. **Manage Health Connect access** opens settings so you can change permissions.

Background access is optional. Without it, mileage refreshes when you open Brooks or pull down in Shoes. With it, Android can also schedule updates while Brooks is closed. These updates are deferred, rather than immediate after a run.

## Checks

Run the TypeScript check before sending a change:

```sh
bun run typecheck
```

There is no Jest, Detox, or other automated app test suite in this repository yet. Core flows require interactive checks on the target platforms.

## How the data works

The app combines bundled, live, and device-local data:

| Data | Source | Runtime behavior |
| --- | --- | --- |
| Products, variants, prices, stock, and specifications | `packages/catalog/catalog.json` | Bundled and available offline |
| Ratings, fit summaries, and recent reviews | `packages/catalog/reviews.json` | Bundled and available offline |
| Search and suggestions | Brooks's Constructor.io index | Live, with local fallback |
| Product and campaign photography | Brooks image CDN | Loaded live |
| Cart and Run Club demo state | `expo-sqlite` key-value storage | Stored only on the device |

The current catalog snapshot was captured on July 13, 2026. It contains 226 products, 821 colorways, prices, and per-size stock. Review data for all 226 products was refreshed on August 21, 2026.

`brooksrunning.com` sits behind Akamai Bot Manager and returns `403` to non-browser clients. The app therefore cannot call Brooks product, authentication, or cart endpoints directly. [LLP 0002](./llp/0002-brooks-commerce-api.research.md) documents the browser research, reachable services, request shapes, and the exact cart variant identifiers.

`packages/catalog` is the source of truth. Files in `src/data/` and `assets/catalog.json` are generated copies. Do not edit those copies by hand.

## Refreshing the catalog

Install the harvester's browser dependencies once:

```sh
cd tools/harvest
bun install
cd ../..
```

Then capture and sync the current catalog:

```sh
bun run harvest
bun run sync
```

To replace every review record instead of filling only missing records:

```sh
bun run harvest:reviews --refresh
bun run sync
```

The harvester drives a real browser because direct HTTP requests are blocked. It is slow, checkpointed, and intentionally keeps request volume low.

## Project map

```text
src/
  app/                 Expo Router routes
  screens/             Screen implementations
  components/          Shared UI and navigation components
  data/                Generated catalog copies and editorial content
  store/               Cart, member, and search state
  theme/               Color, type, spacing, motion, and header tokens
  utils/               Storage, haptics, and formatting
modules/               Local Expo modules (Apple Health, Health Connect, App Clip)
targets/clip/          The iOS App Clip target
plugins/               Local config plugins
public/                Web index.html and apple-app-site-association
packages/catalog/      Source catalog package and schemas
tools/harvest/         Browser capture, validation, and sync tools
.eas/workflows/        Store (TestFlight, Google Play) and OTA delivery workflow
docs/                  README screenshots
llp/                   Product, system, and design rationale
diaries/               AI-agent development records
```

`brand.config.js` owns the shippable app identity. `app.config.ts` overlays it on `app.json`, so the display name, slug, URL scheme, and native identifiers stay together.

## Store builds and OTA updates

The workflow in [`.eas/workflows/deploy.yml`](./.eas/workflows/deploy.yml) ships iOS and Android. It runs on pushes to `main` and on manual runs. It type-checks the app and fingerprints the production native layer. Then, for each platform, it looks for a completed store build with the same fingerprint on the `production` channel.

- A match publishes an EAS Update for that platform to the `production` channel. Installed builds with that fingerprint download it.
- No match on iOS builds a new binary and uploads it to TestFlight.
- No match on Android builds a new binary and submits it to the Google Play internal testing track.

Each platform decides on its own. A change can ship a new Android binary and an iOS update in the same run.

The app uses the `fingerprint` runtime version policy, so an update can only reach a binary with the same native layer. Updates download on launch and apply on the next cold start. Account → **Check for updates** checks the channel by hand and offers a restart when an update is ready. Development builds load JavaScript from Metro, so the row is off there.

The first run after this change needs a new native build, because older binaries do not include `expo-updates`. Testers must install that build from TestFlight before they can receive updates. An update does not create a new TestFlight build number.

The Android submission needs two things outside this repository: the app `com.exponathan.ecommercedemo` must exist in Google Play Console, and the EAS project must have a Google Service Account key for Play submissions. See [Submit to the Google Play Store](https://docs.expo.dev/submit/android/). The submit profile in `eas.json` sends builds to the `internal` track.

Before publishing health support, complete the Google Play Health apps declaration for the six read permissions in the activity module's manifest. The public privacy policy must match the policy shown from Health Connect. See [LLP 0005's Android release notes](./llp/0005-activity-informed-finder.design.md#android).

Run it manually with an Expo account that has access to the configured EAS, App Store Connect, and Google Play projects:

```sh
eas workflow:run .eas/workflows/deploy.yml
```

To force new store binaries for both platforms even when compatible builds exist, for example after a failed or canceled upload:

```sh
eas workflow:run .eas/workflows/deploy.yml -F force_native=true
```

`get-build` proves that a build completed. It does not prove that Apple or Google accepted the upload or that testers installed it. Recover a failed upload with a forced run before relying on updates for that runtime.

The workflow also declares a push trigger for `main`. That trigger remains inactive until this GitHub repository is connected to the EAS project.

## App Clip

iOS builds include an App Clip (`targets/clip`). A link on `ecommerce-demo.expo.app` opens New Arrivals, a product page, and the bag without installing the app. The bag is stored in the App Group, so it is in the full app when the app opens. See [LLP 0007](./llp/0007-app-clip.design.md).

- The Clip runs the same JavaScript as the app but has no `expo-updates`. EAS Updates do not reach it. Clip changes ship with a store build.
- iOS opens the Clip only after `public/.well-known/apple-app-site-association` is live on the domain. Deploy the web build with EAS Hosting (`npx expo export -p web` and `eas deploy --prod`).
- To test on a simulator, build the `simulator` profile (`eas build -p ios --profile simulator`). The Clip is `AppClips/clip.app` inside the app bundle.

## Scope

The prototype is built for product exploration and technical evaluation. It does not send Run Club details to Brooks, share its local cart with brooksrunning.com, submit payment, or place orders. The harvested catalog is a dated prototype fixture, not a production data contract.

## Project documentation

This repository uses [Linked Literate Programming](https://github.com/ccheever/llp) to keep implementation decisions connected to their rationale.

- [LLP 0000: Brooks](./llp/0000-brooks.explainer.md) is the product and system entry point.
- [LLP 0001: Mobile shoe commerce design survey](./llp/0001-mobile-shoe-commerce-design.research.md) records the reference products and evaluation rubric.
- [LLP 0002: The Brooks commerce API](./llp/0002-brooks-commerce-api.research.md) explains the data and network architecture. Read it before changing `src/data/` or `packages/catalog/`.
- [LLP 0003: Brooks design system and screen patterns](./llp/0003-brooks-design-system.research.md) records brand tokens, navigation, motion, and current screen decisions.
- [LLP 0004: Building on Exact today](./llp/0004-building-on-exact.research.md) preserves research from the original monorepo.
- [LLP 0005: Activity-informed Shoe Finder](./llp/0005-activity-informed-finder.design.md) explains the Apple Health and Health Connect readers and permission handling.
- [LLP 0006: Shoe mileage and the Shoes tab](./llp/0006-shoe-mileage.design.md) explains the owned-shoes store, how mileage is counted, and how the widget gets its number.
- [AGENTS.md](./AGENTS.md) contains working rules for AI agents, including LLP and diary requirements.

Code uses `@ref LLP NNNN#section` comments where a non-obvious implementation decision needs its rationale close by.
