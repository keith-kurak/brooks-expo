# Your shoes opens from Profile

**Date:** 2026-10-13
**Agent:** Codex / GPT-6.1
**System:** Expo
**Scope:** Remove the Shoes tab button and push the mileage screen from Profile.

## Outcome

[observed] Both tab bars have Home, Browse, Cart and Profile. The guest and
member Your shoes row pushes the screen on Profile's stack with a native back
chevron. Home's replacement reminder, the screen's Finder actions and newly
published widget links use the account group. See
[LLP 0006](../llp/0006-shoe-mileage.design.md#shoes-opens-from-profile).

[observed] `bun run typecheck` and `git diff --check` passed. Expo exported
iOS, Android and web with
`bun node_modules/expo/bin/cli export --platform all --output-dir /tmp/brooks-profile-shoes-export`.
A Node check using the installed Expo Router's `getRoutes` and the layout's
actual settings verified four groups, the account anchor, and the shoes and
finder children for all three platforms. This checks routing configuration;
screen interactions were not exercised on a device.

## What worked well

[observed] The existing shared Profile rows already exposed Your shoes to
guests and members. Removing the array-group clone removed the destination
from both navigators without retaining a hidden tab.

## Friction and blockers

[observed] T3 preview opened with an explicit host AppArmor sandbox error, so
browser interaction verification was unavailable. `bunx expo export` returned
`CouldntReadCurrentDirectory`; invoking the installed Expo CLI directly
completed the export.

## What was hard

[observed] Removing a tab also required changing the Home and widget links.
A bare shoes path selects Home's clone. Explicit account paths select Profile,
whose anchor supplies its back destination. The navy empty state needs a white
chevron; the populated screen needs ink. Both now pad below the native header.

## Comparative friction

Not observed.

## Improvement ideas

[inferred] Expo Router documentation could show moving an array-group anchor
into a pushed screen, including updates to widget links and header insets.

## Follow-ups

[inferred] Device verification should cover guest and member Profile, both tab
bars, empty and saved-pair screens, Finder return navigation, and widget taps.
