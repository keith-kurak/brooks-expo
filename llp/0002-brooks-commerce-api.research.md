# LLP 0002: The Brooks Commerce API

**Type:** Research
**Status:** Active
**Systems:** Brooks, Shared, Expo App, Exact App, Data
**Author:** Claude Fable 5
**Date:** 2026-07-13
**Revised:** 2026-10-15
**Related:** LLP 0000, LLP 0003, LLP 0004

## Summary

[observed — network capture, 2026-07-13] brooksrunning.com is a **Salesforce
Commerce Cloud (Demandware/SFRA)** storefront, site id `Sites-BrooksRunning-Site`,
locale `en_US`, currency USD. Its search and browse are powered by
**Constructor.io**. Reviews come from **TurnTo**. Product imagery is served from a
Demandware image CDN that resizes on demand.

[confirmed — end-to-end round trip] The entire in-scope shopping journey works
against the real endpoints: browse a category, open a product, read its price and
per-size stock, select a colorway/size/width, and **add it to a real Brooks cart**.
We drove it once, in full, and the cart came back with the correct line item and
totals. We did not proceed to checkout or place an order.

## The finding that shapes the architecture

[observed] **brooksrunning.com sits behind Akamai Bot Manager.** Every request
from a plain HTTP client — `curl`, `fetch`, a React Native app — gets `403 Access
Denied`, regardless of headers. The same request from a real browser session
succeeds. This is not a CORS problem; it is bot detection keyed on TLS
fingerprint plus the `_abck` cookie that Akamai's sensor script sets.

```
curl -A '<real Chrome UA>' …/Product-Variation?pid=110498   -> 403
same URL, fetch() from inside a warmed Chrome page            -> 200 (220 KB JSON)
```

[inferred] **Therefore a mobile app cannot call Brooks's product or cart APIs
directly, and no amount of header-spoofing will change that.** Trying to defeat
Akamai would be both fragile and exactly the kind of access-control bypass LLP
0000 rules out.

Two Brooks surfaces are *not* behind the bot wall, and both are reachable from a
phone:

| Surface | Reachable from an app? | Use |
|---|---|---|
| `ac.cnstrc.com` (Constructor.io) | **Yes** — 200 to bare `curl` | Live search, autocomplete, browse, facets |
| `brooksrunning.com/dw/image/v2/…` (image CDN) | **Yes** when called with resize parameters | Live product photography, resized on demand |
| `brooksrunning.com/on/demandware.store/…` (SFCC controllers) | **No** — 403 | Harvest via browser, snapshot to disk |
| `brooksrunning.com/*.html` (PDP/PLP pages) | **No** — 403 | Harvest via browser |

[inferred] The resulting design: **live where we can, snapshot where we can't.**
Search and photography stay live against real Brooks services; the product
catalog, prices, and stock are captured by [`tools/harvest`](../tools/harvest)
driving a real browser, and committed as
[`packages/catalog/catalog.json`](../packages/catalog/catalog.json). This keeps
request volume low (one pass, checkpointed, never repeated), depends on no
undocumented bypass, and makes both apps work offline and in Expo Go with zero
setup.

## Constructor.io — the live search API

[observed] Brooks ships a public, client-side Constructor key in its own web
bundle (`https://cnstrc.com/js/cust/brooksrunning_oUqvvk.js`). It is the same key
the website's search box uses and grants read-only search access.

```
key    key_pCFzYTxeXssfLwfW
client ciojs-2.1439.2
base   https://ac.cnstrc.com
```

Three endpoints, all `GET`, all working from a bare client:

```sh
# Browse a category
https://ac.cnstrc.com/browse/group_id/featured-new-arrivals
  ?c=ciojs-2.1439.2&key=key_pCFzYTxeXssfLwfW&i=<install-uuid>&s=1
  &num_results_per_page=24&page=1

# Free-text search
https://ac.cnstrc.com/search/ghost?c=…&key=…&i=…&s=1

# Type-ahead (returns both suggested terms and matching products)
https://ac.cnstrc.com/autocomplete/gho?c=…&key=…&i=…&s=1
```

