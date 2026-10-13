/**
 * Filter and sort vocabulary for search results.
 *
 * @ref LLP 0002#facets — The website's `Filter & sort` panel offers, on a
 * shoes listing: a sort list (Recommended for you, New Arrivals, Price high to
 * low / low to high, Best Sellers, Customer Top Rated), then Colour, Rating,
 * and Features. The snapshot carries no colour-family facet of its own — Brooks
 * names colourways ("Black/Cyber Pink/Iced Aqua") — so the family is derived
 * from the name's words here, once, rather than hand-tagged per product.
 *
 * Pure: no React or platform import, like `query.ts`.
 */
import type { Colorway, Product } from './types';

export type SearchSort =
  | 'recommended'
  | 'new-arrivals'
  | 'price-desc'
  | 'price-asc'
  | 'best-sellers'
  | 'top-rated';

/** In the site's own order. */
export const SEARCH_SORTS: { key: SearchSort; label: string }[] = [
  { key: 'recommended', label: 'Recommended for you' },
  { key: 'new-arrivals', label: 'New Arrivals' },
  { key: 'price-desc', label: 'Price (High to Low)' },
  { key: 'price-asc', label: 'Price (Low to High)' },
  { key: 'best-sellers', label: 'Best Sellers' },
  { key: 'top-rated', label: 'Customer Top Rated' },
];

export interface SearchFilters {
  /** Colour family keys, any-of. */
  colours: string[];
  /** 5 → exactly five stars; 4 or 3 → "and up". */
  minRating?: number;
  /** Feature strings as the catalog spells them, all-of. */
  features: string[];
  /** Gender keys, any-of. */
  gender: string[];
}

export const EMPTY_SEARCH_FILTERS: SearchFilters = { colours: [], features: [], gender: [] };

export function countSearchFilters(f: SearchFilters): number {
  return f.colours.length + f.features.length + f.gender.length + (f.minRating ? 1 : 0);
}

/**
 * The site's colour families, in its grid order, with the words Brooks uses in
 * colourway names that fall into each. Swatch values are [inferred] from the
 * site's panel, which is behind Akamai (LLP 0002) and cannot be read by a client.
 */
export const COLOUR_FAMILIES: { key: string; label: string; swatch: string; words: RegExp }[] = [
  { key: 'black', label: 'Black', swatch: '#000000', words: /\b(black|ebony|nightshadow|obsidian|india ink|peacoat|blackened|jet)\b/i },
  { key: 'blue', label: 'Blue', swatch: '#0F6BFF', words: /\b(blue|navy|aqua|aquarius|breeze|dazzling|cobalt|denim|indigo|sky|marine|azure|nantucket)\b/i },
  { key: 'white', label: 'White', swatch: '#FFFFFF', words: /\b(white|coconut|snow|oyster|cream|ivory|milk|chalk|cloud)\b/i },
  { key: 'grey', label: 'Grey', swatch: '#8A8A8A', words: /\b(grey|gray|smoke|primer|chrome|silver|stone|pearl|alloy|steel|ash|charcoal|heather|slate)\b/i },
  { key: 'brown', label: 'Brown', swatch: '#6B4A2E', words: /\b(brown|biscuit|sand|raffia|bronze|tan|mocha|chestnut|taupe|clay|khaki|cocoa)\b/i },
  { key: 'yellow', label: 'Yellow', swatch: '#F5C518', words: /\b(yellow|lime|gold|canary|citrus|sunny|lemon|mustard)\b/i },
  { key: 'green', label: 'Green', swatch: '#0B9A5B', words: /\b(green|olive|moss|forest|mint|sage|jade|emerald|pine)\b/i },
  { key: 'red', label: 'Red', swatch: '#D01B1B', words: /\b(red|crimson|scarlet|cherry|blazing|fire|brick|ruby)\b/i },
  { key: 'orange', label: 'Orange', swatch: '#F26B1F', words: /\b(orange|coral|peach|apricot|tangerine|mango|copper|rust|papaya)\b/i },
  { key: 'teal', label: 'Teal', swatch: '#0E8B8B', words: /\b(teal|turquoise|lagoon|iced aqua)\b/i },
  { key: 'pink', label: 'Pink', swatch: '#F53FA6', words: /\b(pink|rose|blush|fuchsia|magenta|spellbound|flamingo)\b/i },
  { key: 'multi', label: 'Multi', swatch: 'multi', words: /$^/ },
  { key: 'purple', label: 'Purple', swatch: '#8033B8', words: /\b(purple|grape|lilac|violet|plum|lavender|mauve|amethyst)\b/i },
];

/** A colourway with three or more families is what the site files under Multi. */
const MULTI_AT = 3;

export function colourFamiliesOfColorway(c: Colorway): Set<string> {
  const families = COLOUR_FAMILIES.filter((f) => f.key !== 'multi' && f.words.test(c.name));
  const out = new Set(families.map((f) => f.key));
  if (families.length >= MULTI_AT) out.add('multi');
  return out;
}

export function colourFamiliesOf(p: Product): Set<string> {
  const out = new Set<string>();
  for (const c of p.colors) {
    for (const family of colourFamiliesOfColorway(c)) out.add(family);
  }
  return out;
}

export function applySearchFilters(products: Product[], f: SearchFilters): Product[] {
  const out: Product[] = [];
  for (const p of products) {
    if (f.gender.length && !(p.gender && f.gender.includes(p.gender))) continue;
    if (f.minRating && (p.rating == null || p.rating < f.minRating)) continue;
    if (f.features.length && !f.features.every((x) => p.features.includes(x))) continue;
    if (f.colours.length) {
      // @ref LLP 0003#filter-correctness — Matching styles must also show matching colorways.
      const colors = p.colors.filter((c) => {
        const families = colourFamiliesOfColorway(c);
        return f.colours.some((key) => families.has(key));
      });
      if (!colors.length) continue;
      const cheapest = colors.reduce((a, b) => (b.price ?? Infinity) < (a.price ?? Infinity) ? b : a);
      out.push({
        ...p, colors, price: cheapest.price, listPrice: cheapest.listPrice,
        onSale: colors.some((c) => c.price != null && c.listPrice != null && c.price < c.listPrice),
      });
    } else {
      out.push(p);
    }
  }
  return out;
}

/** `recommended` keeps the order the live index returned. */
export function sortSearchResults(products: Product[], key: SearchSort): Product[] {
  const out = [...products];
  switch (key) {
    case 'price-asc':
      return out.sort((a, b) => comparePrice(a.price, b.price, 1));
    case 'price-desc':
      return out.sort((a, b) => comparePrice(a.price, b.price, -1));
    case 'top-rated':
      return out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case 'best-sellers':
      return out.sort(
        (a, b) =>
          Number(b.badge === 'Best Seller') - Number(a.badge === 'Best Seller') ||
          b.reviewCount - a.reviewCount
      );
    case 'new-arrivals':
      return out.sort(
        (a, b) =>
          Number(b.badge === 'New Style' || b.badge === 'New Color') -
          Number(a.badge === 'New Style' || a.badge === 'New Color')
      );
    default:
      return out;
  }
}

function comparePrice(a: number | null, b: number | null, direction: number): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return (a - b) * direction;
}

/** The features actually present in a result set, most common first. */
export function featureFacets(products: Product[], limit = 8): { value: string; count: number }[] {
  const m = new Map<string, number>();
  for (const p of products) for (const x of new Set(p.features)) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}
