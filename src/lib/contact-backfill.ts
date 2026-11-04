// Pure logic of scripts/backfill-search-hashes.ts: for one client row, what
// its contact fields and search hashes must become so that the stored value,
// its hash and today's normalization (phone E.164, national ID digits,
// email lower case) all agree, and every value is encrypted with the active
// key. No database or key access here: the script passes them in, the tests
// pass fakes.

import { normalizeEmail } from "@/lib/encryption";
import { normalizeNationalId } from "@/lib/digits";
import { normalizePhone } from "@/lib/phone";

export type ContactRow = {
  id: string;
  publicId: number;
  tenantId: string;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  address: string | null;
  notes: string | null;
  phoneHash: string | null;
  emailHash: string | null;
  nationalIdHash: string | null;
  updatedAt: Date;
};

/** The only columns the backfill writes (updatedAt is written back as read). */
export type WritableColumn =
  | "phone" | "email" | "nationalId" | "address" | "notes"
  | "phoneHash" | "emailHash" | "nationalIdHash";
export type RowData = Partial<Record<WritableColumn, string | null>>;

export type BackfillCrypto = {
  decrypt: (value: string) => string;
  encrypt: (value: string) => string;
  hash: (value: string) => string;
  /** Key id of a stored value, "legacy", or null when it is plain text. */
  keyIdOf: (value: string) => string | null;
  activeKeyId: string;
};

export const SEARCH_FIELDS = ["phone", "email", "nationalId"] as const;
export type SearchField = (typeof SEARCH_FIELDS)[number];
const HASH_OF = {
  phone: "phoneHash",
  email: "emailHash",
  nationalId: "nationalIdHash",
} as const satisfies Record<SearchField, WritableColumn>;

const NORMALIZE: Record<SearchField, (value: string) => string | null> = {
  phone: normalizePhone,
  email: (value) => normalizeEmail(value) || null,
  nationalId: normalizeNationalId,
};

const OTHER_ENCRYPTED = ["address", "notes"] as const;

export type FieldOutcome = {
  /** The stored text changes (a new normalized form). */
  reformatted: boolean;
  /** The ciphertext is rewritten (new form, older key, or plain text). */
  reencrypted: boolean;
  hashChanged: boolean;
  /** A value that does not normalize (kept as is, hash cleared). */
  invalid: boolean;
};

export type RowPlan =
  | { kind: "unreadable"; id: string; publicId: number; field: string; error: string }
  | {
      kind: "ok";
      id: string;
      publicId: number;
      tenantId: string;
      updatedAt: Date;
      /** The columns to write; empty when the row is already right. */
      data: RowData;
      fields: Record<SearchField, FieldOutcome>;
      /** The hashes the row will have, for the duplicate check. */
      hashes: Record<SearchField, string | null>;
    };

function needsNewCiphertext(stored: string, crypto: BackfillCrypto) {
  return crypto.keyIdOf(stored) !== crypto.activeKeyId;
}

export function planContactRow(row: ContactRow, crypto: BackfillCrypto): RowPlan {
  const data: RowData = {};
  const fields = {} as Record<SearchField, FieldOutcome>;
  const hashes = {} as Record<SearchField, string | null>;

  for (const field of SEARCH_FIELDS) {
    const stored = row[field];
    const outcome: FieldOutcome = {
      reformatted: false,
      reencrypted: false,
      hashChanged: false,
      invalid: false,
    };

    let plain = "";
    if (stored) {
      try {
        plain = crypto.decrypt(stored);
      } catch (error) {
        return {
          kind: "unreadable",
          id: row.id,
          publicId: row.publicId,
          field,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const canonical = plain.trim() ? NORMALIZE[field](plain) : null;
    outcome.invalid = Boolean(plain.trim()) && canonical === null;

    if (canonical !== null && canonical !== plain) {
      outcome.reformatted = true;
      outcome.reencrypted = true;
      data[field] = crypto.encrypt(canonical);
    } else if (stored && plain && needsNewCiphertext(stored, crypto)) {
      outcome.reencrypted = true;
      data[field] = crypto.encrypt(plain);
    }

    const hash = canonical !== null ? crypto.hash(canonical) : null;
    hashes[field] = hash;
    if (hash !== row[HASH_OF[field]]) {
      outcome.hashChanged = true;
      data[HASH_OF[field]] = hash;
    }

    fields[field] = outcome;
  }

  // Not searchable, but encrypted with the same keys: rotate them too.
  for (const field of OTHER_ENCRYPTED) {
    const stored = row[field];
    if (!stored || !needsNewCiphertext(stored, crypto)) continue;
    let plain: string;
    try {
      plain = crypto.decrypt(stored);
    } catch (error) {
      return {
        kind: "unreadable",
        id: row.id,
        publicId: row.publicId,
        field,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    if (plain) data[field] = crypto.encrypt(plain);
  }

  return {
    kind: "ok",
    id: row.id,
    publicId: row.publicId,
    tenantId: row.tenantId,
    updatedAt: row.updatedAt,
    data,
    fields,
    hashes,
  };
}

export type BackfillSummary = {
  rows: number;
  toUpdate: number;
  unchanged: number;
  unreadable: Array<{ publicId: number; field: string; error: string }>;
  perField: Record<SearchField, { reformatted: number; reencrypted: number; hashChanged: number; invalid: number }>;
  /** Clients of one office that would share a phone, email or national ID. */
  collisions: Array<{ tenantId: string; field: SearchField; publicIds: number[] }>;
};

export function summarizePlans(plans: RowPlan[]): BackfillSummary {
  const perField = Object.fromEntries(
    SEARCH_FIELDS.map((field) => [
      field,
      { reformatted: 0, reencrypted: 0, hashChanged: 0, invalid: 0 },
    ]),
  ) as BackfillSummary["perField"];
  const unreadable: BackfillSummary["unreadable"] = [];
  const groups = new Map<string, { tenantId: string; field: SearchField; publicIds: number[] }>();
  let toUpdate = 0;

  for (const plan of plans) {
    if (plan.kind === "unreadable") {
      unreadable.push({ publicId: plan.publicId, field: plan.field, error: plan.error });
      continue;
    }
    if (Object.keys(plan.data).length > 0) toUpdate += 1;

    for (const field of SEARCH_FIELDS) {
      const outcome = plan.fields[field];
      const counts = perField[field];
      if (outcome.reformatted) counts.reformatted += 1;
      if (outcome.reencrypted) counts.reencrypted += 1;
      if (outcome.hashChanged) counts.hashChanged += 1;
      if (outcome.invalid) counts.invalid += 1;

      const hash = plan.hashes[field];
      if (!hash) continue;
      const key = `${plan.tenantId}\u0000${field}\u0000${hash}`;
      const group = groups.get(key) ?? { tenantId: plan.tenantId, field, publicIds: [] };
      group.publicIds.push(plan.publicId);
      groups.set(key, group);
    }
  }

  return {
    rows: plans.length,
    toUpdate,
    unchanged: plans.length - unreadable.length - toUpdate,
    unreadable,
    perField,
    collisions: [...groups.values()]
      .filter((group) => group.publicIds.length > 1)
      .map((group) => ({ ...group, publicIds: group.publicIds.sort((a, b) => a - b) })),
  };
}

/** The Neon endpoint id ("ep-...") of a connection URL, or its host. */
export function databaseEndpointOf(url: string | undefined) {
  try {
    const host = new URL(url ?? "").hostname;
    const match = host.match(/^(ep-[a-z0-9-]+?)(-pooler)?\./);
    return match ? match[1] : host || null;
  } catch {
    return null;
  }
}
