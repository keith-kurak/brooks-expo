import { Tabs } from 'expo-router/js-tabs';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { DynamicColorIOS, Platform } from 'react-native';

import { BrooksTabBar } from '@/components/tab-bar';
import { useCart } from '@/store/cart';
import { colors } from '@/theme';
import { takeLanding, useNativeTabs } from '@/utils/native-tabs';

/**
 * The bottom tab bar. Four tabs: Home, Browse, Cart, Profile.
 *
 * @ref LLP 0006#shoes-opens-from-profile — Profile pushes Your shoes on its
 * own stack, so the owned pairs no longer need a tab of their own.
 *
 * @ref LLP 0003#liquid-glass-is-a-profile-toggle — A Liquid Glass device
 * starts on the system bar (`NativeTabs`); every other device has only the
 * app-drawn `BrooksTabBar`. A glass device can switch back from Profile. Both mount the same four array-group clones, so
 * the routes, stacks, and anchors are identical either way.
 *
 * Each trigger targets one clone of the shared array-group Stack so every tab
 * gets the same native Brooks toolbar without duplicating its layout.
 */
export default function TabLayout() {
  const native = useNativeTabs();

  // Swapping the bar mounts a new navigator, which opens on Home. Its first
  // effect sends the reader back to the screen that held the switch. Child
  // effects run first, so the new navigator is mounted by then.
  useEffect(() => {
    const href = takeLanding();
    if (href) router.navigate(href);
  }, [native]);

  return native ? <GlassTabs /> : <BrooksTabs />;
}

/**
 * @ref LLP 0003#icons-and-the-logo — The app-drawn bar draws the Brooks glyphs
 * as SVG, and keeps the lime-on-blue cart badge, which the system bar cannot
 * render (its badge text is fixed white).
 */
function BrooksTabs() {
  return (
    <Tabs
      tabBar={(props) => <BrooksTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="(index)" options={{ title: 'Home' }} />
      <Tabs.Screen name="(shop)" options={{ title: 'Browse' }} />
      <Tabs.Screen name="(cart)" options={{ title: 'Cart' }} />
      <Tabs.Screen name="(account)" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

/**
 * The selected tab's color. Ink, like the app-drawn bar — but glass flips to
 * its dark appearance over dark content (Shoe Finder's navy panel, Home's
 * footer), where ink on navy disappears. A dynamic color follows that flip.
 * iOS only: `DynamicColorIOS` throws elsewhere, and this module loads everywhere.
 */
const GLASS_TINT =
  Platform.OS === 'ios' ? DynamicColorIOS({ light: colors.ink, dark: colors.surface }) : colors.ink;

/**
 * @ref LLP 0003#the-glass-bar-wears-the-brooks-glyphs — The same four glyphs
 * as `BrooksTabBar`, as PNGs: `NativeTabs` cannot draw react-native-svg. They
 * come from `tools/tab-icons/render.js`, which copies `TabIcon`'s geometry;
 * rerun it after changing a glyph. Black on transparent, drawn as template
 * images so the bar tints them like any system icon.
 */
const ICONS = {
  home: require('../../../assets/tab-icons/home.png'),
  browse: require('../../../assets/tab-icons/browse.png'),
  cart: require('../../../assets/tab-icons/cart.png'),
  account: require('../../../assets/tab-icons/account.png'),
};

/**
 * The system bar, wearing the app-drawn bar's own glyphs. Icons only,
 * like the app-drawn bar: each label is `hidden`, which blanks the item title,
 * so the name moves to the trigger's `accessibilityLabel` for VoiceOver.
 *
 * Browse is the search screen, so it needs no separate search trigger.
 *
 * `disableAutomaticContentInsets` on every trigger: the system would otherwise
 * flip each tab's first scroll view from `never` to `automatic`, and every
 * screen here already pads for the top safe area itself (`components/screen`),
 * so the top inset would be applied twice. Screens clear the bar through
 * `useTabBarOverlap()` instead.
 *
 * `disableScrollToTop` on every trigger: the system's re-tap scroll finds only
 * the first scroll view down the first-subview chain, which missed Browse. The
 * screens scroll themselves on `tabPress` instead, as they do under the JS bar
 * (@ref components/screen). Pop-to-top stays the system's.
 *
 * The cart badge is always mounted and toggled with `hidden`, so the trigger's
 * children keep one shape as the count changes. `hidden` is only read when the
 * badge has no text — any string, "0" included, shows — so an empty cart has
 * to pass none.
 */
function GlassTabs() {
  const { count } = useCart();

  return (
    <NativeTabs tintColor={GLASS_TINT} badgeBackgroundColor={colors.blue}>
      <NativeTabs.Trigger
        name="(index)"
        accessibilityLabel="Home"
        disableAutomaticContentInsets
        disableScrollToTop
      >
        <NativeTabs.Trigger.Icon src={ICONS.home} renderingMode="template" />
        <NativeTabs.Trigger.Label hidden>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="(shop)"
        accessibilityLabel="Browse"
        disableAutomaticContentInsets
        disableScrollToTop
      >
        <NativeTabs.Trigger.Icon src={ICONS.browse} renderingMode="template" />
        <NativeTabs.Trigger.Label hidden>Browse</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="(cart)"
        accessibilityLabel="Cart"
        disableAutomaticContentInsets
        disableScrollToTop
      >
        <NativeTabs.Trigger.Icon src={ICONS.cart} renderingMode="template" />
        <NativeTabs.Trigger.Label hidden>Cart</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={count === 0}>
          {count === 0 ? undefined : count > 9 ? '9+' : String(count)}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="(account)"
        accessibilityLabel="Profile"
        disableAutomaticContentInsets
        disableScrollToTop
      >
        <NativeTabs.Trigger.Icon src={ICONS.account} renderingMode="template" />
        <NativeTabs.Trigger.Label hidden>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
