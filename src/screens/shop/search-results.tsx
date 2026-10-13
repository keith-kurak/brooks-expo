import { router, useScrollToTop } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { BrooksIcon } from '@/components/icons';
import { Chip } from '@/components/chip';
import { Divider } from '@/components/divider';
import { Press } from '@/components/press';
import { Price } from '@/components/price';
import { ShoeImage } from '@/components/shoe-image';
import { Squiggle } from '@/components/squiggle';
import { Txt } from '@/components/themed-text';
import { catalog } from '@/data/catalog';
import { autocomplete, type Suggestions } from '@/data/constructor';
import { VOICE } from '@/data/editorial';
import { heroImage } from '@/data/images';
import { filterSearchRows, searchRows, type SearchRow } from '@/data/search-results';
import {
  countSearchFilters,
  SEARCH_SORTS,
} from '@/data/search-query';
import type { Product } from '@/data/types';
import { clearSearchFilterState, patchSearchFilterState, SEARCH_FILTER_SCOPE, useSearchFilterState } from '@/store/search-filters';
import { colors, spacing } from '@/theme';
import { useJsTabBarHeight, useTabBarOverlap } from '@/utils/native-tabs';

/**
 * Search results, shown in place of Browse's own content while its field is in
 * use.
 *
 * @ref LLP 0002#constructor-io — The one view that talks to a real Brooks API
 * live from the device: type-ahead against the same Constructor.io index the
 * website's search box uses. Constructor carries no prices, so every hit is
 * joined back to the catalog snapshot by style id before it renders a price.
 *
 * @ref LLP 0003#browse-is-the-search-screen — This used to be a pushed screen
 * with the native `Stack.SearchBar`. The field is Browse's own now, so this is
 * a body, not a screen: it owns no input and no chrome, only the results.
 * Filters and sort come from the `search-filters` form sheet through the store.
 */

