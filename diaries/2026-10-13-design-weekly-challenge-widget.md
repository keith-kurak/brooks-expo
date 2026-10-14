# Weekly challenge widget in Paper

**Date:** 2026-10-13
**Agent:** Codex / GPT-6.1
**System:** Shared
**Scope:** Design a home screen widget for the approved weekly 5K challenge.

## Outcome

[observed] Created editable progress and completed widgets on the
[Challenges Paper page](https://app.paper.design/file/01M06FKT4VGZT5BB9ST564VHEN/p-6-0).
Reviewed both at their intended size and exported 2× PNGs to
[`designs/challenge-widget/`](../designs/challenge-widget/). Updated LLP 0008.
No application source changed.

## What worked well

[observed] Cloning the existing badge and then the complete widget preserved
geometry and alignment. The same actual/target distance and lime bar connect
the widget to the app's challenge without adding controls.

## Friction and blockers

[observed] Apple's first documentation URL returned a JavaScript-only page;
an indexed official HIG URL supplied the design guidance. No design blocker.

## What was hard

[inferred] A widget needs to remain useful between updates. The proposal reads
the app's published challenge snapshot and calls out week-boundary handling,
without assuming continuous background updates or inventing earned entries.

## Comparative friction

Not observed. This was a Paper task, not native widget implementation.

## Improvement ideas

[inferred] A reusable widget preview fixture with device-dependent content
margins, system masking and custom font availability would help translate
Paper designs into the existing Expo widget extension.

## Follow-ups

None for the requested design. Native implementation and device verification
remain outside this task.
