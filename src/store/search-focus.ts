/**
 * A one-shot request for Browse to open its keyboard on arrival.
 *
 * Home's header search glyph and the PLP's search button both mean "take me to
 * search, ready to type". They are not the search screen, so they cannot focus
 * its field themselves — they can only navigate and leave a note.
 *
 * [confirmed 2026-08-26] That note used to be a `focus=1` route param that
 * Browse cleared with `router.setParams({ focus: '' })` once consumed. The
 * clear is a no-op: the render immediately after it still reads `focus = "1"`,
 * proved with a render-body probe read back through Metro's CDP log. So the
 * param stayed `"1"` for the life of the route, and the *second* press of the
 * glyph changed nothing — `useLocalSearchParams` returned the same value, the
 * effect never re-ran, and the glyph navigated without opening the keyboard.
 * The first press worked, which is what made this look like a timing bug.
 *
 * A param that must be cleared to be re-sent is the wrong shape for a
 * fire-once intent. This is a plain signal instead: it carries no value to go
 * stale, consuming it is local and synchronous, and it never reaches the URL.
 * Same pattern as `store/search-filters` — a module store is how this app hands
 * state between a route and a screen it cannot parent.
 */

let pending = false;

/**
 * Ask Browse for the keyboard. Call this *before* navigating there, so the note
 * is already waiting however Browse arrives — freshly mounted by a tab switch,
 * or merely re-focused when a pushed screen pops off its stack.
 *
 * No subscription: Browse reads this when it gains navigation focus, which
 * every caller's navigation causes anyway.
 */
export function requestSearchFocus(origin?: string) {
  pending = true;
  searchOrigin = origin;
}

/**
 * The route the glyph was pressed on, so closing search can return there. Only
 * set when search was opened from outside Browse; Browse clears it when it loses
 * focus, so a later visit to Browse does not bounce the user back.
 */
let searchOrigin: string | undefined;

export function getSearchOrigin() {
  return searchOrigin;
}

export function clearSearchOrigin() {
  searchOrigin = undefined;
}

/**
 * Take the pending request, if there is one. Returns whether there was.
 * Consuming is what makes it one-shot: an ordinary back-navigation onto Browse
 * later must not re-open the keyboard.
 */
export function consumeSearchFocus(): boolean {
  if (!pending) return false;
  pending = false;
  return true;
}
