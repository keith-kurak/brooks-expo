# Filter battle test

**Date:** 2026-10-13
**Agent:** Codex / gpt-6.1-sol
**System:** Expo
**Scope:** Search and category filters, sorting, native Apply/cancel/reset behavior.

## Outcome

[observed] Four regression tests failed before the fixes: Pink retained unrelated
colorways, five stars accepted 4.8, unknown prices sorted first, and listing state
leaked across scopes. The initial catalog probe found 44 of 49 Pink-filtered
styles had a nonmatching first colorway. All nine tests now pass, with 78,732
assertions including 1,840 color/gender/rating combinations and 36 feature pairs.
`bun run typecheck` passes. Search and offline rows share the tested pipeline.
Query tags and abort checks prevent stale response display. LLP 0003 records the
state and presentation decisions. New data helpers live in `packages/catalog`
and are copied by `bun run sync`.

[observed] Direct Argent checks on iPad mini / iOS 26.5 passed: Men’s Shoes
61 → 43 with Black and ascending price; draft reset plus Close kept 43;
committed reset restored 61; Pink returned 13; Women’s Shoes remained 58;
returning to Men’s restored 13. Live Ghost search returned five unique styles,
five-star filtering returned two, Purple plus five stars disabled Apply,
and Clear all plus Apply restored five. Final native offline fault injection
could not be verified because debugger evaluation timed out; offline behavior
is covered at the shared data seam.

## What worked well

[observed] Bun’s sub-second catalog checks supplied a deterministic feedback
loop. The generated/source split let the exact filtering code run without
mocking native modules. AX checked values and draft/result counts made native
behavior inspectable. The exact SDK 57 documentation was read before edits.

## Friction and blockers

[observed] The worktree needed `bun install --frozen-lockfile` before Metro.
The development Tools button overlapped the native filter toolbar; it was hidden
for QA. Recording generated reloads and sometimes resolved an off-screen Home
video rather than the visible Browse row. AX text identifiers appeared in modal
trees but disappeared in some normal-screen trees. Direct checks succeeded with
stable label fragments. No replay flow is claimed as passing.

[observed] With a second device attached to Metro, debugger calls needed the
iPad’s logical device ID. Some component-tree/evaluation calls still timed out
while the app remained interactive. New colorway photographs also returned
Brooks CDN HTTP 403. See LLP 0002’s image CDN note.

## What was hard

[observed] Filtering a style was insufficient: its photo, swatches, price and
PDP destination also needed the filtered colorway view. Live-only search rows
required special counting because they survive only the unfiltered recommended
view. Selected facets must remain removable after candidates change.

## Comparative friction

Not observed.

## Improvement ideas

[inferred] Argent recording should restrict target capture to foreground,
unobscured screen content. Metro should ignore recording artifacts consistently.
Native AX identifiers and radio checked state should be tested across presentation
and dismissal. SDK 57’s development Tools button should avoid toolbar hit areas.

## Follow-ups

[observed] Android UI and a replay flow were not certified in this task.
Brooks CDN denials limit photo validation. Color-family heuristics remain inferred;
authoritative primary-color data would improve ambiguous shade classification.