[observed] A browse response carries `total_num_results`, `results[]`, `facets[]`,
and `sort_options[]`. Each result's `data` holds `id` (Brooks style number),
`name`, `image_url`, `description`, `gender`, `spec_FeelUnderFootTitle`
(cushion), `group_ids[]`, and `variations[]`.

[observed] **Price is not in the Constructor index.** `price_USD` appears in
`sort_options` (so Constructor can sort by it) but is never returned as a field,
and `fmt_options[hidden_fields]` does not surface it. This is the single reason a
Constructor-only app is not possible: it can list Brooks's catalog but cannot
price it.

### Facets (these are the real PLP filters)

[observed] From the `featured-new-arrivals` browse response:

| Facet | Display | Values |
|---|---|---|
| `gender` | Product gender | womens, mens, unisex |
| `productType` | Product Type | Shoes, Apparel |
| `size_Shoe` | Shoe Size | 5.0 … 16.0 (half sizes) |
| `spec_FeelUnderFootTitle` | Cushion | Plush, Balanced, Responsive |
| `width` | Width | Women's 2A/1B/1D/2E, Men's 1B/1D/2E/4E |
| `primaryColor` | Color | 12 values |
| `turntoAverageRating` | Rating | 5, 4 and up, 3 and up |
| `size_Apparel` | Apparel size | XS … XXL |
| `spec_WaterResistance` | Water-resistant | Water Resistant |

Sort options: `relevance`, `sort_newArrival`, `sort_bestSeller`,
`turntoAverageRating`, `price_USD` (asc/desc), `sort_bestInventory`.

### The category taxonomy

[observed] `group_ids` are hierarchical, so a product in
`mens-shoes-road-running-shoes` is also in `mens-shoes` and `mens`. The ones worth
knowing:

```
mens · womens · mens-shoes · womens-shoes · mens-apparel · womens-apparel
mens-shoes-road-running-shoes · womens-shoes-road-running-shoes
featured-new-arrivals · featured-best-sellers · featured-limited-edition
featured-trail-running-collection      <- trail lives here, NOT under *-trail-running-shoes
featured-shoes-in-widths · featured-neutral-running-shoes
sale · sale-mens · sale-womens
brooks-running-shoes · brooks-running-apparel
```

[observed] A trap worth recording: the obvious-looking `mens-shoes-trail-running-shoes`
returns **zero** results. Trail is merchandised under
`featured-trail-running-collection`.

## SFCC — the product and cart API (browser-only)

[observed] All under
`https://www.brooksrunning.com/on/demandware.store/Sites-BrooksRunning-Site/en_US/`,
all requiring `X-Requested-With: XMLHttpRequest` and a warmed Akamai session.

### `Product-Variation` — the one call that matters

```
GET Product-Variation?pid=110498
GET Product-Variation?pid=110498&dwvar_110498_color=197
GET Product-Variation?pid=110498&dwvar_110498_color=197&dwvar_110498_size_Shoe=9.0&dwvar_110498_width=1D
```

[observed] Returns ~220 KB of JSON. `product` contains everything a PDP needs:

- `price.sales` / `price.list` — `{ value, currency, formatted, decimalPrice }`
- `variationAttributes[]` — `color`, `size_Shoe`, `width`; each value has
  **`selectable`, which is the real stock signal**: `false` means that size is out
  of stock in that colorway. Every color value also carries its own 7-image set.
- `images` — `pdpMainLarge`, `pdpTiny`, … each with `url` + `altSEO`
- `bestForSpecs[]`, `productFeatures`, `productWidths`, `productShoeSupportLevel`,
  `productFootwearExperience`, `productStyle` (the franchise)
- `starRating`, `reviewCount`, `badge`, `isSoldOut`, `available`, `readyToOrder`

[observed] Fully specifying color + size + width collapses `product.id` from the
style number to the **variant id**, and sets `readyToOrder: true`.

### Variant id format

[confirmed — round-tripped through the real cart] Brooks variant ids concatenate
style, width, color, and a zero-padded size:

```
style 110498 + width 1D + color 197 + size 9.0  ->  1104981D197.090
```

Implemented in `packages/catalog/query.ts:variantId()`.

### `Cart-AddProduct` — the end of the journey

