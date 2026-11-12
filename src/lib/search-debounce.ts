/** How long a search box waits after the last keystroke before it loads. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The delay before a search-driven load. Only typed text is debounced: with
 * an empty query (a page or picker opening, or the box just cleared) the
 * load starts at once.
 */
export function searchDebounceMs(query: string): number {
  return query.trim() ? SEARCH_DEBOUNCE_MS : 0;
}
