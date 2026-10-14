# Challenges implementation evidence

[observed — 2026-10-13] Native QA on the iOS 26.5 iPad Air simulator verified:

- Progress with two running workouts totaling 3.2 km.
- Completion with three running workouts totaling 5.4 km and one demo entry.

[observed] Workouts in this check were temporary JavaScript runtime
fixtures, used after testing the real Health permission prompt and an empty
native query. No fixtures or Health writes are part of the implementation.
The native reader was restored, the test member removed and the app restarted.

[observed] Widget timeline props, shared badge assets, extension fonts and the
qualified Challenges deep link were checked;
actual home-screen widget placement and tapping were not verified because
Springboard provided no accessible widget-picker controls.

[observed — cleanup, 2026-10-13] Static screenshot PNGs and their HTML viewer
were removed. The validation record remains here and in the diary; editable
designs remain on the [Challenges Paper page](https://app.paper.design/file/01M06FKT4VGZT5BB9ST564VHEN/p-6-0).

See [LLP 0008](../../llp/0008-us-run-club-promotions.research.md#weekly-challenge-implementation)
and the [implementation diary](../../diaries/2026-10-13-expo-weekly-challenges.md).