```
POST Cart-AddProduct
Content-Type: application/x-www-form-urlencoded
pid=1104981D197.090&quantity=1&options=[]
```

[confirmed] Returns `200 application/json`:

```json
{ "error": false, "message": "Product added to cart", "quantityTotal": 1,
  "cart": { "items": [ { "id": "1104981D197.090", "productName": "Hyperion Max 4",
      "quantity": 1, "price": { "sales": { "formatted": "$200.00" } },
      "variationAttributes": [ "Color:197 - White/Cyber Yellow/Black",
                               "Size:9.0", "Width:Medium (1D)" ] } ],
    "totals": { "subTotal": "$200.00", "totalShippingCost": "$5.00" } } }
```

Related, all JSON: `Cart-GetCart`, `Cart-MiniCartShow`,
`Product-PDPDynamicData?pid=` (promotions + badge),
`TurnTo-GetReviews?pid=` and `TurnTo-GetReviewsSummaryAccordion?pid=` (real
customer reviews and rating histograms).

[inferred] Because the apps cannot reach `Cart-AddProduct` anyway, and because
adding to a stranger's real Brooks basket from a prototype would be rude as well
as unreliable, **the apps keep the cart on-device** while building the exact
variant id Brooks expects. The endpoint is documented here so the last mile is a
known quantity, not a guess.

## TurnTo reviews

[observed — warmed browser capture, 2026-08-21] The two SFCC review controllers
return useful structured models in addition to server-rendered HTML:

- `TurnTo-GetReviews?pid=<style>` returns `topReviewsModel.reviews`, the three
  newest reviews with id, date, title, body, integer rating, author, and optional
  badge, plus `totalReviews`.
- `TurnTo-GetReviewsSummaryAccordion?pid=<style>` returns
  `reviewsSummaryModel` with the current average/count and ordered review
  dimensions. Shoe dimensions include `Length` and `Width`; each has a
  zero-based numeric average and five labeled stops from the negative to the
  positive extreme.

[observed — same capture] Review values are live and can move independently of
the older product snapshot. Women's Glycerin Max 2 (`120468`) returned a 4.3
average and 295 reviews on August 21, 2026, while an earlier storefront capture
showed 4.2 and 263. The review harvest therefore owns the rating displayed on
the PDP whenever it has data, rather than mixing its current review bodies with
the catalog's older aggregate.

[inferred] These controllers inherit the same Akamai boundary as
`Product-Variation`, so the mobile app cannot fetch them directly. A dedicated,
checkpointed pass in `tools/harvest/harvest-reviews.js` warms a real browser,
makes two low-volume requests per catalog style, and writes
`packages/catalog/reviews.json`. The bundled snapshot contains only the summary,
fit dimensions, and three reviews already rendered on each public PDP; all-review
and write-review actions hand off to the Brooks product page.

## The image CDN

[observed 2026-10-13] The reachability described below is not universal.
During filter QA, the resized Adrenaline GTS 25 men's color 410 lateral image
returned `403 text/html` at `sw=688&sh=688&sm=fit&sfrm=png&strip=false&bgcolor=F8F8F8`.
The simulator left several newly selected colorway photographs blank while
other photographs rendered. Filter membership and color parameters can
be checked independently, but this response prevents complete photo validation.
No bypass or re-harvest was attempted.

[observed] Open to any client, and it resizes on demand:

```
https://www.brooksrunning.com/dw/image/v2/BGPF_PRD/on/demandware.static/-/
  Sites-brooks-master-catalog/default/<hash>/original/<styleId>/
  <styleId>-<colorCode>-<angle>-<slug>.jpg
  ?sw=800&sh=800&sm=fit&sfrm=png&strip=false&bgcolor=F8F8F8
```

[observed] `<angle>` is a single letter; `l` is the lateral hero shot. Each
colorway has 7 angles. `sw`/`sh` control size, `sm=fit|cut` the fit mode.

[inferred] This is the biggest single lever on how fast the app feels: store bare
URLs, size them at the call site, and a 170pt grid tile fetches a ~340px image
instead of the 2500px master. Implemented in `packages/catalog/images.ts`.

