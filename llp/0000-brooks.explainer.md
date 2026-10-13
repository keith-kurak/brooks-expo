# LLP 0000: Brooks

<!-- @ref https://github.com/ccheever/llp/blob/v0.2.0/llp/0000-linked-literate-programming.explainer.md — Canonical LLP definition -->

**Type:** Explainer
**Status:** Draft
**Systems:** Brooks, Expo App, Agent Development
**Role:** Root
**Author:** Charlie Cheever / Codex
**Date:** 2026-07-13
**Revised:** 2026-10-13
**Related:** LLP 0001, LLP 0002, LLP 0003, LLP 0004, LLP 0005, LLP 0006, LLP 0007, [ccheever/llp](https://github.com/ccheever/llp)

## Summary

[confirmed — Charlie Cheever, 2026-07-13] Brooks is a working mobile-commerce
prototype inspired by the store on the Brooks Running website. The Expo app is
the primary output. It should feel exceptionally polished and demonstrate to
Brooks executives that Expo is a compelling way to build the company's mobile
app experience.

[observed — port, 2026-08-12] This repository is the standalone home of that
Expo app, ported from the original two-app research monorepo. The companion
Exact app stayed behind in the monorepo; its research record
([LLP 0004](./0004-building-on-exact.research.md)) travels with this corpus as
history because LLP numbers are never reused and other documents cite it.

## Product experience

[confirmed — Charlie Cheever, 2026-07-13] The app should mirror the useful
shopping functionality of the Brooks Running website. A user should be able to
explore real merchandise and progress through the shopping journey through
adding products to a cart. Completing a purchase is explicitly out of scope.

[confirmed — Charlie Cheever, 2026-07-13] The Expo app should work on iOS and
Android, should ideally work on the web, and must target Expo SDK 57 so that it
can be run with Expo Go.

[observed — port, 2026-08-12] The port preserves Expo Go compatibility: the
storage layer uses `expo-sqlite`, which ships inside Expo Go. *Superseded
2026-10-06:* the splash animation no longer uses `lottie-react-native`; see
[Splash animation](#splash-animation).

[observed 2026-09-30] Store builds take JS-only changes as EAS Updates on
the `production` channel (see the README's store builds and OTA section).
Since 2026-10-06 the same workflow also ships Android, to the Google Play
internal testing track. `expo-updates` is an Expo SDK module, and the
Account screen's update row only runs when
`Updates.isEnabled && !__DEV__`, so it is inert in Expo Go and dev clients.
[inferred] Expo Go includes `expo-updates`, so the import does not break the
Expo Go target; not yet checked in Expo Go.

### Splash animation

[observed 2026-10-06] The launch splash (`src/components/animated-splash.tsx`)
draws the Brooks chevron with `react-native-svg` and drives it with Reanimated.
Both were already app dependencies, and both ship inside Expo Go.
The splash had played a Jitter-exported Lottie through
`lottie-react-native`. That file held one filled path and two animated
transform values, so the component reproduces it directly: the same path, the
same 402×874 cover-scaled composition, the same keyframes and the same
cubic-bezier(0.5, 0, 0, 1) easing on one 60-frame playhead. The dependency and
its JSON asset were removed.

[observed 2026-10-06] Frame-by-frame screenshots on an iOS 26.5 simulator
(Lottie `progress` against the SVG port, frames 0–60) matched to edge
anti-aliasing. One frame in the fastest part of the scale-up (frame 38) had
edges up to 0.5 pt apart. Lottie's own easing solver is the likely cause;
this is [inferred], not checked in lottie-ios.

[inferred 2026-10-06] Unlike Lottie, the Reanimated timing honours the system
Reduce Motion setting: `withTiming` defaults to `ReduceMotion.System` in the
Reanimated source. With it on, the splash should go straight to its last frame
(plain white) and fade out. Not yet checked on a device.

[observed 2026-10-06] The native Android splash needs an image. When the
`expo-splash-screen` plugin gets options, its Android theme always points
`windowSplashScreenAnimatedIcon` at `@drawable/splashscreen_logo`. It deletes
the template's placeholder logo and writes a new one only when `image` is set.
With only `backgroundColor`, `:app:processReleaseResources` fails with
"resource drawable/splashscreen_logo not found" (EAS build `ec92535c`). The
plugin's `android` options now use `assets/splash-icon.png` at
`imageWidth: 120`. The chevron fills about 69% of that image, so it draws
about 82 dp wide. The first frame of the JS splash draws it about 81
composition units wide, cover-scaled to the screen. iOS keeps a plain white
native splash.

### Required website surfaces

[confirmed — Charlie Cheever, 2026-07-13] The first complete prototype should
mirror the commerce-focused structure and content of the current Brooks website,
including:

- the home experience, led by the current Josh Kerr / Project 222 feature;
- Men's and Women's shopping sections;
- New Arrivals;
- the Shoe Finder (pushed from Browse, Profile, or Your shoes, which since
  2026-10-13 opens from Profile and tracks the runner's pairs; see
  [LLP 0006](./0006-shoe-mileage.design.md));
- product browsing and product details needed to buy shoes;
- login; and
- a working shopping cart through add-to-cart and cart management.

[observed 2026-10-08] iOS also ships an App Clip: a link on the app's
domain opens New Arrivals, the PDP and the bag with no install, and the bag
moves into the full app. See [LLP 0007](./0007-app-clip.design.md).

[confirmed — Charlie Cheever, 2026-07-13] Non-commerce footer and corporate
content such as “Our Purpose” may be deferred. The priority is a convincing,
working shoe-discovery and shoe-buying experience rather than exhaustive parity
with every page on the website.

### Success criteria

- [confirmed — Charlie Cheever, 2026-07-13] The primary demo looks and feels
  excellent enough to impress Brooks executives, not merely prove technical
  feasibility.
- [confirmed — Charlie Cheever, 2026-07-13] Core browsing and product-detail
  experiences use real Brooks catalog data rather than a hand-authored mock
  catalog.
- [confirmed — Charlie Cheever, 2026-07-13] A user can select a purchasable
  product configuration and add it to a working cart.
- [confirmed — Charlie Cheever, 2026-07-13] iOS and Android are first-class
  targets; web is an additional target where practical.

## Live Brooks data

[confirmed — Charlie Cheever, 2026-07-13] The prototype should use the real
data and network APIs used by the Brooks Running website. Development should
inspect the website's behavior and network traffic, determine the requests and
responses needed for the in-scope shopping journey, and record the resulting
API knowledge in the repository so agents can build against it consistently.

[confirmed — Charlie Cheever, 2026-07-13] The live-data journey ends at a
working cart. The project does not need to submit payment or complete an order.

[confirmed — Charlie Cheever, 2026-07-13] This is a prototype, so it does not
need a heavyweight API-governance process. It must nevertheless use Brooks
services responsibly.

[inferred] Responsible prototype behavior means using normal publicly reachable
website flows, keeping request volume low, avoiding access-control bypasses and
secret capture, never placing an order, caching where it reduces unnecessary
traffic, and documenting dependencies on undocumented behavior.

## Design direction

[confirmed — Charlie Cheever, 2026-07-13] Design work should begin with a
survey of the strongest contemporary mobile shoe-shopping experiences. The
survey should identify interaction and information-design patterns worth
adopting rather than blindly copying one competitor.

[confirmed — Charlie Cheever, 2026-07-13] The final experience should combine
those native-commerce patterns with the layout, visual language, content, and
character of the Brooks website. It should feel spiritually related to Brooks
while remaining distinctively native, highly polished, and appropriate for
mobile interaction.

[inferred] The reference set and evaluation rubric are defined in
[LLP 0001](./0001-mobile-shoe-commerce-design.research.md). Brooks is the
canonical source for brand and scope; Nike, Zappos, adidas, and GOAT provide
complementary native-commerce benchmarks.

## Repository layout

[observed — port, 2026-08-12] The app lives at the repository root
(`src/app` routes, `src/screens` bodies, `src/components`, `src/theme`).
`packages/catalog` is the source of truth for the harvested data layer;
`tools/harvest` captures and syncs it. Design tokens follow the
expo-design-system file layout while keeping the values documented in
LLP 0003 byte-for-byte.

[observed — LLP 0002] `packages/catalog` is *copied* into the app by
`tools/harvest/sync.js` rather than workspace-linked. Metro resolves outside
its project root only with extra configuration, and a demo that fails to
bundle on an unfamiliar machine is worth less than a duplicated file.

## AI-agent development diaries

[confirmed — Charlie Cheever, 2026-07-13] Most implementation work will be done
by AI agents. As part of normal development, agents should keep durable diaries
covering:

- what worked especially well;
- where they became blocked or lost time;
- what was technically tricky or unexpectedly hard;
- what they believe would have been easier in another system; and
- actionable ideas for improving Expo.

[confirmed — Charlie Cheever, 2026-07-13] These diaries are a project output
that will be used to improve Expo.

[inferred] Entries should favor concise observations, reproducible evidence,
decisions, and useful retrospectives. They should not contain secrets or attempt
to preserve private hidden reasoning, and they do not replace code or design
documentation.

[inferred] Agent diaries live under [`diaries/`](../diaries/README.md). Each
substantial implementation or research task should create one short,
append-only entry using the template there. Entries are organized by date and
task slug so parallel agents can contribute without editing a shared log.

## Working principles

- [confirmed — Charlie Cheever, 2026-07-13] Optimize the Expo experience for
  executive-demo quality as well as functional correctness.
- [confirmed — Charlie Cheever, 2026-07-13] Prefer real Brooks data and observed
  behavior over invented fixtures for the primary user journey.
- [confirmed — Charlie Cheever, 2026-07-13] Preserve native quality instead of
  reproducing the website mechanically screen for screen.
- [confirmed — Charlie Cheever, 2026-07-13] Treat friction encountered by AI
  agents as research data that can improve the underlying developer tools.
- [observed — LLP adoption guide v0.2.0] Keep this generated root document
  `Draft` until its inferred claims are confirmed, corrected, or removed.

## Answered by research

- [observed — LLP 0002] **Market/locale:** the canonical demo is the Brooks US
  storefront, `Sites-BrooksRunning-Site`, `en_US`, USD.
- [observed — LLP 0002] **Cart interoperability:** the prototype's cart cannot
  interoperate with a website cart. Brooks is behind Akamai Bot Manager, which
  403s every non-browser client, so the app cannot reach `Cart-AddProduct` at all.
  The cart is therefore local, and builds the real Brooks variant id so the last
  mile is documented rather than guessed.
- [inferred — LLP 0002] **Asset and data constraints:** the catalog snapshot is a
  prototype fixture, not a redistribution. Imagery is streamed live from Brooks's
  own CDN rather than copied. A single, checkpointed harvest pass keeps request
  volume negligible. None of this survives contact with a public release, and it
  is not meant to.

## Open questions

- Within the required website surfaces, which secondary features—search,
  filtering, recommendations, favorites, and account details—must ship in the
  first executive demo?
- What accessibility, responsiveness, performance, offline behavior, analytics,
  automated testing, and device coverage define “demo ready”?
- Does the catalog snapshot need re-harvesting on a schedule to stay truthful, or
  is a dated snapshot honest enough if the app says when it was captured?
- Who can confirm the remaining inferred claims and promote this root LLP from
  `Draft` to `Active`?
