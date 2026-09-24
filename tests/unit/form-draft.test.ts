import assert from "node:assert/strict";
import test from "node:test";
import {
  FORM_DRAFT_MAX_AGE_MS,
  clearAllDrafts,
  draftStorageKey,
  purgeDrafts,
  readDraft,
  stripSensitiveFields,
  writeDraft,
  type DraftStorage,
} from "../../src/lib/form-draft";

function memoryStorage(): DraftStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();

  return {
    map,
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

const nowMs = Date.parse("2026-09-24T12:00:00.000Z");
const key = draftStorageKey("user-a", "case-create");

test("a draft round-trips through storage", () => {
  const storage = memoryStorage();
  writeDraft(storage, key, { title: "Contract dispute", notes: "Call" }, nowMs);

  assert.deepEqual(readDraft(storage, key, nowMs), {
    title: "Contract dispute",
    notes: "Call",
  });
});

test("drafts expire after 24 hours even if never cleared", () => {
  const storage = memoryStorage();
  writeDraft(storage, key, { title: "x" }, nowMs);

  assert.deepEqual(
    readDraft(storage, key, nowMs + FORM_DRAFT_MAX_AGE_MS),
    { title: "x" },
  );
  assert.equal(readDraft(storage, key, nowMs + FORM_DRAFT_MAX_AGE_MS + 1), null);
  assert.equal(storage.map.has(key), false, "expired draft is removed");
});

test("sensitive fields are never persisted", () => {
  const stripped = stripSensitiveFields({
    name: "Ahmad",
    password: "hunter2",
    newPassword: "x",
    cardNumber: "4111",
    iban: "JO00",
    otpCode: "123456",
  });

  assert.deepEqual(stripped, { name: "Ahmad" });

  const storage = memoryStorage();
  writeDraft(storage, key, { name: "Ahmad", password: "hunter2" }, nowMs);
  assert.equal(storage.map.get(key)?.includes("hunter2"), false);
});

test("corrupted or unknown-version drafts are discarded", () => {
  const storage = memoryStorage();

  storage.setItem(key, "{not json");
  assert.equal(readDraft(storage, key, nowMs), null);
  assert.equal(storage.map.has(key), false);

  storage.setItem(key, JSON.stringify({ v: 99, savedAt: nowMs, data: {} }));
  assert.equal(readDraft(storage, key, nowMs), null);
});

test("purge removes other users' drafts and expired own drafts", () => {
  const storage = memoryStorage();
  const otherUserKey = draftStorageKey("user-b", "case-create");
  const staleOwnKey = draftStorageKey("user-a", "task-create");

  writeDraft(storage, key, { title: "mine" }, nowMs);
  writeDraft(storage, otherUserKey, { title: "theirs" }, nowMs);
  writeDraft(storage, staleOwnKey, { title: "old" }, nowMs - FORM_DRAFT_MAX_AGE_MS - 1);
  storage.setItem("unrelated", "keep");

  purgeDrafts(storage, "user-a", nowMs);

  assert.equal(storage.map.has(key), true);
  assert.equal(storage.map.has(otherUserKey), false);
  assert.equal(storage.map.has(staleOwnKey), false);
  assert.equal(storage.map.get("unrelated"), "keep");
});

test("clearing all drafts leaves unrelated keys alone", () => {
  const storage = memoryStorage();
  writeDraft(storage, key, { title: "a" }, nowMs);
  writeDraft(storage, draftStorageKey("user-b", "x"), { title: "b" }, nowMs);
  storage.setItem("theme", "dark");

  clearAllDrafts(storage);

  assert.deepEqual([...storage.map.keys()], ["theme"]);
});
