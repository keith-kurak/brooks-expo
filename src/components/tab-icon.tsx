import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BrooksIcon, type BrooksIconName } from '@/components/icons';
import { Txt } from '@/components/themed-text';
import { border, colors, radius } from '@/theme';

/**
 * Icons for the app-owned bottom tab bar.
 *
 * @ref LLP 0003#icons-and-the-logo — Three of the four tabs are real sprite
 * glyphs lifted verbatim from brooksrunning.com: `#icon-search` (Browse),
 * `#icon-cart` (Cart), `#icon-account` (Profile). The sprite has no home, no
 * shoe, and no storefront glyph — a website needs none of them — so Home and
 * Shoe Finder are drawn here to sit at the real set's line weight.
 *
 * Browse wears the magnifier because Browse *is* the search screen: its own
 * field is the search (LLP 0003#browse-is-the-search-screen). It used to wear a
 * drawn 2×2 grid, with the magnifier on Shoe Finder; the shoe says what that
 * tab is about directly.
 *
 * The focus rule still constrains the drawn glyphs: any glyph whose top edge is
 * a long horizontal merges with the dash on the bar's top edge (that is what
 * disqualified `#icon-filters`). The shoe's top edge is a short heel collar
 * and a slope, and its long horizontals are at the bottom, away from the dash.
 *
 * Weight normalization: the sprite encodes non-uniform line weights (the cart's
 * line-work is ~1.3 viewBox units, the account's ~1.4, the search ring's ~1.9),
 * so equal render sizes read as unequal strokes. A fill cannot be thinned, only
 * fattened, so each glyph is thickened up to a shared ~2.2px and the two drawn
 * glyphs stroke at 2.2 directly. *
 * The Liquid Glass bar shows these same glyphs as PNGs, which
 * `tools/tab-icons/render.js` draws from a copy of the geometry here. After
 * changing a glyph, a size, or `thicken`, update that copy and rerun it.
 */

const STROKE = 2.2;

export type TabIconName = 'home' | 'browse' | 'finder' | 'cart' | 'account';

/**
 * Sprite-backed tabs. `size` is per glyph, not shared: `BrooksIcon` scales to
 * fit a `size` box on the glyph's *longer* axis, so a single value would render
 * the wide-and-short funnel wider than the tall-and-narrow account figure. These
 * values equalize drawn width instead — except the account figure, which is
 * taller than wide, so it is matched on height the way a person glyph should be.
 * `thicken` then brings each glyph's encoded weight up to the shared ~2.2px; the
 * funnel reaches it unaided (1.75 viewBox units × 21/16.89 ≈ 2.18).
 */
const sprite: Partial<Record<TabIconName, { name: BrooksIconName; size: number; thicken: number }>> =
  {
    browse: { name: 'search', size: 21, thicken: 0 },
    cart: { name: 'cart', size: 20, thicken: 0.9 },
    account: { name: 'account', size: 20, thicken: 0.65 },
  };

export function TabIcon({
  name,
  color,
  badge,
}: {
  name: TabIconName;
  color: string;
  badge?: number;
}) {
  const real = sprite[name];

  return (
    <View style={styles.slot}>
      {real ? (
        <BrooksIcon name={real.name} size={real.size} color={color} thicken={real.thicken} />
      ) : (
        <Drawn name={name} color={color} />
      )}
      {badge ? (
        <View style={styles.badge}>
          {/* Lime fill with blue text — the site's exact cart-badge treatment,
              which the system tab bar could not render (its badge text is
              fixed white on iOS). An app-owned bar gets it back. */}
          <Txt variant="caption" c={colors.blue} style={styles.badgeText}>
            {badge > 9 ? '9+' : badge}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

/** Home and Shoe Finder: no sprite equivalent, drawn at the real set's weight. */
function Drawn({ name, color }: { name: TabIconName; color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {name === 'home' && (
        <Path
          d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {name === 'finder' && (
        /* A running shoe in profile, toe to the right, after the SF Symbol the
           glass bar uses for this tab. The midsole line sits about 5 units above the sole
           so the gap stays open at 2.2 strokes, and it stops short of the toe so
           its round cap stays inside the outline. */
        <>
          <Path
            d="M2.5 18.5V4.59c0-.91 .5-1.69 1.2-1.69h2.1c.6 0 1 .52 1.2 1.17 .8 2.08 2.9 2.6 4.2 1.04l.6-.78 3.6 4.29c.5 .65 1.2 1.04 1.9 1.3 2.5 .78 4.2 3.12 4.2 5.98V18.5H2.5Z"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M2.5 13.56h18" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  slot: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    // A knockout ring, not a control edge, but it still comes off the same
    // scale — one rule is enough to keep the badge off the glyph.
    borderWidth: border.rule,
    borderColor: colors.surface,
  },
  badgeText: { fontSize: 10, lineHeight: 13 },
});