[observed — plain HTTP client, 2026-07-14] Reachability is specific to the
resized request shape above. Some bare `/dw/image/v2/` master URLs and three
otherwise-valid CMS article-hero URLs returned `200 text/html` denial pages.
The apps therefore keep the catalog CDN keys but always add `sw`, `sh`, `sm`,
and output-format parameters at the call site. Editorial sources are checked by
`npm --prefix tools/harvest run validate:editorial`, which requires both an
`image/*` content type and a recognized image signature; denied CMS story
assets use related catalog photography from the resized public CDN.

## Image placeholders

[observed 2026-10-15] An uncached resized image takes about 4 s to arrive
from the CDN. Without a placeholder, a tile is an empty square for that time.

Decision: every catalog image carries a `blurhash` string, computed at harvest
time by `tools/harvest/harvest-blurhash.js` and bundled with the snapshot.
`ShoeImage` and `Photo` look it up by bare URL (`blurhashFor` in
`src/data/catalog.ts`) and pass it to `expo-image` as `placeholder`, with
`placeholderContentFit` equal to `contentFit` so the blur does not jump in
scale when the photo replaces it.

- [observed] The script samples each image at 32 px with the same `sm=fit`,
  `sfrm=png`, `bgcolor=F8F8F8` shape the app requests, so the blur matches
  the framing and near-white background on screen. It encodes 4×4 components
  (about 28 characters per image).
- [observed] Node's `fetch` gets `200 image/jpeg` from the CDN. `curl` and Bun
  `fetch` get `403 text/html` for the same URL, with or without a browser
  user agent. The script therefore runs under Node.
- [inferred] Hashes live in the catalog, not in a runtime computation:
  deriving one on device would need the photo it is a placeholder for.
- [observed 2026-10-15] First run: 4782 of 4783 unique image URLs hashed in
  about 37 minutes at 6 concurrent requests. One CMS image in the catalog
  returns `200 text/html` and has no hash. `catalog.json` grew from 1.97 MB
  to 2.22 MB.
- [observed 2026-10-15] On the EAS cloud simulator, with the photo source
  blocked on purpose, the blurred placeholders showed on PLP tiles and
  swatches, the PDP gallery and swatches, and the Browse franchise art. With
  real URLs, a first visit to a category showed blurred swatches for a few
  seconds before the photos replaced them.
- Images outside the snapshot (live Constructor search results) have no hash
  and keep the plain background. The script is resumable and skips images
  that already have a hash; a failed sample leaves the field absent.

## The harvested catalog

[observed] `tools/harvest` enumerates products through Constructor, then calls
`Product-Variation` once per colorway from inside a real browser session. One
pass, rate-limited, checkpointed to disk so it never re-fetches. Result:

```
226 products (99 shoes, 127 apparel) · 821 colorways · 109 on sale
real prices, per-size stock, 7 images per colorway, ratings, specs
-> packages/catalog/catalog.json (1.9 MB)
```

```sh
npm --prefix tools/harvest install
npm --prefix tools/harvest run harvest   # re-capture (slow; checkpointed)
npm --prefix tools/harvest run sync      # copy into apps/expo + apps/exact
```

## Responsible use

[inferred] Consistent with LLP 0000's "use Brooks services responsibly":

- Only normal, publicly reachable website flows. No access-control bypass, no
  credential capture, no attempt to defeat the bot wall.
- Low volume: a single checkpointed harvest pass, cached to disk; images served
  by a CDN built to serve them.
- Add-to-cart was exercised **once**, to confirm the contract. No order was ever
  placed, and no payment path was touched.
- The Constructor key is the public client key Brooks itself ships to every
  browser; it is read-only.
- The snapshot is a prototype fixture, not a redistribution of Brooks's catalog.

## Open questions

- Does the harvest need to re-run on a schedule for the demo to stay truthful, or
  is a dated snapshot honest enough if the app says when it was captured?
- Brooks's own cart requires the Akamai session. If a future version of this
  prototype wanted a real server-side cart, it would need a small proxy that holds
  a browser session — worth it, or out of scope forever?
- Constructor's `variations[]` were not mined; they may carry per-variant data
  that would reduce the harvest to a single Constructor call per product.
