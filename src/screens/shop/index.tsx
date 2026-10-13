import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useCollapse, useHeaderScroll } from '@/components/brooks-header';
import { FILTER_BUTTON_SIZE, FilterButton } from '@/components/filter-button';
import { BrooksIcon } from '@/components/icons';
import { OUTLINE_BUTTON_SIZE, OutlineIconButton } from '@/components/outline-icon-button';
import { Photo } from '@/components/photo';
import { Press } from '@/components/press';
import { ScreenHeading, useScreenTopPadding } from '@/components/screen';
import { SEARCH_BAR_HEIGHT, SearchBar, type SearchBarHandle } from '@/components/search-bar';
import { Txt } from '@/components/themed-text';
import { INDICATOR_TIMING_EASING } from '@/components/underline-rail';
import { ZoomSource } from '@/components/zoom-source';
import { catalog } from '@/data/catalog';
import { VOICE } from '@/data/editorial';
import { heroImage } from '@/data/images';
import { countSearchFilters } from '@/data/search-query';
import { consumeSearchFocus } from '@/store/search-focus';
import { activateSearchFilters, getSearchFilterState, SEARCH_FILTER_SCOPE, useSearchFilterState } from '@/store/search-filters';
import { border, colors, motion, spacing, type } from '@/theme';
import { useTabBarOverlap } from '@/utils/native-tabs';

import { SearchResults } from './search-results';

const FRANCHISE_WIDTH = 140;
const FRANCHISE_ART_WIDTH = FRANCHISE_WIDTH;
const FRANCHISE_ART_HEIGHT = FRANCHISE_ART_WIDTH;

/**
 * The fixed title band: the `h1` line plus `ScreenHeading`'s own bottom margin,
 * so the row is exactly what `<ScreenHeading>` occupies.
 */
const TITLE_ROW = type.h1.lineHeight + spacing.lg;
/** The collapsing band: the field plus the air below it. Also its travel. */
const SEARCH_ROW = SEARCH_BAR_HEIGHT + spacing.xl;
/** Room the field gives up on the right for the filter button. */
const FILTER_SLOT = FILTER_BUTTON_SIZE + spacing.sm;
/** And on the left for the dismiss button. Same square, mirrored. */
const DISMISS_SLOT = OUTLINE_BUTTON_SIZE + spacing.sm;

/** The shape of the Brooks site's own shop navigation. */
const SECTIONS = [
  {
    title: 'Shop by gender',
    rows: [
      { id: 'womens-shoes', label: "Women's Shoes" },
      { id: 'mens-shoes', label: "Men's Shoes" },
      { id: 'womens-apparel', label: "Women's Apparel" },
      { id: 'mens-apparel', label: "Men's Apparel" },
    ],
  },
  {
    title: 'Featured',
    rows: [
      { id: 'featured-new-arrivals', label: 'New Arrivals' },
      { id: 'featured-best-sellers', label: 'Best Sellers' },
      { id: 'featured-trail-running-collection', label: 'Trail' },
      { id: 'featured-shoes-in-widths', label: 'Shoes in Widths' },
      { id: 'sale', label: 'Sale' },
    ],
  },
];

/** Brooks's franchises, the way runners actually shop. */
const FRANCHISES = ['Ghost', 'Glycerin', 'Adrenaline', 'Hyperion', 'Cascadia', 'Launch'];

/**
 * Browse — and, once its field is touched, Search.
 *
 * @ref LLP 0003#browse-is-the-search-screen — Two bands sit above the content.
 * The `Shop` title is fixed. The search field below it collapses on the same
 * two-regime rules as Home's blue header (`useCollapse`, with the field's own
 * height as the travel) and comes back on an upward flick — the title never
 * moves. On focus the field rises into the title's line (the title fades under
 * it), gives up both edges to a pair of outlined squares that slide in from
 * opposite sides of the screen — `Filter & sort` on the right, a dismiss cross
 * on the left — and the browse content cross-fades to the results. The dismiss
 * cross is always there while searching, so the way out never depends on there
 * being text — and it is the only clear, the field drawing no cross of its own.
 *
 * All of that motion is one progress value on the UI thread, eased with the
 * tab bar's own curve so the two feel like one system.
 */
