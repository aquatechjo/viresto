// Pure helpers behind useFormDraft. Kept free of React/DOM so they can be
// unit-tested against a fake Storage.

export const FORM_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Dispatched on window by SessionGuard right before an idle logout
 * redirects, so open forms can persist their input synchronously.
 */
export const SESSION_EXPIRING_EVENT = "viresto:session-expiring";

const DRAFT_PREFIX = "viresto:draft:";
const DRAFT_VERSION = 1;

// Never persisted, whatever form they appear in.
const SENSITIVE_FIELD = /pass(word)?|secret|token|otp|cvv|cvc|card|iban/i;

export type DraftStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

type StoredDraft = {
  v: number;
  savedAt: number;
  data: unknown;
};

export function draftStorageKey(userId: string, formKey: string) {
  return `${DRAFT_PREFIX}${userId}:${formKey}`;
}

function draftKeys(storage: DraftStorage) {
  const keys: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
  }

  return keys;
}

export function stripSensitiveFields<T>(data: T): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;

  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(
      ([field]) => !SENSITIVE_FIELD.test(field),
    ),
  ) as T;
}

export function writeDraft(
  storage: DraftStorage,
  key: string,
  data: unknown,
  nowMs = Date.now(),
) {
  const payload: StoredDraft = {
    v: DRAFT_VERSION,
    savedAt: nowMs,
    data: stripSensitiveFields(data),
  };

  try {
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled: drafts are best-effort.
  }
}

export function readDraft<T>(
  storage: DraftStorage,
  key: string,
  nowMs = Date.now(),
): T | null {
  let raw: string | null = null;

  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredDraft;

    if (
      parsed?.v !== DRAFT_VERSION ||
      typeof parsed.savedAt !== "number" ||
      nowMs - parsed.savedAt > FORM_DRAFT_MAX_AGE_MS ||
      parsed.savedAt > nowMs + 60_000
    ) {
      storage.removeItem(key);
      return null;
    }

    return parsed.data as T;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function removeDraft(storage: DraftStorage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Removes every draft (manual logout). */
export function clearAllDrafts(storage: DraftStorage) {
  try {
    for (const key of draftKeys(storage)) storage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Removes drafts that are expired or belong to another user, so a
 * different account signing in on the same tab can never read them.
 */
export function purgeDrafts(
  storage: DraftStorage,
  currentUserId: string,
  nowMs = Date.now(),
) {
  try {
    const ownPrefix = `${DRAFT_PREFIX}${currentUserId}:`;

    for (const key of draftKeys(storage)) {
      if (!key.startsWith(ownPrefix)) {
        storage.removeItem(key);
      } else {
        readDraft(storage, key, nowMs);
      }
    }
  } catch {
    // ignore
  }
}
