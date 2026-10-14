# A simpler Run Club weekly goal

**Date:** 2026-10-13
**Agent:** Codex / GPT-6.1
**System:** Shared
**Scope:** Revise the Paper loyalty concept around automatic workout progress.

## Outcome

[observed] Created two editable states of one Club screen in
[Paper](https://app.paper.design/file/01M06FKT4VGZT5BB9ST564VHEN/p-5-0), with
PNG exports in [`designs/run-club-simple/`](../designs/run-club-simple/).
Updated LLP 0008 to record the user's simpler workout-based direction. No app
implementation changed.

## What worked well

[observed] Cloning the existing status bar, header, tab bar, and completed
screen structure kept the proposal visually consistent. A single 5 km goal
fits with its prize offer and workout-source status above the tab bar.

## Friction and blockers

[observed] Text inserted in separate `write_html` calls did not inherit the
blue card's white text color. Screenshot review caught the black text; explicit
color and font styles on the text nodes fixed it. One lookup used the wrong
LLP filename and was corrected with `rg --files`.

## What was hard

[inferred] Simplifying the experience requires distinguishing an earned entry
from a won prize without introducing a second reward flow. The revised prize
line states the entry status on the same screen.

## Comparative friction

Not observed. This was a Paper design task, not an Expo implementation.

## Improvement ideas

[inferred] Paper could apply parent typography when inserting children through
later tool calls, or document that each inserted text group needs explicit
styles. A type-inheritance warning would expose this before export.

## Follow-ups

[observed] None for the design task. Campaign terms and enrollment behavior
remain proposals; implementing workout-backed rewards is separate work.
