# LLP 0003: Brooks Design System and Screen Patterns

**Type:** Research
**Status:** Active
**Systems:** Brooks, Expo App, Exact App, Design
**Author:** Claude Fable 5
**Date:** 2026-07-13
**Revised:** 2026-10-13
**Related:** LLP 0000, LLP 0001, LLP 0002

## Summary

[observed] This completes the hands-on pass LLP 0001 called for. Brand tokens are
read from brooksrunning.com's own production stylesheet rather than eyeballed from
screenshots; screen patterns pair that brand with the native-commerce borrows LLP
0001 assigned to Nike, Zappos, adidas, and GOAT.

## Brand tokens

### Color

[observed — `style.css`, `:root` theme block] Brooks's default page theme is
bg `#fff`, border `#e5e5e5`, text `#0e131f`, accent `#003789`, alt-text `#707070`.

| Token | Hex | Where it is used on the site |
|---|---|---|
| `ink` | `#0E131F` | Body text, primary button fill. **This, not `#000`, is Brooks's black.** |
| `blue` | `#003789` | Default accent: links, selected states, focus, cart-badge text |
| `navy` | `#14295F` | Dark-theme background, Run Club card |
| `lime` | `#ECF000` | Cart badge fill, nav highlight, focus outlines, progress fills |
| `sale` | `#D4281C` | Sale prices, errors |
| `surfaceAlt` | `#F8F8F8` | Section background — **and the exact field Brooks shoots product on** |
| `hairline` | `#E5E5E5` | Default border |
| `inkMuted` | `#707070` | Secondary text |

[inferred] **Lime is a spark, not a brand color.** It appears only on badges,
progress fills, and focus states. Used as a surface it stops reading as Brooks.

### Type

[observed] The site is set in **Filson Pro** (Monotype, licensed) at weights
400/500/700/900. Headings are weight 700–900 with very tight leading
(`line-height: calc(1em + 4px)`). Headlines are **sentence case**; ALL CAPS is
reserved for eyebrows, labels, and CTAs, always with ~1.2px positive tracking.

[superseded 2026-08-17] Filson Pro was assumed unavailable, and **Figtree**
(`@expo-google-fonts/figtree`) served as the geometric-humanist substitute.
Licensed Filson Pro OTFs are now provided and bundled in `assets/fonts/`
(Regular 400, Medium 500, Bold 700, Heavy 800, Black 900 — weights read from
each file's OS/2 `usWeightClass`). Filson has no 600; the ramp's 800 slot maps
to Filson **Heavy**. `Caveat` still stands in for the site's handwritten Biro
Script accent — at most one use per screen.

[observed 2026-08-17] The **Paper file still renders Figtree.** Paper reads fonts
from the OS font library, not the repo, and it caches that list at app launch;
the OTFs were copied into `~/Library/Fonts` (family `Filson Pro`, styles
Regular / Medium / Bold / Heavy / Black) but the running app cannot see them.
After a Paper restart, flipping the file's `--font-display` and `--font-body`
tokens to `Filson Pro` converts every artboard at once — that is the only reason
the design system routes both families through tokens.

| Role | Size | Weight | Tracking |
|---|---:|---:|---:|
| Hero display | 40 | 900 | −0.5 |
| Section header | 26 | 800 | −0.3 |
| PDP title | 24 | 800 | −0.3 |
| Nav list row (Shop menu, Account) | 16 | 500 | 0 |
| Product title (tile) | 15 | 700 | 0 |
| Price | 16 | 700 | 0 (tabular) |
| Body | 15 | 400 | 0 |
| Choice control | 13 | 400 | 0 |
| Eyebrow / button | 12–14 | 700 UPPERCASE | +1.2 |

### Shape and motion

[observed] **Brooks zeroes `border-radius` sitewide.** Square corners are a brand
trait; only dots and badges are circles. Buttons are 50pt tall, square, uppercase,
and on press they shift up-left against a **hard offset shadow (`6px 6px 0`)** — a
"pressed sticker," not a soft Material elevation. Reproducing that instead of a
blur is most of what makes the buttons feel like Brooks's buttons. The PDP
purchase action is the storefront-derived exception documented below.

[observed] The site's hero entrance is fade + 40px rise, staggered ~80ms per
element (`.o-hero-home--pre-animation-state`). Sitewide transitions run 0.3–0.6s.

[observed] The brand's most ownable graphic gesture is a hand-drawn **squiggle**
underline used on hover CTAs and annotations.

### Border widths

[observed — `style.css`, `:root` theme block] The site's own border is 1px.
Nothing on brooksrunning.com draws a 1.5px rule; that weight was an app
invention.

[confirmed — human review of the PDP fit grid, 2026-08-27] The PDP size/width
treatment described under **PDP purchase controls** is the app's reference
outlined control, and every other outlined control now matches it. `border`
(`src/theme/border.ts`) holds the three widths and `border.ts` documents which
`colors` value each pairs with:

| width | value | color | role |
|---|---|---|---|
| `border.rule` | 1 | `colors.controlBorder` | outlined control at rest |
| `border.emphasis` | 2 | `colors.ink` | the same control selected or active |
| `border.emphasis` | 2 | `colors.sale` | a control in error |
| `border.rule` | 1 | `colors.hairline` | dividers, ruled rows, card outlines |
| `border.heavy` | 3 | `colors.ink` | the outlined button, the sheet's ink cap |

[observed] What this replaced: resting rules were 1.5pt `hairline` on the chip,
the filter button, the outline icon button, the quantity stepper and the login
field; 2pt `hairline` on the finder answer row; and 1pt `controlBorder` only on
the PDP. Selection variously changed the color alone (filter button), the fill
alone (chip), both (finder), or the color and width (PDP). The visible effect of
unifying them is that a resting control edge is now *thinner but darker*, so it
reads as a control rather than as a pale box, and "chosen" is one gesture —
double the rule, turn it ink — everywhere.

[inferred] Two roles keep a width that the outlined-control rule would get
wrong, each commented at its use site: the finder's 14pt tick stays at
`emphasis` because a single rule vanishes at that size, and the PDP's sold-out
slash keeps a literal `strokeWidth` because it is viewBox units inside a
stretched 100×100 box, not points.

### PDP purchase controls

[observed — Brooks mobile PDP reference `IMG_4196.png`, 2026-08-21] Size and
width choices use a distinct commerce-control treatment rather than the filled
filter-chip state. Choices are 48pt-tall white rectangles with a 1pt neutral
rule; selection strengthens that to a 2pt ink outline without changing the
fill. Unavailable variants keep their footprint and use a pale diagonal from
bottom-left to top-right across both text and surface. Size fills a five-column
grid; width fills a four-column grid and may wrap a long label to two lines.
Both grids use tight 4pt gutters, matching the mobile storefront's dense fit
controls rather than the app's roomier filter-chip spacing.

[observed — same reference] The purchase CTA is a deliberate exception to the
hard-shadow primary button: a flat Brooks-blue rectangle with sentence-case
action copy aligned left and the price aligned right. The shared `Chip`
`productOption` appearance and `Button` `purchase` variant own these treatments;
the PDP owns only the five/four-column composition. This 1pt-to-2pt pair is now
the app-wide outlined-control rule — see **Border widths** above.

[observed — live Ghost 18 PDP, 2026-08-21] Until size and width form a ready
variant, the purchase action keeps the same split `Add to cart` / price layout
but changes its fill to the site's secondary gray `#707070`; both labels remain
white. The app mirrors this readiness state instead of changing the button copy
to an instruction, so the action does not jump as fit choices are made.

### PDP detail sections

[observed — live Ghost 18 PDP and mobile references `IMG_4197.png` through
`IMG_4199.png`, 2026-08-21] The post-purchase hierarchy begins with a full-width
`#F8F8F8` returns band: the circular Run Happy Promise seal, an uppercase
`90-day free returns` label with the sprite's `icon-info`, and one sentence of
90-day trial copy. The seal is the same Brooks CDN asset already bundled for the
home screen, not an app recreation. [observed 2026-10-06] The band is one shared
component, `src/components/run-happy-promise.tsx`. The PDP and the Bag both
draw it; each caller sets only its top margin.

[observed — same sources] Product details are an expanded ruled accordion. The
description spans the content width, then facts form a stable two-column
description list: bold labels at left and regular values at right. `Best for`,
`Cushion`, `Support`, and `Features` are present in the normalized catalog and
render in that structure. Midsole drop, weight, and sustainability appear on
the storefront but are not part of the current normalized snapshot, so the app
omits them rather than embedding Ghost-specific literals or implying that the
fields exist for every product.

[observed — warmed browser capture, 2026-08-21] Cushion and support do not come
from the 81-symbol header sprite. The live PDP serves two standalone 100×100 SVG
assets, `PDP-Icon-BalancedCushion.svg` and
`PDP-Icon-BalancedSupport.svg`. Their path data is preserved verbatim in
`BalancedCushionIcon` and `BalancedSupportIcon`; `InfoIcon`, carets, and rating
stars continue to use the already-captured sprite geometry. The reviews summary
reuses those shared star and caret primitives rather than text stars or generic
system chevrons.

### PDP reviews

[observed — Brooks mobile PDP reference and warmed browser responses,
2026-08-21] The expanded review accordion follows a fixed information order:
large centered decimal score, five stars, dark `Write a review` action, then
fit rails. Each rail has a centered bold label, a thin neutral track with a
short ink segment positioned from TurnTo's zero-based average, and only the two
endpoint labels below it. The page then shows `3 most recent reviews` opposite
an underlined `See all reviews` link.

[observed — same sources] A recent-review row begins with stars and date at left
and the author at right, followed by a bold sentence-case title and unmodified
review body. Reviews are stacked without card chrome; whitespace provides the
separation. The section ends with a centered outlined `See all reviews` action
and the accordion's bottom rule.

[confirmed — user direction, 2026-08-21] The app keeps that storefront hierarchy,
but `Write a review` is intentionally inert in the prototype. Both all-review
actions remain external links to the real Brooks PDP. This is an honest boundary:
the three public reviews can be bundled, while the full TurnTo experience is
live, mutable, and unavailable to a direct React Native request because of
Akamai (LLP 0002).

### Add-to-bag sheet

[confirmed — user direction, 2026-10-06] The sticky purchase bar has no panel
of its own: no white fill, no hairline, no upward `bar` shadow. The page fades
to white behind the button instead (`expo-linear-gradient`, transparent at
the top of the bar, `colors.surface` from its middle down), and the bar is
`box-none` so the faded band still passes taps to the page. The `bar` shadow
token was retired with it.

[confirmed — user direction, 2026-10-06, after an On Running reference] Pressing
`Add to cart` grows the button into an `Added to your bag` sheet, and closing
it folds the sheet back into the button. This replaced the dark auto-dismissing
toast. The sheet holds: a grabber, the title with a close cross, the added
line (photo, name, colorway, `Size · width`, price), and `Keep shopping`
(secondary) beside `Bag (n)` (primary) as the filter sheet's footer pair.
[superseded 2026-10-06] It also ended in a `You might also like…` rail; that
rail moved to the PDP as **Complete the look** (below). Brand rules hold throughout: square corners,
Filson, the app's stacked buttons, `surfaceAlt` behind product photos.

[observed] How the morph is built (`src/screens/product/added-sheet.tsx`):

- One shell view runs from the button's face (gutter insets, `BUTTON_HEIGHT`,
  the bar's bottom padding) to the full-width sheet, its fill going from
  Brooks blue to white over the first 40%. The shell clips the content, so
  nothing shows outside the frame it has grown to; the content is pinned to
  the screen inside it by undoing the shell's offsets. [confirmed — user
  review, 2026-10-06] The first version drew the content over the shell
  unclipped, and it showed outside the shell before the shell had grown.
- The button's own label rides the shell for the first 20% so the press does
  not blank it; the sticky bar fades out over the first 15% so its offset
  outline does not trail behind the shell.
- `progress` is a shared value owned by the PDP so the bar and the sheet read
  one value. Open and close are critically damped springs with overshoot
  clamped: the shell's edges may not pass the screen's.
- A downward drag (velocity-projected) slides the sheet off at full size
  instead of folding it. `Bag (n)` (and, until the rail moved, a rail tile) fold the sheet back into
  the button first and navigate when the fold lands. [confirmed — user
  review, 2026-10-06] The first version unmounted the sheet and navigated at
  once, and the sheet read as vanishing rather than closing.
