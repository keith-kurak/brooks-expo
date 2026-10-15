import { isLiquidGlassAvailable } from 'expo-glass-effect';
import type { Href } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { storage } from './kv-storage';

/**
 * Whether this device can draw the system Liquid Glass tab bar: iOS 26+,
 * unless the app opts out through `UIDesignRequiresCompatibility`. Android,
 * web, and iOS 18 and older never can. A native constant, so it is read once.
 */
export const LIQUID_GLASS = isLiquidGlassAvailable();

const STORAGE_KEY = 'brooks.glassTabs.v1';

/**
 * Which tab bar this device gets.
 *
 * @ref LLP 0003#liquid-glass-is-a-profile-toggle — A Liquid Glass device opens
 * on the system bar (`NativeTabs`); the Profile tab can switch it back to the
 * app-drawn `BrooksTabBar`. Only an explicit choice is stored, so a device that
 * never touched the switch follows this default. Off a glass device the stored
 * value is ignored and the app-drawn bar is the only bar.
 *
 * Storage is synchronous, so the stored bar is the one the first frame mounts.
 */
let glassTabs = LIQUID_GLASS && storage.get<boolean>(STORAGE_KEY, true);
const listeners = new Set<() => void>();

/**
 * Where to send the reader once the new bar is up. Swapping the bar swaps the
 * navigator, and a new navigator starts on its first tab — Home — which would
 * throw the reader off the screen that holds the switch.
 */
let landing: Href | undefined;

/** `from` is the screen that holds the switch, to come back to after the swap. */
export function setGlassTabs(on: boolean, from: Href) {
  if (!LIQUID_GLASS || on === glassTabs) return;
  glassTabs = on;
  landing = from;
  storage.set(STORAGE_KEY, on);
  for (const l of listeners) l();
}

/** The pending landing screen, once: a later remount must not navigate again. */
export function takeLanding() {
  const href = landing;
  landing = undefined;
  return href;
}

/** True when the tab layout mounts `NativeTabs` instead of the app-drawn bar. */
export function useNativeTabs() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => glassTabs,
    () => glassTabs
  );
}

/**
 * True below a tab's stack. Provided by the array-group layout that every tab
 * mounts, so a screen pushed onto the root stack (Login, the PDP) reads false
 * and keeps its bottom edge to itself.
 */
export const InTabContext = createContext(false);

/**
 * How much of a tab screen's bottom edge the tab bar covers.
 *
 * The two bars have opposite layout models. The JS bar is a flex sibling of the
 * screen, so it shortens the screen and covers nothing: 0. The glass bar floats
 * over the screen, which runs to the bottom of the window underneath it. Inside
 * a native tab, `NativeTabs` wraps the content in its own `SafeAreaProvider`,
 * whose bottom inset is the bar plus the home indicator — exactly the strip to
 * keep content out of.
 */
export function useTabBarOverlap() {
  const { bottom } = useSafeAreaInsets();
  const inTab = useContext(InTabContext);
  const native = useNativeTabs();
  return native && inTab ? bottom : 0;
}

/**
 * How far the screen's bottom edge sits above the window's: the JS bar's
 * measured height, or 0 under the glass bar, which does not shorten the screen.
 * Read from context rather than `useBottomTabBarHeight()`, which throws outside
 * the JS navigator.
 */
export function useJsTabBarHeight() {
  return useContext(BottomTabBarHeightContext) ?? 0;
}
