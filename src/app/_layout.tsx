import { Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplash } from '@/components/animated-splash';
import { CartProvider } from '@/store/cart';
import { useMileageSync } from '@/store/shoes';
import { useChallengeSync } from '@/store/challenges';
import { colors, header, nativeSheetHeader } from '@/theme';
import { isAppClip } from '@/utils/app-clip';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * The App Clip starts on New Arrivals, and a product link puts the PDP above
 * it, so the PDP has a back chevron to browse with. The app keeps its default:
 * a link opens its screen alone. @ref LLP 0007#routes
 */
export const unstable_settings = isAppClip ? { initialRouteName: 'new-arrivals' } : {};

export default function RootLayout() {
  useMileageSync();
  useChallengeSync();
  const [fontsLoaded] = useFonts({
    'FilsonPro-Regular': require('../../assets/fonts/FilsonProRegular.otf'),
    'FilsonPro-Medium': require('../../assets/fonts/FilsonProMedium.otf'),
    'FilsonPro-Bold': require('../../assets/fonts/FilsonProBold.otf'),
    'FilsonPro-Heavy': require('../../assets/fonts/FilsonProHeavy.otf'),
    'FilsonPro-Black': require('../../assets/fonts/FilsonProBlack.otf'),
    Caveat_600SemiBold,
  });
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // Hold the splash until Filson Pro is ready: letting the system font paint first
  // causes a visible reflow, which is exactly the kind of tell that makes an app
  // feel like a web page in a shell.
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* One keyboard source for the whole app: every input-bearing screen
          (Login's form, Browse's search field) reads the keyboard's real frame
          from react-native-keyboard-controller instead of guessing with
          `KeyboardAvoidingView`. */}
      <KeyboardProvider>
        <SafeAreaProvider>
          <CartProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.surface },
              }}
            >
              {/* The App Clip is the PDP and the bag, with New Arrivals to
                  browse from: no tabs, no Run Club, no mileage. Its own two
                  screens exist only in the Clip. @ref LLP 0007#routes */}
              <Stack.Protected guard={!isAppClip}>
                {/* The root header stays hidden because each tab route owns its
                    branded nested Stack header; this title still feeds web
                    document titles and accessibility. */}
                <Stack.Screen name="(tabs)" options={{ title: 'Brooks' }} />
              </Stack.Protected>
              <Stack.Protected guard={isAppClip}>
                <Stack.Screen name="new-arrivals" options={{ title: 'New Arrivals', ...header.plain }} />
                <Stack.Screen name="bag" options={{ title: 'Bag', ...header.overlay }} />
              </Stack.Protected>
              {/* iOS 18+ zoom is opted in per Link.AppleZoom at the source —
                  the catalog tile into the PDP, and every editorial / franchise
                  card into the PLP. These screens keep the stack default so
                  Android and older iOS still push. @ref LLP 0003#zoom-transitions

                  Both pushed screens wear the native bar, transparent: the
                  PDP's over its full-bleed gallery, the PLP's over its grid.
                  Their buttons are `Stack.Toolbar` items the screens declare.
                  @ref LLP 0003#pushed-screens-wear-the-native-header */}
              <Stack.Screen
                name="product/[id]"
                options={{ title: 'Product', ...header.overlay }}
              />
              <Stack.Screen name="category/[id]" options={{ title: 'Shop', ...header.plain }} />
              {/* Search's `Filter & sort`, the site's panel as a native form
                  sheet. Presented here, by the root stack, because a sheet is
                  not a child of the tab screen that opens it; state crosses
                  through `store/search-filters`.
                  @ref LLP 0003#browse-is-the-search-screen

                  Both sheets wear the native bar on iOS, with the system close
                  button in its trailing slot. Android's form sheet has no
                  header, so there each sheet draws its own title and close.
                  @ref LLP 0003#pushed-screens-wear-the-native-header */}
              <Stack.Screen
                name="search-filters"
                options={{
                  title: 'Filter & sort',
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.92],
                  sheetGrabberVisible: true,
                  contentStyle: { backgroundColor: colors.surface },
                  ...(nativeSheetHeader && header.sheet),
                }}
              />
              {/* The PDP's `Shop the look`, the same form sheet, but only as
                  tall as its rows. Its fit starts from the PDP's own pick,
                  passed as params; the sheet writes straight to the cart.
                  @ref LLP 0003#shop-the-look */}
              <Stack.Screen
                name="shop-the-look"
                options={{
                  title: 'Shop the look',
                  presentation: 'formSheet',
                  sheetAllowedDetents: 'fitToContents',
                  sheetGrabberVisible: true,
                  contentStyle: { backgroundColor: colors.surface },
                  ...(nativeSheetHeader && header.sheet),
                }}
              />
              <Stack.Protected guard={!isAppClip}>
                <Stack.Screen
                  name="join-challenge"
                  listeners={{ transitionEnd: event => {
                    // Health/UIKit restores its status style while dismissing.
                    // Use Expo's imperative API after the sheet transition,
                    // consistent with this app's application-level status bar.
                    if (event.data.closing) StatusBar.setStyle('light', true);
                  } }}
                  options={{ title: 'Weekly 5K', presentation: 'formSheet', sheetAllowedDetents: [0.78, 1],
                    sheetGrabberVisible: true, contentStyle: { backgroundColor: colors.surface },
                    ...(nativeSheetHeader && header.sheet) }}
                />
                <Stack.Screen name="challenge-details" options={{ title: 'Weekly 5K', ...header.plain }} />
                {/* Adding a pair the runner owns, from the Shoes tab or a
                    PDP. A form sheet like `Filter & sort`, for the same reason:
                    the root stack presents it. @ref LLP 0006#adding-a-pair */}
                <Stack.Screen
                  name="add-shoe"
                  options={{
                    title: 'Add a pair',
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.92],
                    sheetGrabberVisible: true,
                    contentStyle: { backgroundColor: colors.surface },
                    ...(nativeSheetHeader && header.sheet),
                  }}
                />
                <Stack.Screen
                  name="login"
                  options={{
                    title: 'Brooks Run Club',
                    presentation: 'modal',
                    // The card below already says "Brooks Run Club".
                    ...(nativeSheetHeader && { ...header.sheet, headerTitle: '' }),
                  }}
                />
              </Stack.Protected>
            </Stack>
            {/* Native only: web has no native splash to hand off from. */}
            {Platform.OS !== 'web' && <AnimatedSplash />}
          </CartProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
