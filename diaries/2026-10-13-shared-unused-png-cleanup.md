# Unused PNG cleanup

**Date:** 2026-10-13
**Agent:** Codex / GPT-6.1
**System:** Shared
**Scope:** Remove PNGs not needed by the app or current README from PR 33.

## Outcome

[observed] Removed 34 PNGs totaling 4,816,668 bytes: 23 design/implementation
exports, six old QA screenshots and five retired assets. Removed the screenshot
HTML viewer. Kept 21 runtime/configuration PNGs and the README's two screenshots.
The two widget badges and all resolution variants of the four current tab
icons remain. The renderer no longer regenerates unused Finder tab icons.

[observed] Design notes now link to editable Paper sources. Historical export
references are marked superseded in LLP 0008, and documentation notes explain
the removed QA images. Application PNG references resolve. The icon renderer's
syntax check and iOS/Android/web exports passed.

## What worked well

[observed] Comparing static app/config imports with tracked files separated
needed images from export artifacts. Fresh exports verified that required
images remain available on each platform.

## Friction and blockers

[observed] An extra binary comparison found different Hermes export bytes despite
matching output filenames. The validation record uses the reference audit and
successful builds, without claiming byte-identical bundles.

## What was hard

[observed] Metro implicitly includes `@2x` and `@3x` variants, so a filename-only
reference search would incorrectly mark current tab icon variants unused.
Removing screenshots also required removing their local HTML viewer and keeping
the design history links useful.

## Comparative friction

Not observed.

## Improvement ideas

[inferred] Keep editable design sources and text validation notes as the default;
add raster exports only when the repository's documentation consumes them.

## Follow-ups

None.