export function Shop() {
  const paddingTop = useScreenTopPadding();
  const tabBarOverlap = useTabBarOverlap();
  const reduceMotion = useReducedMotion();
  const { filters } = useSearchFilterState(SEARCH_FILTER_SCOPE);
  const nFilters = countSearchFilters(filters);

  const barRef = useRef<SearchBarHandle>(null);
  const [query, setQuery] = useState('');
  const queryRef = useRef(query);
  queryRef.current = query;
  const [searchMode, setSearchMode] = useState(false);
  // Stays mounted through the fade-out; unmounted once progress reaches zero.
  const [resultsMounted, setResultsMounted] = useState(false);

  const { state, scrollProps } = useHeaderScroll({ travel: SEARCH_ROW });
  const { translateY, opacity } = useCollapse(state);
  /** 0 browsing, 1 searching. */
  const progress = useSharedValue(0);

  useEffect(() => {
    if (searchMode) setResultsMounted(true);
    progress.set(
      withTiming(searchMode ? 1 : 0, {
        duration: reduceMotion ? 0 : motion.base,
        easing: INDICATOR_TIMING_EASING,
      })
    );
  }, [searchMode, progress, reduceMotion]);

  useAnimatedReaction(
    () => progress.get() === 0,
    (idle, wasIdle) => {
      if (idle && wasIdle === false) scheduleOnRN(setResultsMounted, false);
    }
  );

  /**
   * Home's header glyph and the PLP's search button land here asking for the
   * keyboard. @ref store/search-focus — why the ask is a signal, not a param.
   *
   * Hung on navigation focus rather than on mount, because the two callers
   * arrive differently: the glyph is a tab switch that may be what mounts this
   * screen, while the PLP button pops a screen off this tab's own stack, so
   * Browse was already mounted and only *becomes* focused. Gaining focus is the
   * one event both share. A pending request that nobody sent is a no-op here,
   * so an ordinary back-navigation onto Browse costs one `consume` and stops.
   *
   * [observed 2026-08-26] Focusing once is not enough on the pop: the field can
   * still be attaching, and settling the transition resigns first responder
   * again. So the focus is re-attempted on a short ladder and stops as soon as
   * it sticks — cheaper and steadier than one guessed delay long enough for the
   * slowest case.
   */
  const focusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useFocusEffect(
    useCallback(() => {
      if (!consumeSearchFocus()) return;
      let cancelled = false;
      const attempt = ([delay, ...rest]: number[]) => {
        focusTimer.current = setTimeout(() => {
          if (cancelled || barRef.current?.isFocused()) return;
          barRef.current?.focus();
          if (rest.length) attempt(rest);
        }, delay);
      };
      attempt([60, 180, 360, 600]);
      return () => {
        cancelled = true;
        clearTimeout(focusTimer.current);
      };
    }, [])
  );

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -TITLE_ROW * progress.get() }],
  }));
  const barStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      // The collapse yields to the focus motion: a hidden field is pulled back
      // into view as it rises, whatever the scroll offset says.
      transform: [{ translateY: translateY.get() * (1 - p) }],
      opacity: opacity.get() + (1 - opacity.get()) * p,
      marginLeft: DISMISS_SLOT * p,
      marginRight: FILTER_SLOT * p,
    };
  });
  /**
   * The two flanking buttons ride the same progress value out of opposite edges,
   * each starting a full square plus the gutter away so it is genuinely off
   * screen (the band clips) rather than parked under the field.
   */
  const filterStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      transform: [{ translateX: (FILTER_BUTTON_SIZE + spacing.gutter) * (1 - p) }],
      opacity: p,
    };
  });
  const dismissStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      transform: [{ translateX: -(OUTLINE_BUTTON_SIZE + spacing.gutter) * (1 - p) }],
      opacity: p,
    };
  });
  const titleStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const browseStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    pointerEvents: progress.get() < 0.5 ? ('auto' as const) : ('none' as const),
  }));
  const resultsStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    pointerEvents: progress.get() > 0.5 ? ('auto' as const) : ('none' as const),
  }));

  return (
    <View style={styles.root}>
      {/* ----------------------------------------------------- BROWSE ---- */}
      <Animated.ScrollView
        {...scrollProps}
        showsVerticalScrollIndicator={false}
        contentInset={{ bottom: tabBarOverlap }}
        style={browseStyle}
        contentContainerStyle={{
          paddingTop: paddingTop + TITLE_ROW + SEARCH_ROW,
          paddingBottom: spacing.xxxl,
        }}
      >
        {/* Franchise shortcuts — the fastest path for a runner who knows the shoe. */}
        <Txt variant="eyebrow" c={colors.inkMuted} style={styles.railLabel}>
          Franchises
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={FRANCHISE_WIDTH + spacing.md}
          contentContainerStyle={styles.rail}
        >
          {FRANCHISES.map((f) => {
            const p = catalog.products.find((x) => x.franchise === f && x.colors.length);
            return (
              /* The shoe itself opens the franchise, so it zooms into it.
                 @ref LLP 0003#zoom-transitions */
              <Link
                key={f}
                href={{
                  pathname: '/category/[id]',
                  params: { id: 'brooks-running-shoes', title: f, franchise: f },
                }}
                asChild
              >
                <Press accessibilityRole="button" scaleTo={0.95} style={styles.franchise}>
                  <ZoomSource
                    width={FRANCHISE_ART_WIDTH}
                    height={FRANCHISE_ART_HEIGHT}
                    style={styles.franchiseArt}
                  >
                    {p ? (
                      <Photo
                        url={heroImage(p.colors[0].images)}
                        width={FRANCHISE_ART_WIDTH}
                        height={FRANCHISE_ART_HEIGHT}
                      />
                    ) : null}
                  </ZoomSource>
                  <Txt variant="caption">{f}</Txt>
                </Press>
              </Link>
            );
          })}
        </ScrollView>

        {/* The Shoe Finder is pushed on Browse's own stack, so Back returns
            here. Your shoes opens from Profile.
            @ref LLP 0006#shoes-opens-from-profile */}
        <Press
          scaleTo={0.98}
          style={styles.finderCard}
          onPress={() => router.push('/(tabs)/(shop)/finder')}
        >
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Txt variant="eyebrow" c={colors.lime}>
              Shoe Finder
            </Txt>
            <Txt variant="h3" c={colors.surface}>
              {VOICE.finderWelcome}
            </Txt>
          </View>
          <BrooksIcon name="caretRight" size={16} color={colors.surface} />
        </Press>

        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Txt variant="eyebrow" c={colors.inkMuted} style={{ paddingHorizontal: spacing.gutter }}>
              {s.title}
            </Txt>
            {/* The rows' rules stop at the gutter, not the screen edge. */}
            <View style={{ marginTop: spacing.md, marginHorizontal: spacing.gutter }}>
              {s.rows.map((r) => {
                return (
                  <Press
                    key={r.id}
                    scaleTo={0.99}
                    style={styles.row}
                    onPress={() =>
                      router.push({
                        pathname: '/category/[id]',
                        params: { id: r.id, title: r.label },
                      })
                    }
                  >
                    <Txt variant="navRow">{r.label}</Txt>
                    <BrooksIcon name="caretRight" size={14} color={colors.inkFaint} />
                  </Press>
                );
              })}
            </View>
          </View>
        ))}
      </Animated.ScrollView>

      {/* ---------------------------------------------------- RESULTS ---- */}
      {resultsMounted ? (
        <Animated.View
          style={[styles.results, { top: paddingTop + SEARCH_BAR_HEIGHT + spacing.sm }, resultsStyle]}
        >
          <SearchResults query={query} />
        </Animated.View>
      ) : null}

      {/* ------------------------------------------------------ TITLE ---- */}
      <View style={[styles.titleBand, { height: paddingTop + TITLE_ROW, paddingTop }]}>
        <Animated.View style={titleStyle}>
          <ScreenHeading>Shop</ScreenHeading>
        </Animated.View>
      </View>

      {/* ------------------------------------------------------ FIELD ---- */}
      <Animated.View style={[styles.searchBand, { top: paddingTop + TITLE_ROW }, wrapStyle]}>
        <Animated.View style={[styles.dismiss, dismissStyle]}>
          <OutlineIconButton
            icon="close"
            iconSize={14}
            accessibilityLabel="Close search"
            onPress={() => barRef.current?.reset()}
          />
        </Animated.View>
        <Animated.View style={barStyle}>
          <SearchBar
            ref={barRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchMode(true)}
            onBlur={() => {
              // A ref, not `query`: this closure can be a render old.
              if (queryRef.current.length === 0) setSearchMode(false);
            }}
            onClear={() => setSearchMode(false)}
          />
        </Animated.View>
        <Animated.View style={[styles.filter, filterStyle]}>
          <FilterButton count={nFilters} onPress={() => {
            const search = getSearchFilterState(SEARCH_FILTER_SCOPE);
            activateSearchFilters(SEARCH_FILTER_SCOPE, search.candidates, search.unmatchedCount);
            router.push('/search-filters');
          }} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  titleBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.surface,
  },
  searchBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SEARCH_ROW,
    // Clips the field as it collapses upward and the button as it waits off
    // the right edge; the band itself is transparent so content shows through
    // the space a hidden field gives back.
    overflow: 'hidden',
    zIndex: 20,
    paddingHorizontal: spacing.gutter,
  },
  filter: { position: 'absolute', top: 0, right: spacing.gutter },
  dismiss: { position: 'absolute', top: 0, left: spacing.gutter },
  results: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  railLabel: { paddingHorizontal: spacing.gutter, marginBottom: spacing.md },
  rail: { paddingHorizontal: spacing.gutter, gap: spacing.md },
  /* No card chrome: the art and its name, a gap apart. */
  franchise: { width: FRANCHISE_WIDTH, gap: spacing.sm },
  franchiseArt: { backgroundColor: colors.surfaceAlt },
  finderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.gutter,
    marginTop: spacing.xxl,
    padding: spacing.lg,
    backgroundColor: colors.blue,
  },
  section: { marginTop: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: border.rule,
    borderBottomColor: colors.hairline,
  },
});
