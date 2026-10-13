import type { SearchHit } from './constructor';
import { applySearchFilters, countSearchFilters, sortSearchResults, type SearchFilters, type SearchSort } from './search-query';
import type { Product } from './types';

export type SearchRow = { hit: SearchHit; local: Product | undefined };

/** Null hits means offline. An empty live response is a genuine no-match result. */
export function searchRows(products: Product[], hits: SearchHit[] | null, query: string): SearchRow[] {
  if (query.trim().length < 2) return [];
  if (hits != null) {
    const byId = new Map(products.map((p) => [p.id, p]));
    const seen = new Set<string>();
    return hits.filter((hit) => {
      if (seen.has(hit.id)) return false;
      seen.add(hit.id);
      return true;
    })
      .map((hit) => ({ hit, local: byId.get(hit.id) }));
  }
  const q = query.trim().toLowerCase();
  // @ref LLP 0003#filter-correctness — Filter the complete offline match set before rendering.
  return products.filter((p) => p.name.toLowerCase().includes(q) || (p.franchise ?? '').toLowerCase().includes(q))
    .map((local) => ({
      local,
      hit: { id: local.id, name: local.name, imageUrl: '', gender: local.gender ?? undefined, cushion: local.cushion ?? undefined },
    }));
}

/** Live-only rows remain visible only in the unfiltered, recommended view. */
export function filterResultCount(candidates: Product[], unmatchedCount: number, filters: SearchFilters, sort: SearchSort): number {
  return applySearchFilters(candidates, filters).length +
    (countSearchFilters(filters) === 0 && sort === 'recommended' ? unmatchedCount : 0);
}

export function filterSearchRows(rows: SearchRow[], filters: SearchFilters, sort: SearchSort): SearchRow[] {
  if (countSearchFilters(filters) === 0 && sort === 'recommended') return rows;
  const locals = rows.flatMap((row) => row.local ? [row.local] : []);
  const hits = new Map(rows.map((row) => [row.hit.id, row.hit]));
  return sortSearchResults(applySearchFilters(locals, filters), sort)
    .map((local) => ({ local, hit: hits.get(local.id)! }));
}
