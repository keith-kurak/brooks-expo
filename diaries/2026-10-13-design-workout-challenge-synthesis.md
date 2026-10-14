# An integrated Brooks workout challenge

**Date:** 2026-10-13
**Agent:** Codex / GPT-6.1
**System:** Shared
**Scope:** Synthesize Mobbin references into an editable Paper flow for this app.

## Outcome

[observed] Created four mobile states and a rationale board in
[Paper](https://app.paper.design/file/01M06FKT4VGZT5BB9ST564VHEN/p-6-0).
The challenge lives in Profile, with a first-time connection sheet and in-place
progress/completion. Exports are in
[`designs/run-club-workout-flow/`](../designs/run-club-workout-flow/).
Updated LLP 0008. No application source changed.

## What worked well

[observed] Reading the current Profile and tab-bar source exposed differences
from older Paper artboards. Reusing source glyph geometry, existing tokens and
installed Filson weights made the new flow fit the current app. Cloning reviewed
sections kept the four states consistent.

## Friction and blockers

[observed] Paper returned an empty `createdNodes` array for an empty absolutely
positioned button container. Inserting the visible button layers as a single
visual group worked. The empty response created no duplicate node.
An initial source-file lookup used obsolete filenames; `rg --files` corrected it.

## What was hard

[inferred] The main design tradeoff was showing which workouts counted without
adding a separate activity-history destination. A seven-day strip fits beneath
the one challenge card. Clear entry wording separates earned progress from a
won prize.

## Comparative friction

Not observed. This was a Paper design task, with no Expo implementation or device QA.

## Improvement ideas

[inferred] Paper could explain why a parsed visual group creates no nodes, rather
than returning an empty array. A source-linked design inventory would help flag
outdated app navigation in older artboards.

## Follow-ups

[observed] None for the requested design. Campaign terms, entry validation,
fulfillment and Android workout connectivity remain implementation decisions.
