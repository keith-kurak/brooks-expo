import { Stack } from 'expo-router/stack';
import { StyleSheet, View } from 'react-native';

import { colors, header } from '@/theme';
import { InTabContext } from '@/utils/native-tabs';

export const unstable_settings = {
  index: { anchor: 'index' },
  shop: { anchor: 'shop' },
  cart: { anchor: 'cart' },
  account: { anchor: 'account' },
};

const tabNames = new Set(['index', 'shop', 'cart', 'account']);

/**
 * Shared native stack chrome for every tab.
 *
 * @ref LLP 0003#the-header-collapses-on-scroll — [superseded 2026-08-21] Each
 * tab used to carry a native transparent header with the wordmark in a
 * `Stack.Toolbar`. Chrome above an anchor is app-drawn now, so every anchor
 * hides the native header.
 *
 * [observed 2026-08-26] What each anchor then draws is no longer the same thing.
 * Home mounts the blue collapsing `useBrooksHeader`, which floats over its video
 * hero. Browse, Cart, Profile, and Shoe Finder draw nothing above their content:
 * they open on an in-content `h1` and take their safe area from
 * `components/screen`. `finder` is still declared unconditionally below because
 * it can be pushed onto another tab's stack.
 *
 * [observed 2026-08-26] There is no `search` screen any more. Browse *is* the
 * search screen: its own field takes focus and swaps the browse content for the
 * live results in place. @ref LLP 0003#browse-is-the-search-screen
 */
export default function TabStackLayout({ segment }: { segment: string }) {
  const matchedName = segment.match(/\(([^)]+)\)/)?.[1] ?? 'index';
  const screenName = tabNames.has(matchedName) ? matchedName : 'index';

  return (
    <InTabContext value>
      <View collapsable={false} style={styles.root}>
        <Stack
          screenOptions={{
            animation: 'none',
            contentStyle: { backgroundColor: colors.surface },
            headerBackButtonDisplayMode: 'minimal',
            headerBlurEffect: 'none',
            headerShadowVisible: false,
            headerTitle: '',
            headerTransparent: true,
          }}
        >
          <Stack.Screen name={screenName} options={{ headerShown: false, title: screenName === 'account' ? 'Profile' : undefined }} />
          <Stack.Screen name="challenges" options={{ title: 'Challenges', headerShown: true }} />
          {/* @ref LLP 0006#shoes-opens-from-profile — a pushed screen with
              the native back chevron, above Profile's account anchor. */}
          <Stack.Screen
            name="shoes"
            options={{ title: 'Your shoes', ...header.overlay, animation: 'default' }}
          />
          {/* Pushed in any tab: Your shoes, the Browse card and the Profile
              row all open it. Its full-bleed navy panel has no room for a
              header, so it draws its own back control. */}
          <Stack.Screen name="finder" options={{ headerShown: false }} />
          <Stack.Screen name="health-data" options={{ ...header.sheet, headerTransparent: false, headerTitle: 'Health data' }} />
        </Stack>
      </View>
    </InTabContext>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
