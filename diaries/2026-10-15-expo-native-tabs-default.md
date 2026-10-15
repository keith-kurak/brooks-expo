# Native tabs by default, safe-area check

**Date:** 2026-10-15
**Agent:** Claude Code (claude-opus-5-5)
**System:** Expo
**Scope:** Make `NativeTabs` the default tab bar on Liquid Glass devices and check safe areas.

## Outcome

- [observed] `utils/native-tabs.ts` now defaults the stored choice to `true`, so
  a Liquid Glass device opens on the system bar. The Profile switch still turns
  it off. Devices without Liquid Glass are unchanged.
- [observed] On an EAS cloud iOS 26 simulator, Home, Browse, Cart (empty),
  Profile, Your shoes, Challenges and Health data were checked at the top and at
  the end of scroll. Health data had a doubled bottom inset (about 130pt instead
  of 48pt). It used `automatic` inset adjustment plus `useTabBarOverlap()`. The
  overlap was removed; the last row now rests 48pt above the bar.
- Not checked: Cart with items (checkout bar), Shoe Finder, PDP, Android.
- LLP 0003#liquid-glass-is-a-profile-toggle updated.

## What worked well

- `eas-sim-dev` plus the argent CLI: the dev build matched the fingerprint, the
  tunnel came up in under a minute, and Fast Refresh reached the cloud device.
- Measuring the gap in a screenshot against known spacing tokens (48pt) made the
  double inset clear without a native inspector.

## Friction and blockers

- `node_modules` was missing in the new worktree, so `eas simulator:availability`
  failed with "Failed to resolve plugin for module expo-router". `bun install`
  fixed it.
- `describe` returned no elements at first: the app process could not reach the
  native-devtools endpoint. `restart-app` and then `open-url` with the dev-client
  link fixed it, but the restart opened the dev-menu onboarding sheet that
  `--dev` normally suppresses, and the floating gear stayed on screen.
- One tab tap in a batched command did not switch tabs; tapping again alone worked.

## What was hard

- Removing a `contentInset` prop with Fast Refresh left the old native inset in
  place. The fix looked like a no-op until the screen mounted again.

## Comparative friction

Not observed.

## Improvement ideas

- `sim-session.sh` could run `bun install` (or warn) when `node_modules` is absent.
- React Native could reset `contentInset` to zero when the prop is removed, so
  Fast Refresh shows the true state.
