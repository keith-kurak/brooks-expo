# Blurhash placeholders for product photography

**Date:** 2026-10-15
**Agent:** Claude Opus 5.5 (Claude Code)
**System:** Expo
**Scope:** Show a blurhash while catalog product photos load.

## Outcome

- [observed] `tools/harvest/harvest-blurhash.js` adds a `blurhash` to every
  catalog image (4782 of 4783 unique URLs). `ShoeImage` and `Photo` look it up
  by bare URL and pass it to `expo-image` as `placeholder`, with
  `placeholderContentFit` equal to `contentFit`. See
  [LLP 0002](../llp/0002-brooks-commerce-api.research.md#image-placeholders).
- [observed] Verified on an EAS cloud iOS simulator. With the photo source
  blocked by a temporary edit, the PLP tiles and swatches showed blurred
  placeholders; after the revert, the photos showed.

## What worked well

`expo-image` needed only two props. A URL-keyed lookup kept the 15
`ShoeImage` call sites unchanged.

## Friction and blockers

- [observed] The image CDN returns `403 text/html` to `curl` and Bun `fetch`,
  but `200 image/jpeg` to Node `fetch`, for the same URL and headers. The
  script must run under Node.
- [observed] Uncached CDN resizes take about 4 s each. The full pass took
  about 37 minutes.
- [observed] `sim-session.sh dev-build` hung twice in
  `eas fingerprint:generate` on an open HTTPS connection with no CPU use. I
  used `eas build:list` for the newest `development-simulator` build and
  checked with `git diff` that no native files changed since its commit.
- [observed] On the cloud simulator, `describe` returned an empty
  accessibility tree, also for a system "Open in…" alert from `open-url`.
  `debugger-component-tree` gave usable tap targets. Return did not accept
  the alert; Escape cancelled it.
- [observed] My first conclusion, "Fast Refresh did not apply the edit", was
  wrong. Metro logs nothing for a Fast Refresh update, and `expo-image` keeps
  the photo it already shows when a new `source` fails. A freshly mounted
  screen showed the edit at once in the second session.

## Second session (same day)

- [observed] `sim-session.sh dev-build` finished in about 10 s. It found no
  matching build. `eas fingerprint:compare` showed that the only difference
  was the new `package.json` scripts, so I reused the existing dev build.
- [observed] `describe` returned the full accessibility tree.
- [observed] With the photo URL blocked, placeholders showed on the PLP, the
  PDP gallery and swatches, and the Browse franchise art (`Photo`).
- [observed] With real URLs, a screen recording of a first visit to Women's
  Apparel showed blurred swatches at 2.5 s and photos at 6 s. `ffmpeg` was not
  installed; a short AVFoundation script extracted the frames.

## What was hard

Photos on a warm CDN loaded before the first screenshot, so a normal capture
never shows the placeholder. Blocking the source on purpose was the only
reliable proof.

## Comparative friction

Not observed.

## Improvement ideas

- Give `eas fingerprint:generate` a network timeout, or let `sim-session.sh
  dev-build` fall back to the newest build with a warning.
- When no build matches, have `sim-session.sh dev-build` print the
  `fingerprint:compare` result, so a JS-only difference is easy to see.
- Document in the `eas-sim-dev` skill that `debugger-component-tree` is the
  fallback when `describe` is empty.
- A dev-only switch that delays image loads would make placeholder states
  easy to check without editing source.
