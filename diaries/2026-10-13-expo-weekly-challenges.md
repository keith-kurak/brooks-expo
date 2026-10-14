# Weekly workout challenge and widget

**Date:** 2026-10-13
**Agent:** Codex / GPT-6.1
**System:** Expo
**Scope:** Implement the approved Paper Challenges flow and weekly 5K widget.

## Outcome

[observed] Added Profile navigation, native challenge header, enrollment sheet,
weekly workout aggregation, per-member persistence, retry states, demo rules,
and a medium iOS widget. Shoes and challenges share the existing scheduled job.
Updated LLPs 0000, 0003, 0005, 0006 and 0008. Native widget fonts and badge images
use the existing App Group and extension.

[observed] TypeScript passed. The challenge suite passed 9 tests with 52
assertions; the expanded health-sync suite passed 5 tests with 36 assertions.
iOS/Android bundle exports and a signed iOS 26.5 simulator build passed.
Native QA verified Profile navigation, login, the enrollment sheet, the real
Health permission flow and an empty query, 3.2 km progress, cached sync failure
and recovery, 5.4 km completion, rules and the widget's qualified deep link.
Progress/completion used temporary runtime workout fixtures. The native reader
was restored and the test member signed out afterward. Screenshots are in
[`designs/challenges-implementation/`](../designs/challenges-implementation/).

[observed] The shared widget timeline contained the correct completed aggregate
and a Monday invitation. Badge files existed in the App Group; all four Filson
fonts existed in the built extension. Springboard returned only a root element
from Argent, including after opening Simulator, so widget-picker placement and
an actual widget tap could not be verified. No screenshot-derived tap was used.
Actual OS background scheduling remains a physical-device verification item.

## What worked well

[observed] Paper JSX and computed values mapped directly to the existing
Filson ramp and button. Reusing the local Health module and one background job
avoided another data pipeline. The pure calendar model let tests cover both
DST transitions, duplicates, deletions and rounding without a device.

## Friction and blockers

[observed] `expo install expo-asset` installed the package but returned an error
because it could not edit dynamic config. Adding its plugin explicitly fixed it.
SDK 57 prebuild cleans by default; `--no-clean` is the incremental option.
The first running iPad was shared with another task; QA moved to a separate
iOS 26.5 iPad Air simulator.

[observed] The widget target initially had no Resources build phase. Expo's
resource helper silently added fonts to the main app, despite `targetUuid`.
Creating the phase and checking actual target membership fixed this. The
inherited blank stack title also hid Challenges until `headerTitle` was explicit.
Native stack `statusBarStyle` asserted because the project disables
UIViewControllerBasedStatusBarAppearance. The Expo StatusBar entry is used and
remounted after enrollment instead, with `StatusBar.setStyle` after the native
sheet closes. The enrollment action and rules remain in a fixed footer so both
are accessible in an iPad's smaller form-sheet viewport.

## What was hard

[observed] Native scroll insets made some React-tree tap coordinates differ
from the visible controls. The accessibility tree provided reliable frames for
the app and system Health sheets. Springboard did not provide its controls.

[observed] React Doctor's changed scan excluded untracked new files. Its full
scan found two existing errors in category/shop and warnings, including new
complexity and safe-area padding warnings. Moving the enrollment action into a
fixed footer removed the dynamic scroll-container padding. Native QA verified
both footer controls and the restored status bar after dismissal. Incremental
prebuild retained exactly four extension font resources, without duplicates.
No unrelated cleanup or suppression was added.

## Comparative friction

Not observed. No alternative framework implementation was attempted.

## Improvement ideas

[inferred] Resource helpers should require or create a target's Resources phase
and fail if membership lands elsewhere. A public native widget preview API
would allow layout verification without depending on Springboard accessibility.

## Follow-ups

[inferred] Verify actual widget placement/tapping and OS-scheduled Health
refresh on an iPhone. Sweepstakes enrollment and prize fulfillment require a
separate backend; this implementation records only demo progress and entries.
