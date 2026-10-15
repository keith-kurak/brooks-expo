import { router, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BrooksIcon, type BrooksIconName } from '@/components/icons';
import { Press } from '@/components/press';
import { Txt } from '@/components/themed-text';
import { useCart } from '@/store/cart';
import { requestSearchFocus } from '@/store/search-focus';
import { border, colors, radius, spacing } from '@/theme';

/**
 * The header's trailing controls.
 *
 * @ref LLP 0003#icons-and-the-logo — The site's own header carries exactly four:
 * search, account, cart, hamburger, in that order. Each is a real sprite glyph.
 * A screen names the subset it wants; nothing here is drawn unless a screen
 * asked for it.
 */

/** Built-in actions, by the name a screen passes. */
export type HeaderActionName = 'search' | 'account' | 'cart' | 'menu' | 'filters';

/** A screen-specific control that is not part of the site's header set. */
export type HeaderActionConfig = {
  /** React key, and the accessibility label's fallback. */
  key: string;
  icon: BrooksIconName;
  label: string;
  onPress: () => void;
  /** Count for the lime badge. Falsy values draw no badge. */
  badge?: number;
  /** Rendered box on the glyph's longer axis. Defaults to the shared 20. */
  size?: number;
  /** Extra rendered line weight, to reach the shared ~2.2px stroke. */
  thicken?: number;
};

export type HeaderAction = HeaderActionName | HeaderActionConfig;

/**
 * The shared glyph box. `size` is per glyph rather than global because
 * `BrooksIcon` fits the box on the glyph's *longer* axis, so one value would
 * render the wide-and-short hamburger wider than the tall-and-narrow account
 * figure. `thicken` then brings each glyph's encoded weight up to ~2.2px — the
 * same normalization the tab bar does, so a glyph reads at one weight whether
 * it sits in the header or the bar.
 *
 * The hamburger needs no help: its bars are 2 of 18 viewBox units, which land
 * at 2.22px once scaled to 20.
 */
const BUILT_INS: Record<HeaderActionName, Omit<HeaderActionConfig, 'key' | 'badge'>> = {
  search: {
    icon: 'search',
    label: 'Search',
    size: 20,
    thicken: 0,
    // Search lives in the Browse tab's own field now, so the glyph navigates
    // there and asks it for the keyboard. The request is left *before* the
    // navigation, so it is already waiting if this is what mounts the screen.
    // @ref LLP 0003#browse-is-the-search-screen
    onPress: () => {
      requestSearchFocus();
      router.navigate('/(tabs)/(shop)/shop');
    },
  },
  account: {
    icon: 'account',
    label: 'Account',
    size: 20,
    thicken: 0.65,
    onPress: () => router.navigate('/account'),
  },
  cart: {
    icon: 'cart',
    label: 'Cart',
    size: 20,
    thicken: 0.9,
    onPress: () => router.navigate('/cart'),
  },
  // @ref LLP 0003#mega-menu--the-shop-tab — the site's hamburger opens the mega
  // menu, and the mega menu *is* the Browse tab in this app. The glyph keeps its
  // meaning by landing there.
  menu: {
    icon: 'hamburger',
    label: 'Browse everything',
    size: 20,
    thicken: 0,
    onPress: () => router.navigate('/shop'),
  },
  filters: {
    icon: 'filters',
    label: 'Filters',
    size: 21,
    thicken: 0,
    onPress: () => {},
  },
};

function resolve(action: HeaderAction, pathname: string): HeaderActionConfig {
  if (typeof action !== 'string') return action;
  if (action === 'search') {
    return {
      key: action,
      ...BUILT_INS.search,
      // Remember where search was opened from, so its X can return there. Browse
      // itself has nowhere to return to.
      onPress: () => {
        const onBrowse = pathname === '/shop' || pathname.startsWith('/shop/');
        requestSearchFocus(onBrowse ? undefined : pathname);
        router.navigate('/(tabs)/(shop)/shop');
      },
    };
  }
  return { key: action, ...BUILT_INS[action] };
}

export function HeaderActions({ actions }: { actions: readonly HeaderAction[] }) {
  const { count } = useCart();
  const pathname = usePathname();

  // A screen may want the wordmark alone, and an empty row would still take the
  // gutter the `space-between` row gives it.
  if (actions.length === 0) return null;

  return (
    <View style={styles.row}>
      {actions.map((action) => {
        const config = resolve(action, pathname);
        // The cart's count is the store's, not the caller's: a screen should not
        // have to thread it through to keep the badge honest.
        const badge = config.key === 'cart' && !config.badge ? count : config.badge;

        return (
          <Press
            key={config.key}
            accessibilityRole="button"
            accessibilityLabel={config.label}
            onPress={config.onPress}
            // The glyph box is only 20pt wide so the icons keep the site's own
            // rhythm; the slop is what makes each one a real touch target.
            hitSlop={{ top: 14, bottom: 14, left: 9, right: 9 }}
            style={styles.action}
          >
            <BrooksIcon
              name={config.icon}
              size={config.size ?? 20}
              color={colors.surface}
              thicken={config.thicken ?? 0}
            />
            {badge ? (
              <View style={styles.badge}>
                {/* Lime fill, blue text — the site's exact cart-badge treatment,
                    matched to the tab bar's. */}
                <Txt variant="caption" c={colors.blue} style={styles.badgeText}>
                  {badge > 9 ? '9+' : badge}
                </Txt>
              </View>
            ) : null}
          </Press>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  action: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -7,
    right: -10,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    // A ring in the bar's own blue, so the badge reads as sitting on top of the
    // glyph rather than merging with it. One rule does that; it is a knockout,
    // not a control edge.
    borderWidth: border.rule,
    borderColor: colors.blue,
  },
  badgeText: { fontSize: 10, lineHeight: 13 },
});
