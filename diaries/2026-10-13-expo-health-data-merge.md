# Health data merge conflicts

**Date:** 2026-10-13
**Agent:** Codex / GPT-6.1
**System:** Expo
**Scope:** Resolve PR 32 against main after Shoes moved into Profile.

## Outcome

[observed] Kept main's Profile push to Shoes and this branch's Health data
row. Moved the health route into the renamed four-tab array group. The plain
demo copy and live/sample behavior are preserved.

## What worked well

[observed] Git identified the route's new location automatically. Both routes
use explicit account-group paths, so they share Profile's back destination.
Type checking and all 24 health-summary, health-sync and filter tests passed.
Expo Router checks found four tabs and the account anchor with Health data,
Shoes and Finder on iOS, Android and web.

## Friction and blockers

[observed] Git reported both a file-location conflict for the added route and
a content conflict for the two neighboring Profile rows.

## What was hard

[observed] Taking either Profile row block wholesale would lose the Health
data link or retain the removed Shoes tab destination.

## Comparative friction

Not observed.

## Improvement ideas

[inferred] A route-manifest CI check could catch links to removed tab groups.

## Follow-ups

None.
