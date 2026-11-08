import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Receipt numbers (finance plan, batch 6): R-YYYY-NNNN per office and year
// from ReceiptSequence. A payment takes its number when it is collected, in
// the same transaction; an older collected payment without one takes it on
// its first print; a cancelled payment never takes one. The real handlers
// run against an in-memory office whose transactions hold row locks
// (SELECT ... FOR UPDATE) until they end, like Postgres, and whose reads
// and counter yield to other requests, so a missing lock would show as a
// race.

type Row = Record<string, any>;

const payments = new Map<string, Row>();
const sequence = new Map<string, number>();
let allocations = 0;
let nextId = 1;
const locks = new Map<string, Promise<void>>();
const tick = () => new Promise((resolve) => setImmediate(resolve));

function sequenceUpsert(tenantId: string, year: number) {
  const key = `${tenantId}:${year}`;
  const next = (sequence.get(key) ?? 1) + 1;
  sequence.set(key, next);
  allocations++;
  return next - 1;
}

function pick(row: Row, select?: Row) {
  if (!select) return { ...row };
  const out: Row = {};
  for (const key of Object.keys(select)) out[key] = row[key] ?? null;
  return out;
}

function withRelations(row: Row) {
  return {
    ...row,
    client: { id: "client-1", name: "Client", phone: "enc:0790000000", archivedAt: null },
    case: row.caseId ? { id: row.caseId, title: "Case", caseNumber: "12/2026" } : null,
    invoice: null,
    collectedBy: row.collectedById ? { id: row.collectedById, name: "Office admin" } : null,
    cancelledBy: null,
    tenant: { name: "Office", email: null, phone: null, address: null, logoUrl: null },
  };
}

function makeTx(held: Array<() => void>): Row {
  const tx: Row = {
    payment: {
      findFirst: async ({ where, select }: Row) => {
        await tick();
        const row = payments.get(where.id ?? where.AND?.find?.((w: Row) => w.id)?.id);
        return row ? pick(row, select) : null;
      },
      findUniqueOrThrow: async ({ where }: Row) => withRelations(payments.get(where.id)!),
      create: async ({ data }: Row) => {
        const row = { ...data, id: `pay-${nextId++}`, createdAt: new Date() };
        payments.set(row.id, row);
        return withRelations(row);
      },
      update: async ({ where, data }: Row) => {
        await tick();
        const row = payments.get(where.id)!;
        Object.assign(row, data);
        return withRelations(row);
      },
    },
    case: { findFirst: async () => ({ id: "case-1", title: "Case", clientId: "client-1", client: { id: "client-1", archivedAt: null } }) },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes('INSERT INTO "ReceiptSequence"')) {
        await tick();
        return [{ sequenceNumber: sequenceUpsert(String(values[0]), Number(values[1])) }];
      }
      if (sql.includes("FOR UPDATE")) {
        const id = String(values[0]);
        while (locks.has(id)) await locks.get(id);
        let release!: () => void;
        locks.set(id, new Promise<void>((resolve) => (release = resolve)));
        held.push(() => {
          locks.delete(id);
          release();
        });
        return payments.has(id) ? [{ id }] : [];
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
  };
  return tx;
}

const db: Row = {
  $transaction: async (fn: (tx: Row) => unknown) => {
    const held: Array<() => void> = [];
    try {
      return await fn(makeTx(held));
    } finally {
      for (const release of held) release();
    }
  },
};

mock.module("@/lib/prisma", { namedExports: { prisma: db } });
mock.module("@/lib/api-auth", {
  namedExports: {
    requirePermission: async () => ({ error: null, user: { userId: "user-1", tenantId: "tenant-1", role: "ADMIN" } }),
    getRequestMeta: () => ({ ipAddress: null, userAgent: null }),
  },
});
mock.module("@/lib/csrf", { namedExports: { verifySameOrigin: () => null } });
mock.module("@/lib/activity", { namedExports: { logActivity: async () => undefined } });
mock.module("@/lib/billing-limits", { namedExports: { assertTenantCanWrite: async () => ({ ok: true }) } });
mock.module("@/lib/encryption", {
  namedExports: {
    decryptText: (value: unknown) => (typeof value === "string" ? value.replace(/^enc:/, "") : value),
    encryptText: (value: unknown) => value,
  },
});
mock.module("@/lib/server/case-finance-integrity", {
  namedExports: { assertCaseCanAcceptAmount: async () => undefined, isCaseFinancialLimitError: () => false },
});

type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let CREATE: (req: NextRequest) => Promise<Response>;
let PATCH: Handler;
let RECEIPT: Handler;

