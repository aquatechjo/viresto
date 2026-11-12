import { test } from "node:test";
import assert from "node:assert/strict";
import { SEARCH_DEBOUNCE_MS, searchDebounceMs } from "../../src/lib/search-debounce";

test("an empty or blank query loads at once (page or picker opening, box cleared)", () => {
  assert.equal(searchDebounceMs(""), 0);
  assert.equal(searchDebounceMs("   "), 0);
});

test("typed text is debounced", () => {
  assert.equal(searchDebounceMs("أحمد"), SEARCH_DEBOUNCE_MS);
  assert.equal(searchDebounceMs(" 079 "), SEARCH_DEBOUNCE_MS);
  assert.equal(SEARCH_DEBOUNCE_MS, 300);
});
