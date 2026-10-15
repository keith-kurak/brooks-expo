# @brooks/catalog

The shared Brooks data layer for both apps.

- `catalog.json` — a normalized snapshot of the real Brooks US catalog, produced
  by [`tools/harvest`](../tools/harvest). Products, colorways, prices, per-size
  stock, specs, ratings, and image URLs. Each image also carries a blurhash
  placeholder from `tools/harvest/harvest-blurhash.js`.
- `reviews.json` — the current rating summary, fit dimensions, and three newest
  TurnTo reviews for every catalog product, captured from Brooks's PDP controllers.
- `types.ts` — the schema both apps program against.
- `constructor.ts` — a live client for Brooks's public Constructor.io search API,
  which (unlike brooksrunning.com itself) is reachable from a mobile client.

Why a snapshot plus a live search API is explained in
[LLP 0002](../llp/0002-brooks-commerce-api.research.md). Short version:
brooksrunning.com sits behind Akamai Bot Manager, which serves `403` to any
non-browser HTTP client, so an app cannot call its product or cart endpoints
directly. Constructor.io and the Brooks image CDN are both open, so search and
photography stay live.

Regenerate and sync the snapshots with:

```sh
bun run harvest                  # catalog + missing review records
bun run harvest:reviews --refresh # refresh every review record
bun run harvest:blurhash         # hash images that lack a blurhash
bun run sync                     # copy package snapshots into the app
```