before(async () => {
  ({ POST: CREATE } = await import("../../src/app/api/payments/route"));
  ({ PATCH } = await import("../../src/app/api/payments/[id]/route"));
  ({ POST: RECEIPT } = await import("../../src/app/api/payments/[id]/receipt/route"));
});

beforeEach(() => {
  payments.clear();
  sequence.clear();
  allocations = 0;
});

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/payments", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const year = Number(
  new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric" }).format(new Date()),
);
const no = (n: number) => `R-${year}-${String(n).padStart(4, "0")}`;

async function create(status: "PAID" | "PENDING") {
  const response = await CREATE(req("POST", { caseId: "case-1", amount: 250.5, method: "CASH", status }));
  assert.equal(response.status, 201);
  return ((await response.json()) as { data: Row }).data;
}

async function receipt(id: string) {
  const response = await RECEIPT(req("POST"), ctx(id));
  return { status: response.status, body: (await response.json()) as Row };
}

function seed(row: Row) {
  const full = { id: `pay-${nextId++}`, tenantId: "tenant-1", clientId: "client-1", caseId: "case-1", invoiceId: null, amount: 100, method: "CASH", reference: null, notes: null, paidAt: new Date("2026-10-01T08:00:00Z"), receiptNumber: null, collectedById: null, cancelledAt: null, cancelledById: null, cancellationReason: null, ...row };
  payments.set(full.id, full);
  return full;
}

test("a payment collected at creation takes the next number and its collector", async () => {
  const first = await create("PAID");
  const second = await create("PAID");
  assert.equal(first.receiptNumber, no(1));
  assert.equal(second.receiptNumber, no(2));
  assert.equal(first.collectedById, "user-1");
});

test("a pending payment has no number until it is collected", async () => {
  const pending = await create("PENDING");
  assert.equal(pending.receiptNumber ?? null, null);
  assert.equal(allocations, 0);

  const refused = await receipt(pending.id);
  assert.equal(refused.status, 409);
  assert.equal(allocations, 0);

  const response = await PATCH(req("PATCH", { status: "PAID" }), ctx(pending.id));
  assert.equal(response.status, 200);
  const collected = ((await response.json()) as { data: Row }).data;
  assert.equal(collected.receiptNumber, no(1));
  assert.equal(collected.collectedById, "user-1");
});

test("cancelling a collected payment keeps its number", async () => {
  const paid = await create("PAID");
  const response = await PATCH(req("PATCH", { status: "CANCELLED", cancellationReason: "Entered twice" }), ctx(paid.id));
  assert.equal(response.status, 200);
  const cancelled = ((await response.json()) as { data: Row }).data;
  assert.equal(cancelled.receiptNumber, no(1));
  assert.equal(allocations, 1);

  const printed = await receipt(paid.id);
  assert.equal(printed.status, 200);
  assert.equal(printed.body.data.receiptNumber, no(1));
  assert.equal(printed.body.data.status, "CANCELLED");
  assert.equal(allocations, 1);
});

test("an older collected payment takes a number on its first print, and keeps it", async () => {
  const old = seed({ status: "PAID" });
  const first = await receipt(old.id);
  assert.equal(first.status, 200);
  assert.equal(first.body.data.receiptNumber, no(1));
  assert.equal(first.body.data.client.phone, "0790000000"); // decrypted
  assert.equal(first.body.data.collectedBy, null); // unknown before 2026-11-08

  const again = await receipt(old.id);
  assert.equal(again.body.data.receiptNumber, no(1));
  assert.equal(allocations, 1);
});

test("two prints at the same time of an unnumbered payment give one number", async () => {
  const old = seed({ status: "PAID" });
  const other = seed({ status: "PAID" });

  const results = await Promise.all([receipt(old.id), receipt(old.id), receipt(old.id)]);
  for (const result of results) {
    assert.equal(result.status, 200);
    assert.equal(result.body.data.receiptNumber, no(1));
  }
  assert.equal(allocations, 1);

  // The counter did not skip: the next payment gets 2.
  const next = await receipt(other.id);
  assert.equal(next.body.data.receiptNumber, no(2));
});

test("a cancelled payment without a number is printed without one", async () => {
  const cancelled = seed({ status: "CANCELLED", paidAt: null, cancelledAt: new Date(), cancellationReason: "Client withdrew" });
  const printed = await receipt(cancelled.id);
  assert.equal(printed.status, 200);
  assert.equal(printed.body.data.receiptNumber, null);
  assert.equal(printed.body.data.cancellationReason, "Client withdrew");
  assert.equal(allocations, 0);
});

test("an unknown payment is 404", async () => {
  const missing = await receipt("nope");
  assert.equal(missing.status, 404);
});