- It is a transparent RN `Modal`, not an overlay view, so the scrim also
  covers the PDP's native header and Android back closes it. Reduced motion
  fades the finished sheet in place.
- No haptic: the add-to-bag notification was removed on purpose (see
  `utils/haptics`).

[superseded 2026-10-06] `You might also like…` was the other half of the kit
— apparel under a shoe, shoes under apparel — ranked by review count. It is
now **Complete the look** on the PDP.

### Complete the look

[confirmed — user direction, 2026-10-06] The add-to-bag sheet's rail moved to
the PDP as a `Complete the look` section, the page's last block after the
details and reviews accordions. A reader sees it before buying, not only
after. The sheet no longer carries a rail.

[inferred] What it picks (`src/screens/product/complete-the-look.ts`): one
piece for each slot the product does not fill. The slots are shoes, top,
bottom, socks and layer, read from the Constructor groups
(`-apparel-tops`, `-apparel-sports-bras`, `-apparel-bottoms|shorts|tights|pants`,
`accessories-socks`, `-apparel-outerwear`; the shoe slot takes road-running
and trail shoes only, because the most-reviewed men's shoe is a walker).
Each piece is the same gender or unisex and has a colorway in stock. The
product's own franchise ranks first (Ghost socks under a Ghost shoe), then
review count. A unisex product takes its gender from the first gendered pick.

[confirmed — user direction, 2026-10-06] **Do not call it personalized.** The
catalog has no co-purchase, outfit or reader data (LLP 0002). Review count
stands in for popularity, and every reader sees the same look. The section's
subline says so: "Our most-reviewed gear to run in with it."

[superseded 2026-10-06] Four designs, each from a storefront PDP, were
built behind a Profile row that stepped through them. [confirmed — user
choice, 2026-10-06] The flat lay won. The other three, the Profile row and the
`brooks.lookVariant.v1` key are deleted. The table stays as the record of
what was compared ([observed — Mobbin]):

| Design | Source | What it shows |
|---|---|---|
| `rail` | adidas "Complete the look", lululemon "Shop this look" | A snapping rail of square tiles: slot eyebrow, name, price |
| `bento` | lululemon "Complete the Look" | The product in the reader's chosen colorway as a tall tile, beside three stacked pieces |
| `kit` | Nike's look sheet, UNIQLO "Styled items" | Ruled rows (the product first, then each piece) and "The full kit" total |
| `flatlay` | Nike's outfit card | The kit laid out on one `surfaceAlt` field with square price tags |

[observed] Brooks shoots apparel on a model first (`mf`), on a grey backdrop
of its own. On the flat lay those photos read as overlapping boxes. A
laydown shot (`lf`) is the garment alone and sits in the `surfaceAlt` field
without an edge. About 45% of apparel has one, often only in some colorways,
so the flat lay shows the first in-stock colorway with a laydown, and the
piece opens its PDP on that colorway (`lookColorway`). The Shop the look
sheet sells that same colorway.

[inferred] The flat lay shows a look rather than a list. The look is three
pieces (`LOOK_PIECES`), because the card has three spots beside the product;
under a shoe that is a top, a bottom and socks, so the layer slot is unused.
Each piece still opens its own PDP, on the colorway the card shows.

### Shop the look

[confirmed — user direction, 2026-10-06] The flat lay needed an action: a tap
on a piece left the shoe the reader was about to buy, and the look's total
had no button. Under the card, a secondary button, `Shop the look · 4 pieces
· $237.95`, opens a native form sheet (`/shop-the-look`, the same
presentation as Filter & sort, but fitted to its content; the PDP passes its
product, colorway, size and width as params).

[observed — Mobbin, 2026-10-06] The pattern is Ulta's "Now wearing" list with
one "Add 2 to bag" button, Instacart's "Add all 3 items", and Under Armour's
"Shop this look" sheet.

[inferred] What the sheet does (`src/screens/product/shop-the-look-sheet.tsx`):

- One row per piece: the PDP's own product first, then the look. Each
  has a square checkbox, the photo the card used, name, colorway (and width
  for a shoe), price, and a row of the PDP's size chips, sold-out sizes
  slashed. A shoe's row opens on its picked size when that size would start
  off screen.
- Every piece starts checked, except one already in the bag (any colorway or
  size), which starts unchecked and says `Already in your bag`. [observed]
  Without this, a test added a second pair of the same shorts.
- The starting size is the PDP's own pick for its product (`Size 10.0, as
  picked on this page`), else the reader's earlier choice from the bag: socks
  only from socks, shoes only from shoes, and a top, bottom or layer from any
  of the three (`Size M, as in your bag`). This is the reader's own choice,
  not a prediction, and the note says where it came from.
- The footer is the purchase button: `Add 3 to bag · $213.95`. It counts the
  checked pieces and sums their prices, with no bundle discount (the catalog
  has none, LLP 0002). [confirmed — user direction, 2026-10-06] It stays
  enabled with a size missing, as the PDP's button does: pressing it marks
  each checked row without a size with a red `Pick a size` and scrolls to the
  first one. It is disabled only when nothing is checked. The first version
  greyed it out with `Pick a size for …` above it; the user rejected that.
- [confirmed — user direction, 2026-10-06] The list has no rules: none
  between rows, above the first, under the last, or above the footer.
  Whitespace separates the rows. (A version with rules only between rows was
  also rejected.)
- [confirmed — user direction, 2026-10-06] The footer copies the PDP's sticky
  bar (**Add-to-bag sheet**, above): no panel, the list scrolls under a
  gradient from transparent to `colors.surface` at its midpoint, and the band
  is `box-none`. The band sits below the list and overlaps its end by the
  48pt fade. The list pads its end by the fade, so the last row still clears
  the button.
- [confirmed — user direction, 2026-10-09] The sheet is as tall as its
  content (`sheetAllowedDetents: 'fitToContents'`). A look with unchecked
  pieces, or the one-row confirmation, no longer opens a sheet that is mostly
  white. The fixed `0.92` detent it replaced was the same height for every
  state. [inferred] The sheet stops at 0.92 of the screen below the status
  bar, about the height of that fixed sheet, and past that the list scrolls.
- [observed — iOS 26.5, iPhone 17 Pro simulator, 2026-10-09] The sheet's
  height is not the height of the view it measures. react-native-screens adds
  the native bar's frame (54pt), and UIKit adds the bottom safe area (34pt).
  The sheet's content starts under the bar and pads for both, so the root
  view takes them back out with a negative bottom margin of
  `useHeaderHeight()` plus the bottom inset. `useHeaderHeight()` is 70pt: it
  also counts the 16pt between the sheet's top and the bar, under the
  grabber. So the sheet ends 16pt into the footer's bottom padding, and the
  button keeps a 26pt margin to the sheet's edge.
- [observed] The footer no longer floats over the list with the list padded
  by its measured height. With `fitToContents`, a height that arrives after
  the first layout would resize the sheet again. In the layout flow, the
  footer counts from the first layout, and the sheet slid up in one motion
  on the simulator. Android was not run; there the sheet has no native bar,
  and the root takes no negative margin.
- After the add, the same sheet confirms: `Added to your bag`, the added
  lines, then `Keep shopping` and `Bag (n)`. The confirmation is here, not in
  the add-to-bag sheet, because that sheet grows out of `Add to cart`, which
  the reader did not press.
- [observed] `Bag (n)` uses `router.dismissTo('/cart')`. `router.navigate`
  from inside the form sheet mounted the tab navigator inside the sheet.

### Icons and the logo

[observed — real-browser capture, 2026-08-17] The site ships its entire icon set
as one **inline SVG sprite of 81 `<symbol>`s** in the page header (plus a second,
40-symbol `tt-icon-*` sprite that belongs to the TurnTo review widget, not to
Brooks). There is no icon font and no standalone icon-file URLs; page HTML is
behind the Akamai bot wall (LLP 0002), so the sprite was captured from a warmed
Playwright Chrome session — the same technique `tools/harvest` uses.

Ported verbatim into [`src/components/icons.tsx`](../src/components/icons.tsx)
(single-color glyphs behind `BrooksIcon`, plus two-color `InfoIcon` and
`CushionMeter`). What the inventory shows:

- [observed] The utility glyphs (`icon-search` 18×18, `icon-cart` 20×18,
  `icon-account` 16×18) are **fills that encode thin line-work**, drawn in
  `#090708`/`#0E131F`. They are the header's search / minicart / login icons.
- [observed] The encoded line weights are **not uniform across the sprite**:
  the search ring is ~1.9 viewBox units, the cart ~1.3, the account ~1.4, so
  equal render sizes read as unequal stroke widths. The site masks this by
  rendering each glyph near its native size. `BrooksIcon` keeps the paths
  verbatim and offers a `thicken` prop (a same-color stroke over the fill) so
  call sites can normalize weight; a fill cannot be thinned.
- [observed] Ratings use a three-state **border-star** (`--full`, `--half`,
  `--empty`, 15×15), displayed at ~11px in PLP/PDP teasers. `Stars` in the apps
  now renders these.
- [observed] Carets are wide, thick chevrons (38×22 and 22×38), distinct from the
  thin 32×32 `icon-close-thin`. Several close variants coexist (`icon-close`,
  `-thin`, `-updated`, `-banner`, `-white`).
- [observed] The squiggle exists as real geometry: `icon-squiggle-1` (133×15,
  footer newsletter), `cta-hover-squiggle` (112×7, link hover), and a stroked
  `icon-long-squiggle` themed per accent via a CSS variable.
- [observed] The PDP **cushion meter** is three sprite symbols
  (`icon-cushion-level-{standard,more,most}-s`, 140×16) in a blue (`#5E88BA`)
  that appears nowhere in the color tokens above.
- [observed] `#icon-logo` (120×20) is the licensed BROOKS wordmark, letters drawn
  as six paths in the order R, O, K, S, O, B. `BrooksWordmark` now uses it
  verbatim, replacing the earlier hand-traced approximation.
- [observed] There is **no home and no storefront glyph** — a website needs
  neither — so the app's home and browse tab icons are hand-drawn to match the
  real set's line weight. [superseded 2026-08-17] The tab bar became the
  system-rendered native tab bar (`NativeTabs`), which accepts only SF Symbols /
  Material Symbols or raster images — so no tab rendered a sprite glyph or a
  hand-drawn stand-in, and the lime-with-blue-text cart badge went `blue`
  because the system badge's text is fixed white on iOS.

### The tab bar is app-drawn again

[superseded in part 2026-09-24 → *Liquid Glass devices get the system tab
bar*: this section now describes the bar on devices without Liquid Glass only.]

[observed 2026-08-21] `NativeTabs` is gone; the bar is drawn in JS
(`components/tab-bar.tsx` + `components/tab-icon.tsx`) over React Navigation's
JS tabs (`expo-router/js-tabs`). Three things drove the reversal, in order of
weight:

- **The sprite could not reach the tab bar.** The system bar renders its own
  items, so the one piece of chrome every session touches was the one piece
  wearing Apple's icons instead of Brooks's. Cart and Profile are now
  `#icon-cart` and `#icon-account` verbatim; Shoe Finder wears `#icon-search`
  (see the focus-rule constraint below). Home and Browse stay hand-drawn.
  [superseded 2026-10-06 → *Browse and Shoe Finder swap glyphs* below: Browse
  wears `#icon-search`, and Shoe Finder wears a drawn shoe.]
- **Four tabs was a hard ceiling.** A fifth regular tab plus the detached
  `role="search"` trigger tipped `UITabBarController` into a "More" tab, which
  swallowed the search role. That is why Shoe Finder had no slot. The app-drawn
  bar has no such rule, so Home / Browse / Shoe Finder / Cart / Profile all fit
  and **Search gives up its tab instead** — it was always reachable from the
  Browse header's search field and the category header, both of which push
  `/search` onto the current tab's stack, where the native `Stack.SearchBar`
  [superseded 2026-08-26 → *Browse is the search screen*: there is no pushed
  search screen; Browse's own field is the search]
  still comes up with it.
- **The badge.** Lime fill with blue text is the site's own minicart treatment
  and is back.

[observed] The focus indicator is an ink dash **on the bar's top edge** rather
than the system's tint-only selected state, and it slides between tabs on the
same motion as the PDP / catalog-tile color rail: `INDICATOR_MS` and
`INDICATOR_EASING` are imported from `components/underline-rail.tsx`, not
restated, so the two cannot drift. It rides a native CSS transition, so
selection never touches the JS thread. The dash is 44pt wide, not the full slot
width (~80pt on a 402pt frame) — it marks the tab, not the hit area.

[observed 2026-08-21] The top edge *is* the dash's track, which fixes two
things that a rule floating 6pt above a hairline border did not get right. The
dash and the edge are drawn at one thickness (2pt), so the moving ink reads as
the same stroke as the line it travels along instead of a second, thicker mark
hovering over it; and the dash sits at the edge's own y, so nothing about the
bar's chrome moves when selection does. The edge therefore stops being a
`borderTopWidth` hairline and becomes an explicit 2pt track `View` that the dash
is positioned inside — a hairline dash would be a ghost, so the thickness has to
come from the dash, not the border. Doubling the thickness would have doubled
the visual weight too, so the track drops from `hairline` (#E5E5E5, the site's
border gray) to the paler `surfaceSunken` (#F2F2F2) and lands back near the
intended lightness.

[observed] Layout needs no per-screen work, which is not the obvious answer.
`BottomTabView` renders each screen with `StyleSheet.absoluteFill`, which reads
like "content goes under the bar" — but that fill is relative to a sibling
container styled `screens: { flex: 1 }`, with the tab bar next to it in the same
column. A non-absolute bar therefore *shortens* the screen instead of covering
it. The bar also owns the bottom safe-area inset. So every scroll container and
the cart's sticky checkout bar keep the padding they had, and anything that added
the bar's height on top of `insets.bottom` double-counted it by ~85pt. The bar
still measures itself and publishes the height through
`BottomTabBarHeightCallbackContext`, purely so `useBottomTabBarHeight()` reports
the truth rather than React Navigation's UIKit estimate for a bar that is not
React Navigation's.

[observed] Two behaviors the JS bar has to supply itself, because React
Navigation's own tab button supplies them and a custom `tabBar` replaces it:
switching tabs is `CommonActions.navigate(route)` dispatched at `state.key`, and
a second tap on the focused tab pops that tab's stack back to its anchor. The
pop must be addressed to the nested stack's own key — actions bubble *up* from
the navigator they are dispatched on, so an untargeted `popToTop()` escapes the
tab navigator into the root stack and silently does nothing.

[observed 2026-10-06] [confirmed — human request, 2026-10-06] A second tap on
the focused tab also scrolls its anchor back to the top. The bar supplies only
the `tabPress` event; each tab's scroll root listens for it with
`useScrollToTop`, which acts only while that screen is focused and first in its
stack. So a tap that pops a pushed screen does not also scroll the anchor under
it. The scroll roots that listen: `ScreenScrollView` (Cart, Profile, Finder
results), `useHeaderScroll` (Home, Browse), Browse's search results, and the
Finder's quiz and activity pages. Checked on an iPhone 17 Pro (iOS 26.5) under
both bars: Home and Browse, scrolled two screens down, came back to the top
with the header or search row shown.

[observed] The focus rule constrains which glyphs are usable. `#icon-filters`,
the site's three-bar funnel, was the first choice for Shoe Finder on semantics
("narrow this down"), but its top bar is a 21px horizontal rule that merged with
the focus rule above it into a four-bar stack — the indicator stops indicating.
Any glyph whose top edge is a long horizontal is disqualified by a bar with a top
rule. [inferred] Measured at the original 8pt rule-to-glyph gap; the dash now
rides the bar's edge, 14pt above the glyph, which weakens the collision without
removing it, and the ruling was not re-tested at the new spacing. Shoe Finder
wears `#icon-search` instead; its ring cannot be confused with the rule, and
Search itself is a pushed screen, so the tab bar is the only place that glyph is
a destination.

#### Browse and Shoe Finder swap glyphs

[observed 2026-10-06] [confirmed — human request, 2026-10-06] Browse wears
`#icon-search` and Shoe Finder wears a shoe, on both bars. The reasoning above
expired with *Browse is the search screen*: there is no pushed search screen,
and Browse's own field is the search, so the magnifier now names the tab it
leads to. The 2×2 grid is gone.

- [observed] The sprite has no shoe glyph, so the shoe is drawn in
  `tab-icon.tsx` at the shared 2.2 stroke, after the SF Symbol `shoe` that the
  glass bar uses: a profile with the toe to the right and a midsole line. The
  first draft was 12 units tall and read small and low beside the ~18-unit house
  and person. It is 15.6 units tall now and reads at the same height.
- [observed] It still passes the focus-rule test: its top edge is a 2-unit heel
  collar and a slope, and its long horizontals (sole, midsole) are at the bottom.
- [superseded later the same day → *The glass bar wears the Brooks glyphs*]
  The glass bar's Browse trigger used `magnifyingglass`.

### Liquid Glass devices get the system tab bar

[superseded 2026-10-06 by *Liquid Glass is a Profile toggle* below] The glass
bar is no longer the default, and the choice is no longer fixed at launch. The
rest of this section still describes the glass bar itself.

[observed 2026-09-24] The tab layout (`app/(tabs)/_layout.tsx`) now picks its
bar once at launch. Where `isLiquidGlassAvailable()` (from `expo-glass-effect`)
is true — iOS 26 and later, unless the app opts out of the new design — it
mounts `NativeTabs`. Everywhere else (Android, web, iOS 18 and earlier) it keeps
the app-drawn `BrooksTabBar` described above. The choice is the module constant
`NATIVE_TABS` in `utils/native-tabs.ts`, not state: a `NativeTabs` whose shape
changes at runtime remounts its navigator. [confirmed — human request,
2026-09-24] Liquid Glass devices use the system bar. [inferred] On those
devices the glass bar is what every other app wears, so an app-drawn bar stands
out as not native; elsewhere the brand bar has no system look to compete with.

What the glass bar gives up and keeps:

- [superseded 2026-10-06 → *The glass bar wears the Brooks glyphs* below]
  **Icons were SF Symbols**: `house`, `square.grid.2x2`, `shoe`, `cart`,
  `person`, each with its `.fill` form when selected. The focus dash stays on
  the app-drawn bar only. [confirmed — human
  request, 2026-09-24] Icons only, no titles, as on the app-drawn bar. A
  `hidden` label blanks the item title, so each trigger carries its name as
  `accessibilityLabel` instead.
- [observed] **Five tabs fit.** The August "More" tab came from five regular
  triggers *plus* the detached `role="search"` trigger. Browse is the search
  screen now, so there is no search trigger and Shoe Finder keeps its tab.
  [observed 2026-10-06] The third tab is Shoes now, with the same glyph; the
  Finder is pushed from it (LLP 0006#the-shoes-tab).
- [observed] **The badge is blue with white text**, as in August; iOS fixes the
  badge text to white. `NativeTabs.Trigger.Badge` ignores `hidden` when it has
  text, and shows "0" for an empty cart unless the text is left out.
- [observed] **The selected tint is dynamic**: ink on light glass, white on
  dark glass. Glass flips to its dark appearance over Shoe Finder's navy panel
  and Home's blue footer, where a fixed ink tint was nearly invisible.
- [observed] **Pop-to-top on re-tap is the system's; scroll-to-top is the
  app's.** The JS bar's pop does not run here. [superseded 2026-10-06] The
  system's scroll-to-top worked on Home and not on Browse: react-native-screens
  scrolls only the first `UIScrollView` down the first-subview chain
  (`RNSScrollViewFinder`). [observed 2026-10-06] Every trigger now sets
  `disableScrollToTop`, and the screens scroll themselves on `tabPress`, as
  under the JS bar. `NativeTabs` still emits `tabPress` on a repeated
  selection, so Browse scrolls to the top under the glass bar too.

[observed] The two bars have opposite layout models, and that is most of the
work. The JS bar is a flex sibling that shortens the screen. The glass bar
floats over the screen, which runs to the bottom of the window. Two things
follow:

- Every tab trigger sets `disableAutomaticContentInsets`. Without it,
  react-native-screens flips each tab's first scroll view from
  `contentInsetAdjustmentBehavior="never"` to `automatic`
  (`RNSScrollViewHelper`), and every screen here already pads for the top safe
  area itself, so the top inset would count twice.
- Screens clear the bar through `useTabBarOverlap()`: 0 under the JS bar, and
  under the glass bar the bottom inset of the `SafeAreaProvider` that
  `NativeTabs` puts around each tab. [inferred] That inset is the bar plus the
  home indicator; on the iPhone 17 Pro (iOS 26.5) every scroll end came to rest
  above the bar. Scroll roots take it as `contentInset.bottom`, so content still
  scrolls under the glass and the caller's own `paddingBottom` keeps its meaning.
  `Screen` adds it to the caller's bottom padding. The cart's checkout bar grows
  by it and keeps running to the window's edge, so the glass sits on its white
  fill rather than on rows scrolling behind it. The hook reads an
  `InTabContext` from the shared array-group layout, so a root-stack screen
  (Login, the PDP) gets 0.
- Browse's empty search state reserves the larger of the keyboard and the glass
  bar, instead of the keyboard minus the JS bar's height.

#### The glass bar wears the Brooks glyphs

[observed 2026-10-06] [confirmed — human request, 2026-10-06: "ios should be
custom only", "same as the js tab bar"] The glass bar shows the same five
glyphs as `BrooksTabBar`, not SF Symbols.

- [observed] `NativeTabs.Trigger.Icon` takes SF Symbols, asset-catalog names
  (`xcasset`), or image files (`src`). As a React element, `src` accepts only
  `VectorIcon` (an icon font); anything else logs a warning. So the glyphs ship
  as PNGs in `assets/tab-icons/` at @1x/@2x/@3x, and `src` uses them with
  `renderingMode="template"`.
- [observed] `tools/tab-icons/render.js` writes them. It copies `TabIcon`'s
  geometry (24pt slot, per-glyph size, `thicken`) and the sprite paths, builds
  one SVG per glyph and scale, and rasterizes with macOS `sips`, which reads SVG
  and keeps alpha. Rerun it after changing a glyph in `tab-icon.tsx` or
  `icons.tsx`. Two copies of the geometry can drift; the script header names
  both sources.
- [inferred] PNGs, not an asset catalog, because `require`d images are JS
  assets and ship in an EAS Update; an `xcasset` needs a native build.
- [observed] On the iPhone 17 Pro (iOS 26.5) the template images tint like the
  SF Symbols did: ink on light glass and white on dark glass over Shoe
  Finder's navy panel, with the system's selection pill. Selected and
  unselected use the same image, because the sprite has no filled forms.
- [observed] The cart badge is still the system badge (blue, white text).
  It was not re-checked after the icon change.

### Liquid Glass is a Profile toggle

[observed 2026-10-06] Every device opens on the app-drawn `BrooksTabBar`. On a
Liquid Glass device, Profile has a *Liquid Glass tab bar* switch that mounts
`NativeTabs` instead. [confirmed — human request, 2026-10-06] The default is the
custom JS bar, and the switch shows only where glass is available. The row is on
both the member screen (after *Check for updates*) and the guest pitch (after the
perks), because most testers never sign in.

[observed 2026-10-06] [confirmed — human request, 2026-10-06] The switch is one
of the shared *settings rows* now (`SettingsRows` in `screens/account`): Shoe
Finder, *Check for updates*, and the glass switch. A member sees them under the
club card; a guest sees them under the perks, below a `Settings` eyebrow, so
nothing in them needs an account. Rows with no action are gone: *Your bag*
(the Cart tab already reaches it), *Order history*, and *Run Happy Promise*
(checkout is out of scope, so neither had a screen). The guest pitch is now
taller than the iPhone 17 Pro screen, so `Log in or join` sits one short
scroll down.

- [observed] `utils/native-tabs.ts` keeps `LIQUID_GLASS =
  isLiquidGlassAvailable()` as a constant, because that answer cannot change
  while the app runs. The choice is a small store over `kv-storage` (key
  `brooks.glassTabs.v1`), read with `useNativeTabs()`. Storage is synchronous,
  so the stored bar is the one the first frame mounts. Off a glass device the
  store always reads false.
- [observed] `useTabBarOverlap()` reads the same store, so every screen's bottom
  inset switches with the bar.
- [observed] Switching the bar swaps the tab navigator, and a new navigator
  starts on Home with fresh state. `setGlassTabs(on, from)` records the screen
  that holds the switch, and the tab layout's effect navigates back to it once
  the new navigator is up. On the iPhone 17 Pro (iOS 26.5) Profile stayed
  focused both ways. Profile's scroll position and stacks pushed inside other
  tabs are lost. `initialRouteName` is not the fix: `NativeTabs` does not pass
  it to its router.
- [observed] The guest pitch scrolls now, with `alwaysBounceVertical={false}`
  and `flexGrow: 1`, so it stays still and pins the button low where it fits.
  With the switch drawn it did not fit on an iPhone SE (3rd generation): the
  button went under the tab bar. Because `flexGrow` sizes the content to the
  full frame, which runs under the glass, this screen takes the glass overlap
  as bottom padding, not as `contentInset` like other scroll roots.

### The header collapses on scroll

[observed 2026-08-21] The tabs had a native transparent `Stack` header with the
wordmark in a `Stack.Toolbar`. It is app-drawn now
(`components/brooks-header/`), for the same reason the tab bar is: the chrome the
reader touches on every screen should be the site's own. The bar is flat
`#003789` with the white wordmark at the leading edge and the site's own trailing
glyphs, which is the header brooksrunning.com actually ships — the earlier plan
of a transparent header cross-fading to a blurred white bar past the hero
([superseded] in *Screen patterns*) was a native-app idiom the site never had.

[observed] The motion is a port of the `instagram-header-on-scroll-animation`
study in `rn-makeitanimated`, which is more careful than "hide on scroll down"
and worth keeping intact. It runs two regimes:

- **Near the top** (within three header heights) the header's offset is a direct
  function of scroll offset, so it peels away with the finger and comes straight
  back with it.
- **Deeper in** absolute offset says nothing useful, so the header hides against
  the offset the *drag began at* — a short flick from deep in a list hides the bar
  by exactly the distance dragged — and a fast upward flick (>1.25pt/ms) reveals
  it outright on a 160ms timing animation instead. A slow upward drag does not:
  without the velocity split the bar flickers on every gentle scroll.

The two regimes cannot both own the header, which is the part that is not
obvious. A flick-reveal at offset 200 would be overwritten on the next frame by
the near-top formula, which says "offset 200, therefore hidden" — so the reveal
latches a `skipTopInterpolation` flag that hands control to the flick regime
until the reader is genuinely back at the top.

[observed] Three deliberate deviations from the study:

- **The block is full-bleed.** The status-bar inset is padding *inside* the
  header, not a strip that stays behind it, so a minimized header leaves no blue
  anywhere and the wordmark is never clipped against a band above it. The study
  could leave its safe area filled because its app is black; a blue remnant over
  white commerce content is just a bruise.
- **The snap is a worklet, and it stands down during a fling.** The study
  finished a half-hidden bar with `scheduleOnRN` + an imperative
  `scrollToOffset`, then blocked touches for a 300ms `setTimeout` so the
  programmatic scroll could not be interrupted. Reanimated's `scrollTo` does it
  from the worklet, so the snap never crosses to the JS thread and there is
  nothing to guard. [observed 2026-08-21] It also only fires when the finger
  lifted at rest (<0.2pt/ms): `scrollTo` *cancels* iOS's deceleration, so
  snapping into a fling replaced the reader's flick with a ~header-height scroll
  — the content visibly stopped short, and the to-top branch yanked it backwards.
  A list still travelling resolves the header on its own, so there is nothing to
  snap.
- **The flick is decided once per gesture.** The study re-reads
  `velocityOnEndDrag` on every frame, and that value outlives its gesture — so
  any later direction flip during deceleration (the rubber-band at the end of a
  list, an overshoot settling back) still read as a flick and slammed the header
  open with no finger on the screen. The lift now sets a `revealRequest` flag,
  cleared when the next drag begins.
- **Position and opacity share one style function.** The study evaluates the same
  branch conditions twice per frame in two `useAnimatedStyle` bodies, which only
  invites the two to disagree.

[observed] The header owns the status-bar style, because it owns what is behind
the clock: light while the blue is up, then the screen's own choice once it is
gone (`dark` by default; Home passes `light` for its video hero). That flip is
the only place this animation touches the JS thread, and only on a crossing. It
is also gated on `useIsFocused`: tab screens stay mounted when they lose focus,
and React Native resolves the status bar from the last *mounted* entry rather
than the visible one, so an unfocused screen has to withdraw its entry or the bar
reports whichever tab mounted most recently.

[observed] **Which controls appear is per screen**, which is the whole point of
the module's shape: `useBrooksHeader({ actions: [...] })` returns the header
element and the scroll props that drive it from one call, so a screen cannot
half-wire it. Named built-ins (`search`, `account`, `cart`, `menu`, `filters`)
resolve to the site's glyphs, correct line weights, and destinations; a screen
that needs something else passes a config object instead.

[superseded 2026-08-26 → *Only Home wears the header*] Four anchors mounted it:
Home with `search`, Browse and Cart with the wordmark alone, Profile with
`search · cart · menu`. Only Home still does.

The cart glyph takes its count from the store rather than from the caller, so a
screen cannot show a stale badge; it keeps the lime-fill/blue-text treatment,
ringed in the bar's own blue.

#### Only Home wears the header

[observed 2026-08-26] The blue bar is Home's alone. Browse, Cart, and Profile
gave it up, and the reason is what the last round of trimming had already
half-shown: once Browse and Cart carried no controls, each of those screens was
running a two-regime collapse animation in order to reveal a logo the reader had
seen on the previous tab. The bar was chrome about the app rather than about the
screen — and being on four of five tabs, it was also the widest blue block in a
white catalog.

[observed] Each of those screens already names itself in content — `Shop`,
`Bag (n)`, `Hey, <name>.` — set in the `h1` ramp step, which is larger and more
legible than the wordmark ever was and scrolls away like the content it belongs
to. Removing the bar loses nothing they were saying and gives back roughly a
header's worth of first screenful.

[confirmed] Home is the exception because its header is the one that is doing
work: it floats over a full-bleed video hero the way brooksrunning.com's floats
over its own, the white wordmark and search glyph need the blue behind them to
be legible against moving footage, and it carries the status-bar flip from
`light` to `dark` as the hero scrolls past.

[observed] **The safe area had to become a primitive when the header left.**
`useBrooksHeader` was handing back a `headerHeight` that already contained the
status-bar inset, so a screen padded by that single number and turned the native
inset adjustment off. Take the header away and three screens each recompute
`insets.top + <some gap>` inline — which Shoe Finder and Login had *already*
written independently, so the drift was real rather than hypothetical.
`components/screen` holds it instead:

| Export | What it is |
|---|---|
| `Screen` | Non-scrolling root: flex, surface fill, safe-area top. |
| `ScreenScrollView` | Scrolling root: the same top applied to the content container, so the fill still runs under the clock. |
| `ScreenHeading` | The in-content `h1`, on the shared gutter and bottom rhythm. |
| `useScreenTopPadding` | The number, for a root that can be neither (a `FlatList`, or a container that owns its scroll handler). |

The gap above the first line is `spacing.xl` — the value Shoe Finder and Login
had each picked, now named once. `contentInsetAdjustmentBehavior` stays `never`
for the reason the header's scroll props set it: the safe area is accounted for
exactly once, and letting UIKit add it again pads the content twice.

[observed] Shoe Finder adopted the primitive with the rest; its intro keeps the
navy fill by passing it as a style override, which is the design-system rule that
a caller may override layout but not identity. Login did not: it is presented as
a modal, whose iOS card starts *below* the status bar already, so it keeps its
`Platform.OS === 'ios'` branch and the comment saying why.

[observed] The empty Bag lost its magic top offset in the same change. It used to
start at `headerHeight + spacing.xxl`; it centres in the screen now, which is
what the state actually wants and which no longer encodes a header that is not
there.

[observed] Home is the one screen whose content runs *under* the bar rather than
below it — the site's header floats over its hero, and `StretchyParallaxScrollView`
already owned the only scroll handler Reanimated allows per scrollable, so it
takes the header's three worklets as a `scrollHandlers` prop instead of the
header attaching a second handler that would silently replace it. [superseded
2026-08-26 → *Only Home wears the header*] Every other screen used to pad its
content by `headerHeight` and turn the native inset adjustment off; there are no
other screens now.

[observed] Reduced-motion readers get the header pinned open, not a faster
collapse: chrome that vanishes is a layout change, not decoration.

#### Browse is the search screen

[observed 2026-08-26] There is no pushed `/search` screen any more, and no
native `Stack.SearchBar`. Browse opens on a real input — `components/search-bar`,
the square `#F8F8F8` box with the site's search glyph that the screen had drawn
for years as a fake `Press` — and the Home header's search glyph and the PLP's bar
button both `navigate` to Browse instead of pushing a screen, asking it for the
keyboard on arrival.

[confirmed 2026-08-26] That ask is a one-shot signal (`store/search-focus`), not
a route param. It was a `focus=1` param that Browse cleared once consumed, and
the clear is a no-op — the render straight after `router.setParams({ focus: '' })`
still reads `"1"`. So the param never changed again and only the *first* press of
the glyph ever opened the keyboard. Browse reads the signal when it gains
navigation focus rather than on mount, because the two callers arrive
differently: the glyph is a tab switch that may be what mounts Browse, while the
PLP button pops a screen off Browse's own stack. Gaining focus is the one event
both share, and it is also late enough that the field is attached.

[observed] Above Browse's content sit two bands, and they move differently:

- The `Shop` title is **fixed**. It never scrolls.
- The search field below it **collapses** on exactly the header's two regimes
  (`useCollapse`, extracted from `BrooksHeader` so the two share one
  implementation), with the field's own row height as the travel. It peels away
  under the title as the reader scrolls and returns on an upward flick; the title
  is untouched either way.

[observed] Focusing the field flips one progress value on the UI thread, eased
with the tab bar's indicator curve (`INDICATOR_TIMING_EASING`, the same
`(0.77, 0, 0.175, 1)` bezier as `withTiming` rather than a CSS transition):

- the field rises one title row so it sits where `Shop` was, and the title fades
  under it;
- *both* its edges give up a 48pt slot, and one outlined square slides into each
  from off its own side of the screen: `Filter & sort` from the right
  (`components/filter-button`: the site's `#icon-filters` glyph, wearing the
  applied count once there is one) and a dismiss cross from the left. Same
  progress value, same curve, mirrored sign — they read as one control row
  opening, not two buttons arriving;
- the browse content cross-fades to the results (`screens/shop/search-results`,
  the old screen's body without its chrome), which still run the live
  Constructor.io type-ahead (LLP 0002).

[observed 2026-08-27] With nothing typed, the results body is **one centred
empty state**, not a rail of chips. A horizontally scrolling `ChipRail` used to
sit directly under the field carrying six trending terms, and the same rail
carried the index's live term suggestions once typing started. `Superseded`:
both are gone. The rail was a row of taps offered before the reader had said
anything, in the one place on the screen where the eye is already on the field;
the empty state says what the screen is for instead, in the house pattern the
empty bag already uses (eyebrow, squiggle, a line of voice, a hint). The live
index's **term** suggestions went with it: product hits are what the reader is
after, and the terms cost a row of chrome above them.

That removal moves one condition. "No matches" used to require the index to
return neither terms nor products. With the terms no longer drawn, products
alone decide it, or a query that matched a term but no shoe would explain
nothing.

[observed 2026-08-27] The empty state is centred **between the field and the
keys**, not in the screen, and it rides the keyboard's own curve there
(`useReanimatedKeyboardAnimation`, react-native-keyboard-controller). The body
already begins at the field's bottom edge, so reserving the keyboard's height at
its foot makes the free space exactly that gap.

The subtraction that makes it land is the tab bar's height
(`useBottomTabBarHeight`). Keyboard Controller measures the keyboard frame from
the bottom of the **window**, but this body's bottom edge is the **tab bar's top
edge**, because the JS bar shortens the screen rather than covering it (see
*Icons and the logo*). Padding by the raw keyboard height therefore
double-counts the bar. On an iPhone 17 Pro Max that put the copy at 334pt
against a true centre of 375pt; with the bar's height taken off, the measured
centre is 375.5pt against a free region of 142 to 608.3pt. The empty state keeps
its own scroller, with nothing to scroll: `flexGrow: 1` gives the content the
viewport's height so the centring works, and the drag it still accepts is what
dismisses the keyboard, which with an empty field is also the way back to
Browse.

[observed 2026-08-27] The two 48pt squares share `components/outline-icon-button`
— the 1.5pt hairline rule, the square metric, and the ink-outline "active" state
live there once. `FilterButton` composes it and passes its count badge as
children; the `label` variant keeps its own `Press`, being a text button rather
than a square.

[observed 2026-08-27] There was briefly a second cross *inside* the field, drawn
once there was something to clear. `Superseded` — it is gone. With the left
square already present for the whole of search mode, the two sat a thumb's width
apart running the same routine, and only one of them was reliably there.

- The **left square** is the way out, and now the only clear. It is present for
  the whole of search mode, so dismissing never depends on there being text to
  clear — before this, an empty focused field could only be escaped by blurring
  it.
- The **field draws no state of its own**: focus is the keyboard's job rather
  than a border's, and `clearButtonMode` stays `never`, so iOS does not put its
  own cross back where the drawn one was.

That single exit routine — clear the text, blur the input, hand the screen back
to Browse — lets the collapse formula resume control of the field the moment the
progress value returns to zero. It holds a 150ms guard against iOS's resign-time
change event (which carries the *old* text and lands *after* the empty string),
so it is exposed on `SearchBarHandle` as `reset` rather than being
re-implemented by the outside caller; the bare `TextInput.clear` on the same
handle does none of that guarding.

[observed] `Filter & sort` is a native **form sheet** (`/search-filters`,
`presentation: 'formSheet'`, one 92% detent, grabber shown), presented by the
root stack. It is a port of the panel brooksrunning.com opens from the same
button: `SORT BY:` as a radio list in the site's order (Recommended for you, New
Arrivals, Price high→low, low→high, Best Sellers, Customer Top Rated), then
collapsible `COLOUR` (a two-column grid of 40pt swatch discs — the one place the
app draws circles, because the site does), `RATING` (radio + stars, "4 and up"),
and `FEATURES` (checkboxes), with `Clear all` beside `Apply · n results` at the
foot. Gender is added because search spans the catalog where the site's panel
sat under an already-gendered listing. The snapshot carries no colour-family
facet — Brooks names colourways — so `data/search-query` derives the family from
the colourway's words; the swatch hexes are [inferred], the site being behind
Akamai (LLP 0002). Draft state is local to the sheet; Apply writes
`store/search-filters`, which is how state crosses a root-presented sheet and a
tab screen that cannot own it.

[observed] Three react-native-screens facts cost time and are worth recording.
A form sheet's content root must be `collapsable={false}` or React Native
flattens it and the sheet receives every child directly (it warns "expects at
most 2 subviews"). A `ScrollView` that is a *direct* child of the sheet gets a
special "header + scroll view" layout that put the list under the head — a plain
wrapping `View` opts out. And the sheet walks the *first-subview path* looking
for a scroll view to size to the whole sheet (`RNSScreen.mm`,
`tryFindDescendantScrollView`); React Native implements `zIndex` by reordering
native subviews, so a `zIndex` on the head moved the list's wrapper to index 0,
the list was found, and its frame was forced to the sheet's full height — its
last section hidden under the footer. Nothing in the sheet carries a `zIndex`.

[observed] The keyboard is handled by `react-native-keyboard-controller`
everywhere an input exists: `KeyboardProvider` at the root, Login's form on a
`KeyboardAwareScrollView` in place of `KeyboardAvoidingView` + `ScrollView`, and
the results list ending above the keys through `useReanimatedKeyboardAnimation`.
It is a native module, so the app needs a dev build; Expo Go already could not
run this project (LLP 0000's Expo Go target is [superseded] in practice since
the worklets crash recorded in the diaries).

#### Filter correctness

[observed 2026-10-13] The earlier shared applied state is **Superseded**.
The sheet and vocabulary are still shared, but search and each category/franchise
listing keep independent filters, sort, and candidates. The sheet captures its
opening scope; Apply commits there, while closing discards its local draft.
Returning to a listing restores its selections. Background search updates cannot
replace a category's candidates or counts.

[inferred 2026-10-13] A shopper opening Women's Shoes should see that category
without a Men's selection inherited from another listing. Per-listing state
supports that expectation while preserving selections during back navigation.

[observed 2026-10-13] Color filtering now returns product views containing only
matching colorways, without mutating the catalog. Tiles and search rows therefore
use matching photographs, swatches, prices, and PDP color parameters. Tile
selection uses a color code instead of an index so a changed color list cannot
silently select another color. Family membership still uses the existing
name-based heuristics; these remain inferred, not Brooks's primary-color facets.

[observed 2026-10-13] Live and offline search share the same row/filter/sort
pipeline. Offline search considers the complete name/franchise match set before
filtering. Duplicate live style IDs collapse to one row. Live-only products remain
in the unfiltered recommended view and count toward its Apply total; filters or
another sort require snapshot data and exclude those rows. Responses are tagged
with their query, and aborted responses cannot replace current results.

[observed 2026-10-13] Five stars requires a rating of at least 5; the old 4.75
threshold was inconsistent with that label. Unknown prices sort last in both
directions. Features combine with AND; colors and genders combine with OR.
The sheet retains selected features outside its eight common options and selected
genders outside the current candidates, so every active selection stays removable.

[observed 2026-10-13] `bun run test:filters` covers 1,840 color/gender/rating
combinations, feature intersections, sorting, offline matches, live-only rows,
counts, and scope isolation. Direct Argent checks on iPad mini / iOS 26.5 verified
Black plus price sorting, Pink, Apply, cancel after Clear all, committed reset,
category isolation, live search ratings, and disabled Apply for zero matches.
Replay recording was not certified: capture sometimes targeted the mounted Home
video instead of the foreground listing, and AX identifiers were inconsistent.

### Pushed screens wear the native header

[observed 2026-08-26] The blue collapsing header above belongs to the five tab
anchors. Everything those anchors *push* — the PDP and the PLP — wears the
platform's own `UINavigationBar` through Expo Router's `Stack`, and draws no
chrome of its own.

Both screens used to hand-roll it, and both hand-rolled it badly:

- The **PDP** floated two white boxes over the gallery: a 40pt square with a
  1px `#E5E5E5` border holding a caret, and a second one holding the text
  `Bag · 1`. Square, outlined, and text-labelled — three choices that read as a
  web page's idea of a button sitting on a native screen.
- The **PLP** drew a 48pt row above the grid holding the same caret box, a
  title that faded in past 64pt of scroll, and a search box.

[observed] Neither box inherited anything the system bar gives away: the
interactive back chevron that tracks the edge-swipe, UIKit's own hit targets and
pressed states, Dynamic Type, or — on iOS 26 — the glass capsule a bar button
now wears. Both were re-implementations of a control the platform already ships.

[observed] What replaced them:

- A native back chevron on both, `headerBackButtonDisplayMode: 'minimal'`. A
  Brooks push is one level deep from a grid or a tile, so the previous screen's
  title adds nothing the chevron does not already say.
- The PDP's trailing slot is **share** (`square.and.arrow.up`), not the cart.
  The `Bag · 1` box duplicated the tab bar's own badge two inches below it;
  share is the one action a PDP owes the reader that no other chrome offers. It
  hands the share sheet the product's brooksrunning.com URL from the catalog
  (LLP 0002) — the app has no deep-link host of its own to offer instead. iOS
  gets `url` and Android `message`: setting both makes the iOS sheet announce
  "2 Links" for one link.
- The PLP's trailing slot is **search**, the same destination the old box had.
  Its collapse survives as `headerTitle: showBarTitle ? title : ''` — the same
  64pt threshold, now driving the system bar's title instead of an app-drawn
  one. The filter/sort row stays, because it is screen content a navigation bar
  has no slot for.

[superseded 2026-08-28] **The PLP left the native bar again.** With the bar
transparent and the screen paying for its own inset (see *Zoom transitions*),
the bar contributed only two glyphs — a system chevron and a system
magnifying-glass — sitting one band above a screen otherwise drawn entirely in
Brooks's own controls. Browse, the screen the PLP is pushed from, flanks its
search field with 48pt outlined squares (`OutlineIconButton`: the `Filter &
sort` glyph on the right, a dismiss cross on the left). The PLP now hides the
native header (`headerShown: false` on `category/[id]`) and draws that same
pair: the sprite's `caretLeft` on the left for back, and `FilterButton` — the
very control Browse shows beside its field — on the right. The collapsing title
fades in between them at the same 64pt threshold, set in `type.barTitle` — the
17pt Filson Heavy the native bar's title used. The native back gesture survives
with the bar hidden; only the bar's own chevron is gone. Everything below about
SF Symbols and `header.plain` now describes the PDP alone.

[observed 2026-08-28] The same change **removed the PLP's own control row and
filter sheet.** The `Filter (n)` / `Sort ·` chips, the franchise quick-chips and
the full-height `FilterSheet` were a second filter vocabulary next to the one
Search already ported from the site's panel. The PLP now opens the same
`/search-filters` form sheet and reads the same `store/search-filters`, handing
the sheet its category as `candidates` on press (Browse's results, still
mounted under the push, own that slot while they are on screen). One panel,
one store, one applied state: filters set on a PLP are the filters Search shows
and vice versa, which is also how the site behaves — its panel is one component
wherever it opens. A franchise tile still narrows the PLP, as a fixed scope
rather than a toggled chip; the search button is gone, since Browse — one pop
away — *is* the search screen.

[Superseded 2026-10-13] The preceding paragraph's single applied state is
replaced by per-listing state. See [Filter correctness](#filter-correctness).

[observed 2026-09-24] **The PLP wears the native bar again, and so do the
sheets.** A human asked for every screen with custom header buttons to use
`Stack.Toolbar` instead, as the PDP does. This supersedes the 2026-08-28
paragraph above for the chrome only; the shared filter sheet and store stay.

- **PLP:** `category/[id]` takes `header.plain` (transparent, Filson title).
  The system chevron replaces the `caretLeft` square. `Filter & sort` is a
  `Stack.Toolbar.Button` with `line.3.horizontal.decrease`, and the applied
  count is the item's native badge (`Stack.Toolbar.Badge`, a
  `UIBarButtonItem` badge on iOS 26) instead of `FilterButton`'s ink square.
  The collapse is `headerTitle: showBarTitle ? title : ''` again, and
  `type.barTitle` is gone. The grid pads itself by `useHeaderHeight()` for the
  zoom reason in *The header had to stop insetting the PLP*. With no sticky
  control row, tiles now scroll under the bar; iOS 26's scroll edge effect
  keeps the bar legible.
- **`Filter & sort` sheet and Run Club modal:** on iOS both take
  `header.sheet` and put the system `xmark` (`headerIcon.close`) in the
  trailing slot. The sheet's title moved from an in-content `h2` to the bar.
  Run Club's bar has no title, because its card already says "Brooks Run
  Club". Android's form sheet renders no stack header (Expo's modal docs), so
  on Android both sheets still draw their own title and cross.
  `nativeSheetHeader` in `theme/header.ts` is the one switch.
- [observed] Two layout traps in the form sheet. First, the native bar does
  not inset the sheet's content: the list started under the bar until its
  `ScrollView` took `contentInsetAdjustmentBehavior="automatic"`. Second,
  react-native-screens sizes the first scroll view on the sheet's
  first-subview chain to the whole sheet (`RNSScreen.mm`). The in-content head
  used to sit first in that chain. Without it the list became first and ran
  under the footer, so an empty `View` now holds that slot.

Browse keeps its `FilterButton` and dismiss squares. They flank a search field
in content on an anchor with no native bar, so they are not header buttons.

[observed] The bar buttons are **SF Symbols**, not Brooks sprite glyphs, and
that is deliberate. Bar chrome is the platform's: a symbol lines up optically
with the back chevron beside it, scales with Dynamic Type, and inherits the
pressed state. The sprite (LLP 0003#icons-and-the-logo) keeps the places that
are Brooks's own — the blue header, the tab bar, screen content.

[observed] The brand reaches the native bar as *values*, not as a wrapper:
`theme/header.ts` holds two `Stack` option presets — `overlay` (transparent,
over the PDP's full-bleed gallery, `headerBlurEffect: 'none'` because Brooks
shoots product on near-white and a blur over `#F8F8F8` reads as a smudge) and
`plain` (white above the PLP grid, title set in Filson Heavy; [observed
2026-08-26] the white is the screen's, not the bar's — see *Zoom transitions*)
— plus
`headerIcon`, the SF Symbol names keyed by what the app means. The
expo-design-system rule is explicit that a platform component already carrying
the design language must not be wrapped to route it through the system, so the
tokens are handed to `Stack`, and there is no `<BrooksNavBar>`.

[inferred] The rule that falls out: **an app-drawn bar has to earn itself.**
`useBrooksHeader` earns it — it is a verbatim port of the site's own sticky
header, with a collapse no system bar performs. A square box holding a caret
earns nothing.

### Zoom transitions

[observed 2026-08-26] Every card that is *a picture that opens a screen* now
zooms into that screen on iOS 18+, using Apple's
`UIViewController.Transition.zoom` through Expo Router's `Link.AppleZoom`. The
picture lifts off the card and grows into the destination; the back gesture
reverses it. Android, iOS 17 and older, and web fall through to the default
push with no branching at the call site.

[observed] Which cards. The rule is the picture, not the tap target:

| Source | Destination |
| --- | --- |
| Home — "Summer's hottest new gear" (`GearCard`) | PLP |
| Home — "Wherever the day takes you" (`UseCaseCard`: Run, Trail, Walk, …) | PLP |
| Home — "Stories to transform your run" (`StoryCard`) | PLP |
| Browse — franchise cards (Ghost, Glycerin, Hyperion, …) | PLP |
| Catalog tile photo (`ProductTile`) | PDP gallery |

[observed] And which deliberately do not:

- **List rows** — Browse's `Women's Shoes` rows, search hits, cart lines. A
  skinny row with a thumbnail is not a picture; Expo's own zoom docs call this
  out, and a 64pt square ballooning to fill the screen reads as a glitch.
- **The Shoe Finder card** and the hero action. These are typographic CTAs, not
  photographs. The hero is a looping video behind a text link, and the
  destination has nothing to receive it.
- **The `Longer days. Longer runs.` banner.** It *is* a photograph, and it opens
  a PLP, so it is the closest call on the page. It stays out for a reason the
  rest of the list does not have: the banner carries **two** underlined actions
  over **one** collage (`SHOP WOMEN`, `SHOP MEN` — see *The Longer days banner,
  and two sections that left*). A zoom needs one source rect per destination, and
  a single photo serving two destinations has no honest answer for which half
  lifts. The banner reads as a second hero, and heroes here do not zoom.

  [observed 2026-08-26] This bullet used to name the `Brooks Run Club` block,
  which sat in this slot and was excluded on the same grammar — a photograph
  whose tap target was a `Join now` underline into a modal text form. That block
  is gone from the site and from the app; the reasoning survived the section it
  was written about, which is a fair sign it was about the grammar rather than
  the block.

[observed] `components/zoom-source.tsx` holds the two constraints so no call
site has to remember them: `Link.AppleZoom` takes exactly one child and slots
native zoom props onto it, so the child must be a host `View` with
`collapsable={false}` rather than an `expo-image` — and the frame must be known
on first paint, so the size is passed in as numbers rather than left to `flex`.
The label under a card stays *outside* `ZoomSource`; it belongs to the card, not
to the thing being carried across.

[observed] These cards also had to become `Link`s. `Link.AppleZoom` reads its
destination from the surrounding `Link` through context, which an imperative
`router.push` cannot supply. That is the better call site anyway — it is the one
that can carry a long-press preview later.

#### The header had to stop insetting the PLP

[observed 2026-08-26] Expo's zoom docs recommend avoiding zoom into a screen
that has a navigation bar, and the PLP showed exactly why. With an **opaque**
bar, UIKit owns the content inset. Under a zoom transition that inset arrives a
beat late: the pushed screen paints at full-window height first, so the
filter/sort row spent ~0.35s hidden *behind* the bar and then popped in,
shoving the large title down. Measured against a plain push into the same
screen, which showed the row in its first frame, so the shift was the zoom's.

[observed] The fix is to stop depending on the inset rather than to fight it.
`header.plain` became `headerTransparent: true`, and the PLP padded its own
control row up behind the bar (`useHeaderHeight()` from
`expo-router/react-navigation`). The bar's white surface was the control row's.
[superseded 2026-08-28] The PLP now hides the native bar entirely and draws its
own (see *Pushed screens wear the native header*), taking its top inset from
`useScreenTopPadding()`. The rule below still holds — the screen owns its
geometry — and `header.plain` is removed.
[observed 2026-09-24] The native bar is back on the PLP and `header.plain`
returns, transparent, with the grid padded by `useHeaderHeight()`. There is no
control row now, so the bar has no surface of its own. Tiles scroll under it,
behind iOS 26's scroll edge effect.
Nothing is lost visually: the control row is sticky and opaque, so the grid
never reaches the band the bar occupies either way — and the first painted frame
is now the final one.

[inferred] The general rule: **a zoom destination must not learn its geometry
from the transition.** Anything the native side insets late will be visible as a
jump, because a zoom shows the destination's first frame at full fidelity where
a slide hides it off-screen.

## Voice

[observed — verbatim site copy] Optimistic, lightly wry, second person. Use these
rather than inventing copy:

- Empty cart: *"There's nothing in your cart. Let's remedy that, shall we?"*
- Returns: *"Take it for a 90-day trial run. If you're not happy, we're not happy."* (Run Happy Promise)
- Shoe Finder: *"Your perfect shoe is out there"* / *"Let's go"* / *"Take 'em off. Your shoes, that is."*
- Brand platform: **"Let's Run There"** (heritage mantra: **"Run Happy"**)

## The home feature

### Superseded: Project 222

[superseded 2026-08-17] Project 222 ran until the attempt date. The app's hero
now runs **The Ghost Amp** (below). Kept for the record because the countdown
pattern is reusable for the next date-pegged campaign.

[observed — brooksrunning.com, 2026-07-13]

- Eyebrow: *Josh Kerr Attempts Mile World Record*
- Title: **Project 222**
- Body: *"On July 18th, 2026, Brooks Beast Josh Kerr will attempt to break the mile
  world record on British soil in 222 seconds. This is Project 222."*
- CTA: *Shop Kerr's training gear*
- Hero asset: a muted ambient video loop; the portrait still is at
  `…/cms-content/Project/Brooks-Running/Homepage/2026/July/Josh-Kerr-Hero/…_750x1200_….jpg`

[inferred] **The attempt is five days after this was written.** A live countdown on
the home screen is the one place the app should out-do the website: a phone is a
device you check, and the campaign expires on its own, correctly. This is the
single strongest demo beat available and it costs almost nothing.

Other home sections [observed]: *Build your training rotation*, *Join Brooks Run
Club*, *Stories to transform your run*, Women's/Men's New Arrivals.

### Current: The Ghost Amp

[observed 2026-08-17 — two independent captures: the full-page grab on the Paper
file's `Website — brooksrunning.com` page, and a fresh human screenshot]

- Eyebrow: `JUST DROPPED`
- Title: **The Ghost Amp**
- Body: *"Amplify your run in the all-new Ghost Amp, featuring technology that
  injects energy into every stride."*
- CTA: `SHOP NOW`, as an **underlined text link — not a solid button**
- Hero asset: an ambient video loop, shot low and wide in a city

[observed] **The hero is top-anchored.** Copy sits in roughly the top 15–40% of
the band, left-aligned, with the lower half left to the footage. Every earlier
app hero was bottom-anchored, which is the more common native habit and the wrong
one here.

[observed] **The CTA count is not stable between captures.** The earlier grab
shows two links, `SHOP NOW` and `SHOP ALL ROAD RUNNING`; the later screenshot
shows only `SHOP NOW`. Treat one primary link as the design and a second as
optional — do not treat either count as fixed.

[inferred] There is **no badge and no chip** on this hero, and there never was
one on Project 222's either — the app invented that. One eyebrow is the whole
label layer. Four elements is the budget: eyebrow, headline, blurb, action.

### Expo implementation: Paper home port

[observed 2026-08-17] The Expo home screen now follows the Paper file's mobile
`Home` artboard as its implementation source: hero proportions and typography,
the two lifestyle rails, the centred New Arrivals rail, Run Club, stories, and
the Run Happy Promise band. (`Superseded 2026-08-26` for Run Club — see *The
Longer days banner, and two sections that left* below.) The existing system-rendered `NativeTabs` remain the
app shell, so Paper's drawn tab-bar mockup is intentionally not ported.

[observed] The hero uses the Brooks site's portrait Brightcove source, video id
`6400666963112`, as a muted autoplaying loop. The MP4 is bundled at
[`assets/home/ghost-amp-mobile.mp4`](../assets/home/ghost-amp-mobile.mp4) rather
than relying at runtime on the site's signed `bcov_auth` URL, whose token is not
a stable application asset contract.

[observed] Paper's homepage imagery is embedded in the design as image fills,
not as separately named source files. The app therefore exports each relevant
fill or crop into [`assets/home/`](../assets/home/) and owns those deterministic
demo assets locally. Product facts continue to come from `packages/catalog`, in
line with LLP 0002; the home port does not introduce direct SFCC requests or a
second catalog source of truth.

[observed 2026-08-21] The hero runs inside a reusable Reanimated
`StretchyParallaxScrollView`. During positive scroll, the leading visual
continuously compensates for half of the content offset without an end clamp,
so it travels at half speed. The reusable primitive owns a separate foreground
layer that scrolls at normal content speed, keeping the hero copy and actions at
a constant inset from the following section while that section paints over the
media. Both animated layers have an explicit clipping container whose lower edge
tracks the following section, preventing Android's transformed media surface or
scaled text from painting across that boundary. During negative top-edge
overscroll, a fixed layout frame keeps the next section attached while the
absolutely positioned clipping layers cancel the scroll bounce, grow by the pull
distance, and stay pinned to the screen's top edge.
The positive parallax is disabled when the system requests reduced motion; the
direct pull-to-stretch response remains.

[observed 2026-08-26] The pull-to-stretch above was laggy. An Argent Instruments
profile of four pulls on the iPhone 17 Pro simulator put
`VideoView.safeAreaInsetsDidChange()` (131 ms) and `LinearGradientLayer.display()`
+ `draw(in:)` (247 ms) on the main thread, both reached from
`RCTMountingManager` layout-metric updates. The cause was that the clip, media,
and foreground each animated `height`, so every frame of the pull ran a Yoga
layout on the UI thread, re-laid-out the native video view, and redrew the
gradient's bitmap. The Hermes side was idle (one React commit). The primitive
now animates transforms only: the media scales about its top edge by
`(headerHeight + pull) / headerHeight` inside a clip that is fixed at twice the
media height and starts one media height above the frame, and the foreground is
plain content that needs no per-frame style because it moves with the following
section in both pull and scroll. A re-profile of the same gesture no longer
lists either symbol. `topInset` is available on the primitive for a screen that
wants its media to start below a floating bar; Home does not use it, because the
half-speed drift then opens white space under the bar in too many scroll
positions — the hero keeps running under the bar.

#### The Longer days banner, and two sections that left

[observed 2026-08-26] The Expo home screen now carries the site's
`Longer days. Longer runs.` banner in the site's own slot — after the new-gear
rail, before the activity rail — and has dropped two things the site does not
have: the `Brooks Run Club` band (gone from brooksrunning.com's homepage) and
the `Shop all new arrivals` link under the New Arrivals rail.

[observed] The banner's artwork was **harvested from the live site rather than
from Paper**, because it postdates the Paper capture. brooksrunning.com's page
HTML is behind Akamai (LLP 0002), so the URL was read out of a real browser
session via the same Playwright path `tools/harvest` already uses; the asset
itself is on `demandware.static`, which answers a bare client, so only the
*lookup* needed the browser. The mobile source is
`F26-NA-BRcom-AUG-HP-03-S.jpg`, 750 × 1450.

[observed] **Brooks ships this section as one image, not two.** The `-S` mobile
asset is a collage: a washed-out near-white wash from y=0 to y=557, then an
action photo from y=557 to the bottom, inset 25px from the left and bleeding off
the right and bottom edges. The site lays its copy over the wash at the image's
natural aspect, so the copy block's height is pinned to the artwork's geometry.

[inferred] **The app cuts the collage at that seam and lays the halves out
independently.** The wash becomes an `absoluteFill` behind a copy block that
sizes to its own text, and the photo is a sibling rendered to its own aspect.
This costs one extra asset and buys two things a single image cannot: the copy
cannot collide with the photo at a large accessibility text size, and the section
adapts to any screen width without letterboxing. Stretching the wash is safe
precisely because it is a soft gradient with no subject in it.

[observed 2026-08-26] **The 25/750 left inset only works if the backdrop runs
behind the photo, and a flat tint cannot stand in for it.** The strip beside the
photo samples `(222,209,193)` at one row and `(247,251,250)` at another — it is
the backdrop photograph continuing, not a colour. A first cut rendered the two
halves as plain siblings, so the strip painted the section's own white and read
as misaligned padding rather than as layering.

[observed] The backdrop layer is therefore **the whole collage**, absolutely
positioned across the section rather than sized to the copy. Everything right of
the strip and below the seam is hidden behind the real photo, so that region is
smeared flat from the strip's edge pixel before encoding: the visible column
stays untouched source, and the asset costs 14 KB instead of 100 KB. The
backdrop is anchored `top/left/right/bottom` rather than given a height, so it
tracks a copy block that still sizes to its own text.

[observed] **The photo hangs `32pt` below the backdrop's bottom edge.** The web
composite cannot do this — both halves end on the same line because they are one
JPEG — and it is the one thing the app gains by separating the layers. Offset
down from the panel as well as right of it, the photo reads as resting on the
backdrop rather than filling a slot cut in it.

[observed] The site's two links point at `featured/training-gear/{gender}`, which
is not a Constructor group the catalog harvest covers. The app sends them to that
gender's apparel category instead — the group's members are training apparel, and
LLP 0002's rule stands: the app browses the harvested catalog, not a live SFCC
path.

[observed 2026-08-18] Every native tab now owns a native `Stack` through an
Expo Router array group. A shared `Stack.Toolbar.View` places the Brooks SVG
wordmark at the leading edge. `NativeTabs` remains entirely system-rendered
with no app-owned blur layer beneath it. The search-role tab needs
`headerShown: true` explicitly or UIKit suppresses its custom toolbar while
morphing the tab bar into the search field.

[observed 2026-08-20] `Superseded`: the header briefly used a masked
`ProgressiveBlur` component (a `BlurView` under an eased alpha gradient,
adapted from the sibling speech-companion app). It is removed. The header is
now fully transparent with `headerBlurEffect: 'none'` and no
`headerBackground`, so the hero reads unbroken under the toolbar. The
`expo-blur` and `@react-native-masked-view/masked-view` dependencies went with
it.

## Home section language

[observed 2026-08-17] The homepage is a stack of six sections. Every one of them
uses the **same card grammar**: a *centred*, sentence-case heading standing alone
with no eyebrow, over a row of four bare photographs with ALL-CAPS captions.
There is no bordered card, no subtitle, and no product-on-white tile anywhere
above the fold. This is the single biggest divergence the app had to close.

| Section | Ground | Cards | Caption |
|---|---|---|---|
| *Summer's hottest new gear* | pale **sky gradient** | 4 × square lifestyle photos | centred caps |
| *Longer days. Longer runs.* | washed-out photo | inset action photo | left-aligned copy, two underlined links |
| *Wherever the day takes you* | white | 4 × tall lifestyle photos | centred caps |
| *Stories to transform your run* | white | 4 × 3:2 photos | blue caps category + muted date, then a headline |
| Run Happy Promise | `#003789` | — | round `RUN HAPPY PROMISE` seal + two lines, `90-day trial run.` underlined |

[revised 2026-08-26 — fresh human screenshot of the mobile homepage] Two rows of
that table changed since the 2026-08-17 capture. **`Brooks Run Club` is no longer
a homepage section**, and a brand banner, **`Longer days. Longer runs.`**, now
sits between the new-gear rail and the activity rail.

[observed] **The banner is the one section that breaks the card grammar, and
that is the point.** Its heading is left-aligned rather than centred, set at the
hero's own size over two lines, and it carries body copy plus *two* underlined
links (`SHOP WOMEN`, `SHOP MEN`) side by side — the only place on the page where
an action pair appears. Everything above and below it is a centred heading over a
photo rail, so the banner reads as a second hero rather than a sixth rail.

[observed] The new-gear band is **not a flat tint** — it is a photographic sky,
sampling `#A3C9E4` at the top through `#C0DAE8` to near-white `#E5EDF7`. The
promise band samples `rgb(17,55,134)`, which confirms `--color-blue` `#003789`.

[inferred] Because every section shares one grammar, the app's *own* additions
(the New Arrivals product rail, which the site does not have) must adopt the
centred heading too, or they read as a different product.

## PLP chrome

[observed 2026-08-17] Above the grid, in this order: breadcrumb
(`HOME / WOMEN` — first crumb bold ink, rest muted, caps, positive tracking);
title; a description paragraph; a **pale blue `#DFEDF0` Shoe Finder card**
centred on *"Find the perfect shoe for you. / Try Shoe Finder"* with
`Shoe Finder` underlined; a **four-card category rail**
(`WOMEN'S SHOES`, `WOMEN'S APPAREL`, `NEW ARRIVALS`, `BEST SELLERS` — captions
**left**-aligned here, unlike the homepage's centred ones); then
`145 products` / `SORT ⌄`.

[observed] The tile's resting state carries a plain top-left text badge
(`New Style`, `Best Seller`, `Limited Edition`) on the `#F8F8F8` pad, title,
price, and a category meta line (`Women's – Road Running, Walking`). Hover adds
`Widths – Medium, Wide, Extra Wide` and the star rating.

[confirmed 2026-08-27 — human-supplied crop of a live Ghost Amp tile] The full
block, in order, is **title / price / `Men's - Road Running, Walking` / `Widths -
Medium, Wide` / stars `(60)`**. Three details the earlier capture got wrong or
left open:

- The separator is a plain **hyphen** with spaces, not an en dash.
- Prices print **cents** — `$180.00`, not `$180`. This matches the storefront
  payloads in LLP 0002, so it holds for the PDP and the cart too.
- The rating line shows the **review count alone**, `(60)`, with no numeric
  average. The PDP still prints `4.4 (280)`.

[observed 2026-08-27] `ProductTile` now renders that block. Two deliberate
divergences, both forced by the phone:

- A phone has no hover, so the widths line and the rating show **at rest**
  rather than being withheld.
- A two-up grid tile is ~175pt wide, where `Men's - Road Running, Treadmill,
  Walking` truncates to nothing useful on one line, so both meta lines wrap to
  **two lines**. Rows size to their tallest tile. On the 244pt home rail each
  line still fits on one.

[inferred] Brooks has **no activity field** on the product record — the activity
*is* the shop category, so `activityLabels()` derives the line from the
`{gender}-shoes-{activity}` Constructor group ids rather than from `bestFor`,
which is marketing copy (`"Balanced support"`, `"Everyday running"`) and would
not reproduce the site's wording. `widthLabels()` drops the size code from
`Medium (1D)` and hides widths no colorway stocks. Every shoe in the snapshot
resolves both lines; apparel resolves neither and keeps the gender alone.

[observed] The tile lost its old `Balanced cushion · White/Black` line in the
trade. The colorway name is still readable from the swatch rail's selection.

## Mega menu → the Shop tab

[observed 2026-08-21] The tab is labelled **Browse** in the tab bar; the route
segment and screen are still `shop`.

[observed 2026-08-17] The `WOMEN` mega menu is four text columns plus a promo
card. These are the exact labels the Shop tab should carry:

- **Shoes:** New Arrivals, Road, Walking, Treadmill & Gym, Support, Wide Shoes,
  Trail, Solutions, Track & Spikes, Lifestyle, Sale, Shop All
- **Apparel:** New Arrivals, Sports Bras, Shorts, Tops, Pants & Tights,
  Outerwear, Accessories, Socks, Sale, Shop All
- **Featured:** Best Sellers, Limited Edition, Trail Gear Shop, Hot Weather Gear,
  Marathon Gear, Brooks x runDisney®, Shoe Finder, Bra Finder, Used Gear,
  Size Guide
- **Best Sellers:** Ghost, Glycerin, Adrenaline GTS, Hyperion, Cascadia
- **Promo card:** lifestyle photo, *Find your perfect fit*,
  `TAKE OUR SHOE FINDER QUIZ` underlined

[inferred] A hover menu cannot exist on touch, so the Shop tab *is* this menu.
Rendered as `h3`-scale rows the four groups run past 1800px, so the ported rows
are 46px at 16px medium — the menu's own density, not a settings-list density.

[observed 2026-08-28] The rows had drifted to `h3` (20 Heavy) in code, so the
Shop screen read as a stack of headlines. The ramp now carries a `navRow` step
(Filson Medium 16/22) that the Shop and Account rows use; `h3` stays for real
headings.

## Product taxonomy

[observed] The attributes that must appear as filters and PDP specs:

- **Cushion:** Plush / Balanced / Responsive
- **Support:** Flexible / Balanced / Structured (GuideRails™) / Max
- **Neutral vs Support** is the top-level split Brooks teaches customers
- **Width:** Women's 2A/1B/1D/2E, Men's 1B/1D/2E/4E — Brooks's real differentiator
  against Nike and adidas, and it deserves equal visual rank with size
- **Surface:** Road, Trail, Walking, Treadmill & Gym, Track & Spikes, Lifestyle
- **Franchises:** Ghost, Glycerin, Adrenaline GTS, Hyperion, Launch, Levitate,
  Revel, Anthem, Cascadia, Caldera, Addiction, Beast/Ariel

## Shoe Finder

[observed — the site's embedded quiz config, "Shoe Finder S26 US" v18] The real
flow is 16 steps with branching: Use → (Trail type) → Training → Training use →
Experience → Mileage → Injuries → **"Take 'em off"** checkpoint → Balance → Knee
bend → Flexibility → Shoe feel → Features → Gender/size → Email (skippable) →
Results.

[inferred] Single-select steps should auto-advance [superseded 2026-09-30 by
LLP 0005#the-quiz-waits-for-next: a tap selects, and a Next button advances];
the barefoot-test checkpoint is
the most charming, most Brooks moment in the whole product and should be played as
a full-screen beat. [observed 2026-10-05] The app no longer condenses the quiz:
it asks the site's own questions from the embedded config, version 24, with the
site's barefoot videos. See LLP 0005#the-sites-own-questions. Results should name *why* ("Balanced cushion — you wanted soft
and smooth"), which is what turns a quiz into advice.

[confirmed — live walkthrough of the site quiz, 2026-08-16] The step order above
was read from the embedded config in July; walking the live quiz end to end
reproduces it, including the branch, the multi-select injuries step, the
`Take 'em off` checkpoint, the two extra barefoot exercises (knee bend and
toe-touch), and the skippable email gate before results. Confirmed verbatim
strings: the intro headline "Your perfect shoe is out there" with its blurb and
`Let's go` CTA; "Take 'em off" / "Your shoes, that is."; and the cushion option
"soft and smooth". Two site behaviors the app deliberately drops are now
first-hand rather than assumed: the email gate, and the per-question
"What does this mean?" explainer modal — the app spends that explanation on the
results instead, where it changes a decision.

## Screen patterns

[observed — 2026-08-21] Press-scale, enter/exit, layout transitions, the button
press-shift, PDP size-grid shake, and the filter-sheet fade stay stripped
pending the motion overhaul. [observed 2026-08-26] The button press-shift is
back, as the one press feedback in the app: on press-in the shadowed button's
face travels the shadow's 4pt offset so the two flatten into a single block, on
a native CSS transition over `motion.press` (70ms) — pushed, not animated.
[observed 2026-08-28] The offset layer is no longer a filled ink block. It is a
`border.heavy` (3pt) outline in the button's own colour — ink for primary and
secondary, blue for the purchase CTA, white for `onDark`, the disabled fill for
a disabled purchase — the same frame the secondary button draws, so
a primary and a secondary stacked together (Account's guest state) read as one
family rather than a solid slab beside a hollow one. The press-in travel is
unchanged: the face lands on the outline and covers it.
[observed 2026-08-27] The shadow is part of the button's shape, not its enabled
state: a disabled button still draws the layered block and simply never travels
onto it. Hiding it while disabled made the search `Filter & sort` footer read as
two different components, `Clear all` flat beside a layered `Apply`, and shifted
the button's visual weight on a state change the user did not cause. Disabled is
carried by one pairing for every in-sheet button, whatever its variant:
`surfaceAlt` under the site's `#707070` secondary gray, 4.7:1. `surfaceSunken`
is the better-named token for an inactive fill but lands at 4.4:1 against that
gray, and the gray is the brand value, so the fill is what gives. The pair this
replaced, `inkFaint` on `surfaceSunken`, was 2.2:1 and read as an empty slot
rather than a button. A disabled fill is too pale to be a shape on its own, so
a disabled button also borrows the outlined variant's 3pt ink edge; the shadow
plus that edge is what keeps it legible as a button while it is inert. Filling
the disabled primary dark instead was tried first and rejected as too heavy —
it drew more attention inert than the live `Clear all` beside it. The blue PDP
purchase CTA was the exception at both ends: unshadowed in every state, as it
is on the site, and dark when disabled, because it sits alone on a sticky bar
with no sibling to read against. [observed 2026-08-28] It now wears the same
offset outline as every other button, so the app has one button shape; it
keeps its blue fill, split label, and dark disabled state. Stack pushes use the platform default again. On
iOS 18+, a product tile photo uses Expo Router's `Link.AppleZoom` into the PDP
gallery (`Link.AppleZoomTarget`); older iOS and Android keep the default push.
[observed 2026-08-26] That treatment now covers every picture-that-opens-a-screen
on Home and Browse, not just the tile — see *Zoom transitions*.
Home's stretchy parallax hero stays. [observed 2026-08-28] The PDP gallery now
rides the same `StretchyParallaxScrollView`: the photo drifts at half the
content's speed under the title block and stretches on a top-edge pull, while
the page dots sit in the primitive's foreground layer so they stay pinned to the
title rather than drifting with the photo. The horizontal `FlatList` is the
`header`; it keeps its own swipes because the foreground layer is `box-none`
(`foreground` became optional on the primitive for consumers with nothing to
pin). `Link.AppleZoomTarget` moved inside `header` around the gallery bounds —
at push time the scroll offset is 0, so the target rect equals the frame rect
the tile photo zooms into. Colorway selection is a second exception:
the focused thumbnail uses a sliding ink underline (`UnderlineRail`) rather than
a boxed blue/ink border, on both the catalog tile and the PDP color rail. Brand
observations below still describe the site and the intended native patterns;
they are not currently implemented as press or enter motion. [observed —
2026-08-21] The PDP gallery pagination is another state-feedback exception:
`AnimatedPaginationDots` derives fractional page progress from the horizontal
scroll offset on the UI thread, shrinking the outgoing bar while expanding the
incoming one. Reduced-motion users get the same state indication without the
continuous morph.

[inferred] Pattern ownership follows LLP 0001.

- **Home** (Nike): [superseded 2026-08-21 → *The header collapses on scroll*] a
  transparent header over the hero cross-fading to a blurred white bar past ~70%
  of hero height. The header is the site's flat blue bar now, and it collapses
  rather than cross-fades. Parallax hero; staggered entrance matching
  the site's own; horizontal rails for new arrivals and best sellers; editorial
  cards that land on merchandise.
- **PLP** (Zappos utility, adidas rhythm): collapsing large title; 2-up grid.
  [superseded 2026-08-28] The sticky `Filter (n)` / franchise chip row and the
  full-height bottom sheet are gone: above the grid is one row of Browse's
  outlined squares (back, `Filter & sort`), and filtering is Search's own form
  sheet and store — see *Pushed screens wear the native header*.
- **Tile** (Zappos/GOAT): colorway swatches **on the tile**, swapping its image in
  place. The highest-value borrow in the survey — Brooks products carry up to 11
  colorways, and making someone navigate to see them is the core failure to avoid.
  Selected color is an ink underline that slides under the focused thumbnail
  (`UnderlineRail`), not a boxed blue border.
- **PDP** (GOAT presentation, Zappos fit confidence): edge-to-edge gallery; color
  swatches as real shoe thumbnails (Brooks colorways are multi-color, so dots
  lie), sharing the same sliding underline as the tile. [observed — 2026-08-21]
  Every gallery page is a screen-width square and uses cover fitting, so portrait
  and landscape source photography both occupy the same 1:1 viewport without
  client-side letterboxing.
  The color rail keeps its
  first thumbnail aligned to the page gutter but its scroll viewport bleeds to
  both screen edges, so additional colorways are not clipped by the content
  container; a five-column size grid followed by a four-column width grid;
  unavailable choices crossed diagonally (`selectable: false` from LLP 0002);
  selected choices outlined rather than filled; sticky flat-blue
  "Add to cart" action with the price split to the trailing edge. [superseded
  2026-08-26 → *Pushed screens wear the native header*] The gallery carried two
  floating white square boxes — a caret and `Bag · 1`. It wears the native
  transparent header now: back chevron leading, share trailing.
- **Cart** (GOAT immediacy): bottom sheet, swipe-to-delete with undo, free-shipping
  progress bar, and Brooks's own empty-state copy. [observed 2026-08-26] It opens
  on a `Bag (n)` heading rather than the blue bar — see *Only Home wears the
  header*. [superseded 2026-10-06] The free-shipping progress card ("You're $X
  from free shipping" / "You've earned free shipping") is gone, and so is the
  outlined text-only "Run Happy Promise" box under the totals. The Bag now shows
  the PDP's own returns band (see *PDP detail sections*) under the totals. The
  Shipping row in the totals still reads `Free` or the fee. The sticky
  `Checkout` button has no white bar or top rule behind it; it floats over
  the rows. A line no longer prints its `#<variant id>`; the id stays in
  the cart data. `Checkout` no longer opens the navy "Prototype note";
  the button has no action, because checkout is out of scope.
- **Login** (adidas membership): framed as *joining Brooks Run Club*, never as a
  gate. Guest path always visible. [observed 2026-08-28] The Account tab's
  guest state dropped its navy pitch card, heading, rows and footer for the
  storefront-app convention, centred alone on the screen: an illustration built from the brand's own sprite glyphs (`account`
  on a navy block, `cart` / `clock` / `pin` in outlined squares), one line of
  body copy on what signing in unlocks, then `Log in` (primary) over `Create
  an account` (secondary) as a full-width stack, both the app's own shadowed
  square buttons. Both push the same on-device form; `?mode=login|create`
  only relabels its heading and button. [superseded 2026-10-05] The guest
  state is now a full-bleed navy Run Club panel ("Join the club. Run
  happier.", lime eyebrow, light status bar while focused), three ruled perk
  rows with outlined line glyphs (free shipping, a birthday gift, early
  access), and one `Log in or join` button. The sheet is email-first, as in
  the Mobbin references (Fresha, ChatGPT): one email field and Continue. An
  email that joined on this device before logs straight back in
  (`knownMember` in `src/store/member.ts`; signing out keeps it); a new one
  gets "Welcome to the club.", the email with a Change link, three perks and a
  first-name field. `?mode` is gone. The email field does not auto-focus, so
  the keyboard never hides "Continue as guest".

  [superseded 2026-10-05 — see below] The perk copy (`RUN_CLUB_PERKS`) was
  set to repeat only what Brooks states itself. [observed via search snippets of
  support.brooksrunning.com article 360016635851, "Why should I create a
  Brooks Run Club account?"; the page itself is behind Cloudflare and
  brooksrunning.com behind Akamai, so neither could be fetched directly]:
  order history saved in one place for easy returns, free standard shipping,
  free express shipping on $160+, a gift with purchase during the birthday
  month, member-exclusive promotions and games; the account-login page
  description adds saved payment methods and billing / shipping addresses.
  Dropped as unverified: "Early access to new shoes and sales" and "Fun games
  and prizes". No wishlist claim is made — `/wishlist/view` exists on the
  site but no fetched source ties it to an account.

  [observed 2026-10-05, live site in headed Chrome] The perk copy is now
  checked against brooksrunning.com itself, which the 2026-08-28 work could
  not load. The sign-up page (`/en_us/account-registration/`) lists
  "Membership benefits include: Free shipping, Annual birthday gift, Early
  access to shoes & sales, Fun games and prizes". The Brooks Run Club page
  (`/en_us/brooks-run-club/`) adds a "20% off apparel welcome offer" (one
  full-price apparel item). The Shipping page's member column: standard
  free, express $15 and free over $160; Friends & Family and Sports Medicine
  discount groups get no shipping perks. The support article (360016635851)
  says the birthday gift is a gift *with purchase*. So the August note was
  wrong: "Early access" and "Fun games and prizes" are real perks.
  `RUN_CLUB_PERKS` now lists only the site's perks. Order history and saved
  addresses are account features, not perks, and "easy returns" is not a
  member perk: the 90-day Run Happy Promise covers every customer.
- **Tab bar & search** (Nike). [superseded 2026-08-17→2026-08-21] The bar was the
  system native tab bar (liquid glass on iOS 26) with a `role="search"` tab that
  iOS detached into the standalone trailing button — Home · Shop · Bag · Account
  + search, Nike's exact layout — because four regular tabs is UITabBarController's
  ceiling before it overflows into a "More" tab that swallows the search role.
  Shoe Finder paid for the search slot. [observed 2026-08-21] The bar is
  app-drawn now (see *The tab bar is app-drawn again*): five tabs, Home · Browse ·
  Shoe Finder · Cart · Profile (Shoes since 2026-10-06, LLP 0006), in Brooks's own sprite glyphs, with a sliding ink
  dash riding the bar's top edge under the focused icon. Search traded its slot
  back for Shoe Finder's; it is a pushed screen entered from the Browse header
  field and the category header, and it still drives the live Constructor.io
  type-ahead (LLP 0002) through the native `Stack.SearchBar`. [superseded
  2026-08-26 → *Browse is the search screen*] The pushed screen and the native
  bar are gone; Browse's own field focuses in place and swaps its content for
  the results, with `Filter & sort` as a form sheet. [observed
  2026-08-21] `search` is now also the one control Home's header carries.
  [observed 2026-08-26] It is the only one anywhere: no other tab draws a header
  at all, and Browse reaches search through the field in its own first
  screenful — see *Only Home wears the header*.
- **Card rails snap.** [observed 2026-10-06] Every horizontal rail of cards
  stops on a card edge: `decelerationRate="fast"` plus `snapToInterval` set to
  the card width plus the rail's `gap`. With the rail's `gutter` padding, each
  stop puts a card's leading edge on the gutter. Home's New arrivals and Stories
  rails had it first; Home's gear and use-case rails, Browse's Franchises rail,
  and the add-to-bag sheet's `You might also like…` rail now match ([observed
  2026-10-06] that rail is now the PDP's `Complete the look` rail design, and
  keeps the snap). Selector
  rails (the PDP colour swatches, an `UnderlineRail`) do not snap: they scroll to
  the selected swatch on their own.

### Profile overscroll

[confirmed — user direction, 2026-10-12] Pulling down on the guest Profile
screen should continue the navy Run Club panel, using the same approach as
Home's blue bottom overscroll fill.

[observed — implementation, 2026-10-12] An absolute, non-interactive navy view
extends 1000pt above the guest scroll content. Like Home's footer fill, it sits
outside the content bounds so it adds no scroll height. The scroll view keeps
its white background for the rest of the page and bottom bounce. The member
screen starts on white and keeps its existing background.

## Wow list

[inferred] Ranked by leverage per hour:

1. **Project 222 live countdown** on the hero — news-pegged, expires correctly.
2. **Add-to-cart flying shoe** arcing into the tab-bar bag, lime badge popping.
3. **Colorway swatches on the tile** that swap the image in place.
4. **Shoe Finder quiz** with the "Take 'em off" checkpoint. [superseded
   2026-09-30] It no longer auto-advances; see LLP 0005#the-quiz-waits-for-next.
5. [superseded 2026-08-26] **Haptics tuned per gesture** — selection ticks on
   chips, success on add, error on missing size. Built, then removed. Tuning
   them per gesture was the wrong reading: `Press` fired an impact on *every*
   tap, which spends the signal until it means nothing, and a buzz on a tap that
   already opens a screen competes with the transition that confirms it. The tab
   bar keeps its selection tick — the one move with no animation of its own to
   feel — and `utils/haptics` exports nothing else.
6. **Collapsing blurred headers.** Instantly reads as native rather than web.
7. **Skeleton shimmer everywhere.** Never show a blank screen.
8. **Hard-offset button press.** Brooks's own signature interaction.
9. **Cushion/support meter** on the PDP — turns Brooks's technical fit story into
   a graphic.
10. **The squiggle, animated** (stroke draw-on) under section titles.

## Sources

The live site blocks non-browser fetches (LLP 0002), so brand CSS, the Shoe Finder
quiz config, and PLP/PDP/cart structure were read from Internet Archive captures
(June 2026); the Project 222 hero copy and imagery were read from the live
homepage HTML captured through a browser session on 2026-07-13.

- Brooks homepage, production `style.css`, Shoe Finder quiz config
- Project 222 background: FloTrack, CITIUS Mag, LetsRun
- Brooks brand platform: "Let's Run There" press release
