# Challenges implementation evidence

[observed — 2026-10-13] Native screenshots from the iOS 26.5 iPad Air simulator:

- `01-progress-ios.png`: two running workouts totaling 3.2 km.
- `02-complete-ios.png`: three running workouts totaling 5.4 km and one demo entry.

[observed] Workouts in these screenshots were temporary JavaScript runtime
fixtures, used after testing the real Health permission prompt and an empty
native query. No fixtures or Health writes are part of the implementation.
The native reader was restored, the test member removed and the app restarted.

[observed] Widget timeline props, shared badge assets, extension fonts and the
qualified Challenges deep link were checked. These are app screenshots;
actual home-screen widget placement and tapping were not verified because
Springboard provided no accessible widget-picker controls.

See [LLP 0008](../../llp/0008-us-run-club-promotions.research.md#weekly-challenge-implementation)
and the [implementation diary](../../diaries/2026-10-13-expo-weekly-challenges.md).
