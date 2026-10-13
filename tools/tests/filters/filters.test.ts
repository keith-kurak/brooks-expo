import { describe, expect, test } from 'bun:test';

import raw from '../../../packages/catalog/catalog.json';
import { productsIn } from '../../../packages/catalog/query';
import {
  applySearchFilters,
  COLOUR_FAMILIES,
  EMPTY_SEARCH_FILTERS,
  sortSearchResults,
  colourFamiliesOfColorway,
  featureFacets,
  SEARCH_SORTS,
} from '../../../packages/catalog/search-query';
import { filterResultCount, filterSearchRows, searchRows } from '../../../packages/catalog/search-results';
import type { Catalog, Product } from '../../../packages/catalog/types';
import { clearSearchFilterState, getSearchFilterState, patchSearchFilterState } from '../../../src/store/search-filters';

const catalog: Catalog = raw as Catalog;
const pink = COLOUR_FAMILIES.find((c) => c.key === 'pink')!;

describe('filter regressions', () => {
  test('Pink shows matching photography and swatches, including colors beyond the first four', () => {
    const before = JSON.stringify(catalog.products);
    const results = applySearchFilters(productsIn(catalog, 'mens-shoes'), {
      ...EMPTY_SEARCH_FILTERS, colours: ['pink'],
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.find((p) => p.name === 'Adrenaline GTS 25')).toBeDefined();
    for (const p of results) {
      expect(p.colors.length).toBeGreaterThan(0);
      expect(p.colors.every((c) => pink.words.test(c.name))).toBe(true);
    }
    expect(JSON.stringify(catalog.products)).toBe(before);
  });

  test('five stars excludes 4.8 and unrated products', () => {
    const sample = catalog.products[0];
    const products = [5, 4.8, 4, null].map((rating, i) => ({ ...sample, id: String(i), rating }));
    expect(applySearchFilters(products, { ...EMPTY_SEARCH_FILTERS, minRating: 5 }).map((p) => p.rating))
      .toEqual([5]);
  });

  test('unknown prices sort last in either direction', () => {
    const sample = catalog.products[0];
    const products: Product[] = [null, 150, 75].map((price, i) => ({ ...sample, id: String(i), price }));
    expect(sortSearchResults(products, 'price-asc').map((p) => p.price)).toEqual([75, 150, null]);
    expect(sortSearchResults(products, 'price-desc').map((p) => p.price)).toEqual([150, 75, null]);
  });

  test('category filters stay independent from search and other categories', () => {
    clearSearchFilterState('search');
    clearSearchFilterState('category:mens-shoes');
    clearSearchFilterState('category:womens-shoes');
    patchSearchFilterState({ filters: { ...EMPTY_SEARCH_FILTERS, gender: ['mens'] } }, 'category:mens-shoes');
    patchSearchFilterState({ sort: 'price-asc' }, 'category:womens-shoes');
    expect(getSearchFilterState('category:mens-shoes').filters.gender).toEqual(['mens']);
    expect(getSearchFilterState('category:mens-shoes').sort).toBe('recommended');
    expect(getSearchFilterState('category:womens-shoes').filters.gender).toEqual([]);
    expect(getSearchFilterState('search').filters.gender).toEqual([]);
  });
});

describe('search and combined filters', () => {
  test('offline search filters and sorts all matches, including matches after the old eight-row cut-off', () => {
    const rows = searchRows(catalog.products, null, 'ghost');
    expect(rows.length).toBeGreaterThan(8);
    const filters = { ...EMPTY_SEARCH_FILTERS, gender: ['womens'], colours: ['pink'] };
    const filtered = filterSearchRows(rows, filters, 'price-asc');
    const expected = sortSearchResults(applySearchFilters(rows.map((r) => r.local!), filters), 'price-asc');
    expect(filtered.map((r) => r.local)).toEqual(expected);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((r) => r.local?.gender === 'womens')).toBe(true);
    expect(searchRows(catalog.products, null, 'zz-no-such-shoe')).toEqual([]);
    expect(searchRows(catalog.products, null, ' g ')).toEqual([]);
  });

  test('live color filtering keeps matching colorways and their price all the way to a result row', () => {
    const p = catalog.products.find((p) => p.name === 'Adrenaline GTS 25' && p.gender === 'mens')!;
    const hit = { id: p.id, name: p.name, imageUrl: 'live.jpg' };
    const unknown = { id: 'not-in-snapshot', name: 'Unknown', imageUrl: 'unknown.jpg' };
    const rows = searchRows(catalog.products, [hit, hit, unknown], 'adrenaline');
    expect(rows.length).toBe(2);
    expect(filterSearchRows(rows, EMPTY_SEARCH_FILTERS, 'recommended')).toEqual(rows);
    const filtered = filterSearchRows(rows, { ...EMPTY_SEARCH_FILTERS, colours: ['pink'] }, 'recommended');
    expect(filtered.length).toBe(1);
    expect(filtered[0].local!.colors.every((c) => pink.words.test(c.name))).toBe(true);
    expect(filtered[0].local!.price).toBe(Math.min(...filtered[0].local!.colors.map((c) => c.price!)));
    expect(filterResultCount([p], 1, EMPTY_SEARCH_FILTERS, 'recommended')).toBe(rows.length);
    expect(filterResultCount([p], 1, { ...EMPTY_SEARCH_FILTERS, colours: ['pink'] }, 'recommended')).toBe(filtered.length);
    expect(filterResultCount([p], 1, EMPTY_SEARCH_FILTERS, 'price-asc')).toBe(1);
    expect(searchRows(catalog.products, [], 'ghost')).toEqual([]);
  });

  test('feature counts count styles once and the default panel stays bounded', () => {
    const facets = featureFacets(catalog.products, Infinity);
    expect(featureFacets(catalog.products)).toHaveLength(8);
    expect(new Set(facets.map((f) => f.value))).toEqual(new Set(catalog.products.flatMap((p) => p.features)));
    for (const f of facets) expect(f.count).toBe(catalog.products.filter((p) => p.features.includes(f.value)).length);
  });

  test('every color pair, gender, and rating combination returns exactly matching styles', () => {
    const before = JSON.stringify(catalog.products);
    const colors = [[], ...COLOUR_FAMILIES.map((f) => [f.key]), ...COLOUR_FAMILIES.flatMap((a, i) => COLOUR_FAMILIES.slice(i + 1).map((b) => [a.key, b.key]))];
    const genders = [[], ['mens'], ['womens'], ['unisex'], ['mens', 'womens']];
    const ratings = [undefined, 3, 4, 5];
    for (const colours of colors) for (const gender of genders) for (const minRating of ratings) {
      const result = applySearchFilters(catalog.products, { colours, gender, minRating, features: [] });
      const expected = catalog.products.filter((p) =>
        (!gender.length || (p.gender != null && gender.includes(p.gender))) &&
        (minRating == null || (p.rating != null && p.rating >= minRating)) &&
        (!colours.length || p.colors.some((c) => colours.some((key) => colourFamiliesOfColorway(c).has(key))))
      );
      expect(result.map((p) => p.id)).toEqual(expected.map((p) => p.id));
      if (colours.length) for (const p of result) expect(p.colors.every((c) => colours.some((key) => colourFamiliesOfColorway(c).has(key)))).toBe(true);
    }
    expect(JSON.stringify(catalog.products)).toBe(before);
  });

  test('features combine with AND, color/gender with OR, and every sort preserves membership', () => {
    const features = featureFacets(catalog.products).slice(0, 6).map((f) => f.value);
    for (const feature of features) for (const other of features) {
      const filters = { ...EMPTY_SEARCH_FILTERS, features: [feature, other], colours: ['white', 'black'], gender: ['mens', 'womens'], minRating: 4 };
      const result = applySearchFilters(catalog.products, filters);
      const expected = catalog.products.filter((p) => p.features.includes(feature) && p.features.includes(other) && p.rating != null && p.rating >= 4 && (p.gender === 'mens' || p.gender === 'womens') && p.colors.some((c) => /\b(white|black|ebony|nightshadow|obsidian|india ink|peacoat|blackened|jet|coconut|snow|oyster|cream|ivory|milk|chalk|cloud)\b/i.test(c.name)));
      expect(result.map((p) => p.id)).toEqual(expected.map((p) => p.id));
      for (const sort of SEARCH_SORTS) expect(sortSearchResults(result, sort.key).map((p) => p.id).sort()).toEqual(result.map((p) => p.id).sort());
    }
  });
});
