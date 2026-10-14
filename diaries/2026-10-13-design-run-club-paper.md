# Run Club designs in Paper

**Date:** 2026-10-13
**Agent:** Codex / gpt-6.1-sol
**System:** Shared
**Scope:** Design and show mobile loyalty screens with Paper and Mobbin.

## Outcome

[observed] Six editable phone screens and a Mobbin reference board were created
in the existing [Brooks Paper file](https://app.paper.design/file/01M06FKT4VGZT5BB9ST564VHEN/p-4-0).
Exports live in `designs/run-club/`; rationale is in LLP 0008. No app code changed.

## What worked well

[observed] Mobbin surfaced an actual Brooks challenge in Strava. The existing
Paper file already had the Brooks tokens and installed Filson Pro weights,
so the new screens could share the app's palette, type and square controls.
Incremental HTML writes and cloning kept the status bars and navigation consistent.

## Friction and blockers

[observed] Public product-image requests returned 403 despite resize parameters.
A frame from the bundled campaign video supplied the photography instead.
The first screenshots in a mutation batch showed earlier rendering state;
separate read calls returned the completed sections for review.

## What was hard

[observed] The entry-history caption initially ran under the bottom navigation.
Shortening it fixed the overlap without changing the viewport. The separate
reference board needed `height: fit-content` to preserve its bottom padding.

## Comparative friction

Not observed. No app implementation or native build was attempted.

## Improvement ideas

[inferred] Paper could offer a render-settled acknowledgement after a write
batch so screenshot checks do not capture earlier state. Reusable screenshot
exports made a useful interactive design viewer without rebuilding the UI in HTML.

## Follow-ups

[inferred] User selection and feedback can guide implementation. A production
campaign integration would need official entry validation and prize-claim services.