export function SearchResults({ query }: { query: string }) {
  const [response, setResponse] = useState<{ query: string; live: Suggestions | null; offline: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const current = response?.query === query.trim() ? response : null;
  const live = current?.live ?? null;
  const offline = current?.offline ?? false;
  const { sort, filters } = useSearchFilterState(SEARCH_FILTER_SCOPE);
  const clearFilters = () => clearSearchFilterState(SEARCH_FILTER_SCOPE);
  const nFilters = countSearchFilters(filters);

  // The keyboard's frame, on the UI thread: the list ends above the keys rather
  // than under them, and the spacer follows the keyboard's own curve.
  const keyboard = useReanimatedKeyboardAnimation();
  const keyboardSpacer = useAnimatedStyle(() => ({ height: -keyboard.height.get() }));
  /**
   * The empty state is centred in what is *left* of the screen, not in the
   * screen: this body already starts at the field's bottom edge, so reserving
   * the keyboard at the foot makes the free space exactly the gap between the
   * field and the keys, and `justifyContent: 'center'` puts the copy in the
   * middle of it. It follows the keyboard's own curve, so the copy glides down
   * to the new centre when a drag dismisses the keys.
   *
   * [observed 2026-08-27] The tab bar's height comes off that reservation.
   * Keyboard Controller measures the frame from the bottom of the *window*,
   * but this body's own bottom edge is the tab bar's top edge, because the JS
   * bar shortens the screen rather than covering it (@ref components/tab-bar).
   * So padding by the raw keyboard height double-counts the bar and parks the
   * copy a tab bar's height too high. Measured 334pt against a true centre of
   * 375pt on an iPhone 17 Pro Max before the subtraction.
   *
   * `height` is negative while the keyboard is up (the library reports the
   * frame as an offset), hence the negation.
   *
   * Under the glass tab bar the arithmetic flips: the body runs to the bottom
   * of the window, so nothing comes off the keyboard, and with the keys down
   * the floor is the bar itself rather than 0, or the copy centres on a space
   * that includes the strip under the glass. @ref utils/native-tabs
   */
  const tabBarHeight = useJsTabBarHeight();
  const tabBarOverlap = useTabBarOverlap();
  const emptyPad = useAnimatedStyle(() => ({
    paddingBottom: Math.max(tabBarOverlap, -keyboard.height.get() - tabBarHeight),
  }));

  // While searching, the results are what a second tap on Browse should scroll.
  // @ref components/screen
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  /** Debounced live autocomplete; aborts the in-flight request on every keystroke. */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResponse(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const s = await autocomplete(q, { signal: ctrl.signal });
        if (!ctrl.signal.aborted) setResponse({ query: q, live: s, offline: false });
      } catch {
        if (!ctrl.signal.aborted) {
          setResponse({ query: q, live: null, offline: true });
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  /** Both live and offline rows use the same filtering and rendering path. */
  const joined = useMemo(
    () => live || offline ? searchRows(catalog.products, live?.products ?? null, query) : [],
    [live, offline, query]
  );

  // The sheet derives its facets and live count from what this search found.
  // Cleared on unmount too: a count that outlives the search it counted is
  // what the sheet would otherwise show the next time it opens.
  useEffect(() => {
    patchSearchFilterState({
      candidates: joined.map((r) => r.local).filter((p): p is Product => p != null),
      unmatchedCount: joined.filter((r) => !r.local).length,
    }, SEARCH_FILTER_SCOPE);
    return () => patchSearchFilterState({ candidates: [], unmatchedCount: 0 }, SEARCH_FILTER_SCOPE);
  }, [joined]);

  /**
   * Filtering and sorting need catalog data, so once either is active the rows
   * that exist only in the live index drop out; with neither, they stay, in the
   * index's own order — which is what "Recommended for you" means.
   */
  const rows = useMemo(() => filterSearchRows(joined, filters, sort), [joined, filters, sort]);

  const openHit = ({ hit, local }: SearchRow) => {
    Keyboard.dismiss();
    if (local) {
      router.push({ pathname: '/product/[id]', params: { id: hit.id, color: local.colors[0]?.code } });
    } else {
      // In the live index but not the snapshot — land on search-in-category.
      router.push({
        pathname: '/category/[id]',
        params: { id: 'featured-new-arrivals', title: hit.name },
      });
    }
  };

  const sortLabel = SEARCH_SORTS.find((s) => s.key === sort)?.label ?? '';
  const active = query.trim().length >= 2;

  /* ----------------------------------------------------------- EMPTY ---- */
  // Nothing to search on yet. This used to be a rail of trending chips sitting
  // under the field; it is one centred empty state now, in the house pattern
  // the empty bag already uses (eyebrow, squiggle, a line of voice).
  if (!active) {
    return (
      // A scroller with nothing to scroll: `flexGrow` gives the content the
      // viewport's height so the centring works, and the drag it still accepts
      // is what dismisses the keyboard, exactly as it does over the results.
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.emptyContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.empty, emptyPad]}>
          <Txt variant="eyebrow" c={colors.inkMuted}>
            Search
          </Txt>
          <Squiggle />
          <Txt variant="h2" style={styles.emptyLine}>
            {VOICE.emptySearch}
          </Txt>
          <Txt variant="body" c={colors.inkMuted} style={[styles.emptyLine, styles.emptyHint]}>
            {VOICE.emptySearchHint}
          </Txt>
        </Animated.View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      contentInset={{ bottom: tabBarOverlap }}
      showsVerticalScrollIndicator={false}
    >
      {loading && !live && (
        <View style={[styles.block, { alignItems: 'center', marginTop: spacing.xl }]}>
          <ActivityIndicator size="small" color={colors.inkMuted} />
        </View>
      )}

      {/* -------------------------------------------------- PRODUCT HITS -- */}
      {offline && active && (
        <View style={styles.block}>
          <Txt variant="tiny" c={colors.inkMuted}>
            Live search unreachable — searching the on-device catalog instead.
          </Txt>
        </View>
      )}
      {(live || offline) && joined.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <View style={styles.summary}>
            <Txt testID="search-result-count" variant="tiny" c={colors.inkMuted}>
              {rows.length} {rows.length === 1 ? 'result' : 'results'}
              {sort !== 'recommended' ? ` · ${sortLabel}` : ''}
            </Txt>
            {nFilters > 0 ? (
              <Press onPress={clearFilters} hitSlop={8}>
                <Txt variant="tiny" c={colors.blue}>
                  Clear filters ({nFilters})
                </Txt>
              </Press>
            ) : null}
          </View>
          {rows.map(({ hit, local }) => {
            const imageUrl = local ? heroImage(local.colors[0]?.images ?? []) : hit.imageUrl;
            return (
              <View key={hit.id}>
                <Press scaleTo={0.98} onPress={() => openHit({ hit, local })} style={styles.hit}>
                  <View style={styles.hitImage}>
                    {imageUrl ? <ShoeImage url={imageUrl} width={64} height={64} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="productTitle" numberOfLines={1}>
                      {hit.name}
                    </Txt>
                    <Txt variant="tiny" c={colors.inkMuted} numberOfLines={1}>
                      {[
                        hit.gender === 'womens' ? "Women's" : hit.gender === 'mens' ? "Men's" : null,
                        hit.cushion ? `${hit.cushion} cushion` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Txt>
                    {local ? (
                      <View style={{ marginTop: 3 }}>
                        <Price value={local.price} listValue={local.listPrice} />
                      </View>
                    ) : (
                      <Txt variant="tiny" c={colors.inkFaint} style={{ marginTop: 3 }}>
                        Live index — not in this snapshot
                      </Txt>
                    )}
                  </View>
                  <BrooksIcon name="caretRight" size={14} color={colors.inkFaint} />
                </Press>
                <Divider style={{ marginLeft: spacing.gutter + 64 + spacing.lg }} />
              </View>
            );
          })}
          {rows.length === 0 && (
            <View style={[styles.block, { alignItems: 'center', paddingTop: spacing.xl }]}>
              <Txt variant="h3">Nothing matches those filters</Txt>
              <Chip
                label="Clear filters"
                size="sm"
                style={{ marginTop: spacing.lg }}
                onPress={clearFilters}
              />
            </View>
          )}
        </View>
      )}

      {/* Products alone decide this, now that the index's term suggestions are
          no longer drawn: a query that returns terms but no shoes has nothing
          on screen to explain itself otherwise. */}
      {(live || offline) && joined.length === 0 && (
        <View style={[styles.block, { alignItems: 'center', paddingTop: spacing.xxl }]}>
          <Txt variant="h3">No matches for “{query.trim()}”</Txt>
          <Txt variant="body" c={colors.inkMuted} style={{ marginTop: spacing.sm, textAlign: 'center' }}>
            Try a franchise name — Ghost, Glycerin, Adrenaline…
          </Txt>
        </View>
      )}

      <Animated.View style={keyboardSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: spacing.gutter, marginTop: spacing.lg },
  emptyContent: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyLine: { textAlign: 'center' },
  emptyHint: { marginTop: spacing.sm },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xs,
  },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  hitImage: { backgroundColor: colors.surfaceAlt },
});
