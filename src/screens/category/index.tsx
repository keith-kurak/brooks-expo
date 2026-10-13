import { router, Stack } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { ProductTile } from '@/components/product-tile';
import { Squiggle } from '@/components/squiggle';
import { Txt } from '@/components/themed-text';
import { catalog } from '@/data/catalog';
import { productsIn } from '@/data/query';
import {
  applySearchFilters,
  countSearchFilters,
  SEARCH_SORTS,
  sortSearchResults,
} from '@/data/search-query';
import type { Product } from '@/data/types';
import {
  clearSearchFilterState,
  activateSearchFilters,
  useSearchFilterState,
} from '@/store/search-filters';
import { colors, headerIcon, spacing } from '@/theme';

const { width: W } = Dimensions.get('window');
const GRID_GAP = spacing.lg;
const TILE_W = Math.floor((W - spacing.gutter * 2 - GRID_GAP) / 2);
/** Where the large title sits; past it the bar title appears. */
const TITLE_ZONE = 64;

/**
 * The PLP.
 *
 * @ref LLP 0003#plp — Zappos's utility with adidas's rhythm: a collapsing large
 * title over a 2-up grid of ProductTiles. [observed 2026-09-24] The chrome
 * above the grid is the native bar — the system back chevron on the left,
 * `Filter & sort` as a `Stack.Toolbar.Button` on the right — and the filter
 * panel is the same form sheet Search opens (`/search-filters`), fed through
 * `store/search-filters`.
 */
export function Category({
  id,
  title,
  franchise,
}: {
  id: string;
  title?: string;
  franchise?: string;
}) {
  const insets = useSafeAreaInsets();
  // The bar is transparent and this screen pays for its own top inset, so the
  // layout does not move when a zoom transition paints it. @ref header.plain
  const headerHeight = useHeaderHeight();
  const [showBarTitle, setShowBarTitle] = useState(false);

  const scope = JSON.stringify(['category', id, franchise ?? '']);
  const { filters, sort } = useSearchFilterState(scope);
  const nFilters = countSearchFilters(filters);

  /** The category, narrowed to one franchise when a franchise tile opened it. */
  const base = useMemo(() => {
    const all = productsIn(catalog, String(id));
    return franchise ? all.filter((p) => p.franchise === franchise) : all;
  }, [id, franchise]);
  const products = useMemo(
    () => sortSearchResults(applySearchFilters(base, filters), sort),
    [base, filters, sort]
  );

  const sortLabel = SEARCH_SORTS.find((o) => o.key === sort)?.label ?? '';
  const screenTitle = franchise ?? (title ? String(title) : 'Shop');

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > TITLE_ZONE;
    if (next !== showBarTitle) setShowBarTitle(next);
  };

  /**
   * Publish this listing's candidates and bind the sheet to its scope on open.
   * @ref LLP 0003#filter-correctness — Mounted search results own another scope.
   */
  const openFilters = () => {
    activateSearchFilters(scope, base);
    router.push('/search-filters');
  };

  return (
    <View testID="category-screen" style={styles.root}>
      {/* The stack's own bar: the system back chevron, and `Filter & sort` in
          the trailing slot with the applied count as the item's badge. The
          title stays empty until the in-content large title has scrolled
          away — the same 64pt collapse this screen always had.
          @ref LLP 0003#pushed-screens-wear-the-native-header */}
      <Stack.Screen options={{ headerTitle: showBarTitle ? screenTitle : '' }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={headerIcon.filters}
          accessibilityLabel={nFilters ? `Filter & sort, ${nFilters} applied` : 'Filter & sort'}
          onPress={openFilters}
        >
          {nFilters ? <Stack.Toolbar.Badge>{String(nFilters)}</Stack.Toolbar.Badge> : null}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <FlatList
        data={products}
        keyExtractor={(p: Product) => p.id}
        numColumns={2}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: GRID_GAP, paddingHorizontal: spacing.gutter }}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: insets.bottom + 40,
          gap: spacing.xl,
        }}
        ListHeaderComponent={
          <View style={styles.head}>
            <Txt variant="h1">{screenTitle}</Txt>
            <Txt testID="category-result-count" variant="caption" c={colors.inkMuted} style={{ marginTop: 4 }}>
              {products.length} {products.length === 1 ? 'style' : 'styles'}
              {sort !== 'recommended' ? ` · ${sortLabel}` : ''}
            </Txt>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Txt variant="eyebrow" c={colors.inkMuted}>
              Nothing here yet
            </Txt>
            <Squiggle />
            <Txt variant="body" c={colors.inkMuted} style={{ textAlign: 'center' }}>
              No styles match those filters. Try clearing one.
            </Txt>
            <Chip
              label="Clear filters"
              style={{ marginTop: spacing.lg }}
              onPress={() => clearSearchFilterState(scope)}
            />
          </View>
        }
        renderItem={({ item, index }) => <ProductTile product={item} width={TILE_W} index={index} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  head: { paddingHorizontal: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  empty: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: 80,
  },
});
