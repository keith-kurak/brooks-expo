import { useSyncExternalStore } from 'react';

import { EMPTY_SEARCH_FILTERS, type SearchFilters, type SearchSort } from '@/data/search-query';
import type { Product } from '@/data/types';

/**
 * Applied filters and sort per listing, shared with the form sheet that edits it.
 *
 * A store rather than route params because the sheet is a separate route: the
 * native form sheet is presented by the root stack, so it cannot be a child of
 * Browse and cannot take a callback prop. The sheet writes here on Apply;
 * Browse re-derives its results from the same value.
 */

type State = {
  sort: SearchSort;
  filters: SearchFilters;
  /** The unfiltered, snapshot-joined products of the current search — what the sheet counts. */
  candidates: Product[];
  unmatchedCount: number;
};

// @ref LLP 0003#filter-correctness — Category, franchise, and search state stay independent.
export const SEARCH_FILTER_SCOPE = 'search';
const states = new Map<string, State>();
let activeScope = SEARCH_FILTER_SCOPE;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getSearchFilterState(scope = activeScope): State {
  let state = states.get(scope);
  if (!state) {
    state = { sort: 'recommended', filters: EMPTY_SEARCH_FILTERS, candidates: [], unmatchedCount: 0 };
    states.set(scope, state);
  }
  return state;
}

export function patchSearchFilterState(patch: Partial<State>, scope = activeScope) {
  states.set(scope, { ...getSearchFilterState(scope), ...patch });
  emit();
}

export function getActiveSearchFilterScope() {
  return activeScope;
}

export function activateSearchFilters(scope: string, candidates: Product[], unmatchedCount = 0) {
  activeScope = scope;
  patchSearchFilterState({ candidates, unmatchedCount }, scope);
}

export function clearSearchFilterState(scope = activeScope) {
  patchSearchFilterState({ sort: 'recommended', filters: EMPTY_SEARCH_FILTERS }, scope);
}

export function useSearchFilterState(scope = activeScope): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => getSearchFilterState(scope),
    () => getSearchFilterState(scope)
  );
}
