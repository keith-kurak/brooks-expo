import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BottomTabBarHeightCallbackContext } from 'expo-router/js-tabs';
import { CommonActions, StackActions } from 'expo-router/react-navigation';
import { useContext, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { TabIcon, type TabIconName } from '@/components/tab-icon';
import { INDICATOR_EASING, INDICATOR_MS } from '@/components/underline-rail';
import { useCart } from '@/store/cart';
import { colors } from '@/theme';
import { select } from '@/utils/haptics';

/**
 * The app-owned bottom tab bar, and the default on every device. A Liquid
 * Glass device can switch to `NativeTabs` from Profile — see
 * `app/(tabs)/_layout.tsx` and @ref LLP 0003#liquid-glass-is-a-profile-toggle.
 *
 * @ref LLP 0003#icons-and-the-logo — The system bar accepted only SF Symbols /
 * Material Symbols, so no tab could wear a Brooks sprite glyph and the cart
 * badge lost its lime-on-blue treatment. Drawing the bar ourselves gets both
 * back, and lifts the tab ceiling from four to five (the system bar spent a
 * slot on the detached search role and folded a fifth tab into "More").
 *
 * The focus indicator is an ink dash that rides the bar's top edge, sliding
 * along it from tab to tab. It is deliberately the same motion as the PDP /
 * catalog-tile color rail: the duration and easing are imported from
 * `underline-rail.tsx` rather than restated, and it moves on a native CSS transition so selection never
 * touches the JS thread. Item frames are measured once via onLayout instead of
 * assumed to be equal widths, so the rule stays correct on rotation and on the wider
 * Max/iPad frames.
 *
 * Screens do NOT need to pad for this bar. `BottomTabView` puts the screen
 * container and the tab bar side by side in a flex column (`screens: {flex: 1}`),
 * so a non-absolute bar shortens the screen rather than covering it — the
 * `absoluteFill` on each screen is relative to that already-shortened container.
 * The bar also owns the bottom safe-area inset, so bottom-anchored chrome (the
 * cart's sticky checkout bar) needs no inset of its own either. The only reason
 * the height is published below is that `useBottomTabBarHeight()` is public API
 * and would otherwise report React Navigation's UIKit estimate for a bar that
 * is not React Navigation's.
 */

const ROW_HEIGHT = 48;
/** A dash, not a full-width bar — the rule marks the tab, not its slot. */
const DASH_WIDTH = 44;
/**
 * The bar's top edge *is* the indicator's track: the rule sits on the line
 * rather than floating above it, so both are drawn at one thickness and the
 * moving ink reads as the same stroke as the rule it travels along. That costs
 * the top edge its hairline — a hairline dash would be a ghost — so the edge is
 * a 2pt light rule, not a hairline border. Doubling the thickness would have
 * doubled the weight too, so the track drops from the site's border gray to the
 * paler sunken-surface value and lands back at the intended lightness.
 */
const TRACK_HEIGHT = 2;
/** Air below the track, before the glyph. */
const ICON_TOP = 14;

/** Route name (the array-group segment) → icon + accessible label. */
const TABS: { route: string; icon: TabIconName; label: string }[] = [
  { route: '(index)', icon: 'home', label: 'Home' },
  { route: '(shop)', icon: 'browse', label: 'Browse' },
  { route: '(cart)', icon: 'cart', label: 'Cart' },
  { route: '(account)', icon: 'account', label: 'Profile' },
];

export function BrooksTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const reduced = useReducedMotion();
  const { count } = useCart();
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const [frames, setFrames] = useState<{ x: number; width: number }[]>([]);
  const [armed, setArmed] = useState(false);

  const focusedRoute = state.routes[state.index]?.name;
  const focusedIndex = Math.max(
    0,
    TABS.findIndex((t) => t.route === focusedRoute)
  );
  const frame = frames[focusedIndex];

  // Place the rule without motion on first paint; only arm the transition once
  // it already sits under the right tab, or it slides in from x=0 on launch.
  useEffect(() => {
    if (!frame || armed) return;
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, [frame, armed]);

  const onItemLayout = (index: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setFrames((prev) => {
      const cur = prev[index];
      if (cur && cur.x === x && cur.width === width) return prev;
      const next = prev.slice();
      next[index] = { x, width };
      return next;
    });
  };

  const dashStyle = {
    width: DASH_WIDTH,
    backgroundColor: colors.ink,
    opacity: frame ? 1 : 0,
    transform: [{ translateX: frame ? frame.x + frame.width / 2 - DASH_WIDTH / 2 : 0 }],
    transitionProperty: ['transform'] as const,
    transitionDuration: armed && !reduced ? INDICATOR_MS : 0,
    transitionTimingFunction: INDICATOR_EASING,
  };

  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom }]}
      // Report the real measured height so `useBottomTabBarHeight()` is right
      // for screens: React Navigation only estimates it for its own bar.
      onLayout={(e) => reportHeight?.(e.nativeEvent.layout.height)}
    >
      <View style={styles.track}>
        <Animated.View pointerEvents="none" style={[styles.dash, dashStyle]} />
      </View>
      <View style={styles.row}>
        {TABS.map((tab, index) => {
          const route = state.routes.find((r) => r.name === tab.route);
          const focused = index === focusedIndex;
          return (
            <Pressable
              key={tab.route}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={styles.item}
              onLayout={(e) => onItemLayout(index, e)}
              onPress={() => {
                if (!route) return;
                select();
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) return;
                if (focused) {
                  // React Navigation's own tab button does nothing here. Popping
                  // the focused tab's stack back to its anchor is what people
                  // actually expect of a second tap, and with the array-group
                  // clones each tab has an anchor to pop to.
                  //
                  // The action has to be addressed to the nested stack's own
                  // key: actions bubble UP from the navigator they are
                  // dispatched on, so an untargeted popToTop leaves the tab
                  // navigator for the root stack instead of descending into the
                  // tab's stack. The key is absent until the tab has been
                  // rendered once, hence the guard.
                  const nestedKey = (route.state as { key?: string } | undefined)?.key;
                  if (nestedKey) {
                    navigation.dispatch({ ...StackActions.popToTop(), target: nestedKey });
                  }
                } else {
                  navigation.dispatch({
                    ...CommonActions.navigate(route),
                    target: state.key,
                  });
                }
              }}
            >
              <TabIcon
                name={tab.icon}
                color={focused ? colors.ink : colors.inkMuted}
                badge={tab.icon === 'cart' && count > 0 ? count : undefined}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: colors.surfaceSunken,
  },
  row: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    // The glyph is pinned below the track rather than centered in the row, so
    // the air between rule and glyph stays fixed as the row height changes.
    justifyContent: 'flex-start',
    paddingTop: ICON_TOP,
  },
  dash: {
    position: 'absolute',
    left: 0,
    top: 0,
    // Fills the track exactly, so the ink replaces the light rule under it
    // instead of sitting on top of a thicker or thinner line.
    height: TRACK_HEIGHT,
  },
});
