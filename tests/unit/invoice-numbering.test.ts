import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Issued invoice numbers have no gaps: a draft takes no number, and takes
// the next one only when it is issued (decision of 2026-11-07). The real
// create, issue and delete handlers run against an in-memory office with a
// real per-year counter standing in for InvoiceSequence.

type Row = Record<string, any>;

const invoices = new Map<string, Row>();
const sequence = new Map<string, number>(); // `${tenantId}:${year}` -> nextNumber
let nextId = 1;
let targetId = "";

function sequenceUpsert(tenantId: string, year: number) {
  const key = `${tenantId}:${year}`;
  const next = (sequence.get(key) ?? 1) + 1;
  sequence.set(key, next);
  return next - 1;
}

const db: Row = {
  invoice: {
    create: async ({ data }: Row) => {
      const row = { ...data, id: `inv-${nextId++}`, issueDate: new Date("2026-11-01"), updatedAt: new Date(), payments: [], items: [], client: { archivedAt: null }, case: null };
      invoices.set(row.id, row);
      return { ...row };
    },
    findFirst: async () => {
      const row = invoices.get(targetId);
      return row ? { ...row } : null;
    },
    findUnique: async ({ where }: Row) => {
      const row = invoices.get(where.id);
      return row ? { ...row } : null;
    },
    // The routes read the saved invoice back after their transaction.
    findUniqueOrThrow: async ({ where }: Row) => {
      const row = invoices.get(where.id);
      if (!row) throw new Error("No Invoice found");
      return { ...row };
    },
    update: async ({ where, data }: Row) => {
      const row = invoices.get(where.id)!;
      Object.assign(row, data, { updatedAt: new Date(row.updatedAt.getTime() + 1) });
      return { ...row };
    },
    delete: async ({ where }: Row) => {
      invoices.delete(where.id);
      return {};
    },
  },
  client: { findFirst: async () => ({ id: "client-1", publicId: 1, name: "c", archivedAt: null }) },
  case: { findFirst: async () => null },
  payment: { count: async () => 0 },
  $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join("?");
    if (sql.includes('INSERT INTO "InvoiceSequence"')) {
      return [{ sequenceNumber: sequenceUpsert(String(values[0]), Number(values[1])) }];
    }
    return [{ id: targetId }]; // the FOR UPDATE lock
  },
  $transaction: async (fn: (tx: Row) => unknown) => fn(db),
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
  namedExports: { decryptText: (value: unknown) => value, encryptText: (value: unknown) => value },
});
mock.module("@/lib/server/case-finance-integrity", {
  namedExports: { assertCaseCanAcceptAmount: async () => undefined, isCaseFinancialLimitError: () => false },
});

type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let CREATE: (req: NextRequest) => Promise<Response>;
let PATCH: Handler;
let DELETE: Handler;

before(async () => {
  ({ POST: CREATE } = await import("../../src/app/api/invoices/route"));
  ({ PATCH, DELETE } = await import("../../src/app/api/invoices/[id]/route"));
});

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/invoices", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  });
}

async function create(asDraft: boolean) {
  const response = await CREATE(req("POST", {
    clientId: "client-1",
    asDraft,
    items: [{ description: "Fee", quantity: 1, unitPrice: 10 }],
  }));
  assert.equal(response.status, 201);
  return ((await response.json()) as { data: Row }).data;
}

async function issue(id: string) {
  targetId = id;
  const response = await PATCH(req("PATCH", { status: "UNPAID" }), { params: Promise.resolve({ id }) });
  assert.equal(response.status, 200);
  return ((await response.json()) as { data: Row }).data;
}

const year = Number(
  new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric" }).format(new Date()),
);
const no = (n: number) => `INV-${year}-${String(n).padStart(4, "0")}`;

test("two drafts, an issued invoice, then issuing the drafts: consecutive numbers, no gap", async () => {
  const draftA = await create(true);
  const draftB = await create(true);
  assert.equal(draftA.invoiceNumber, null);
  assert.equal(draftB.invoiceNumber, null);
  assert.equal(draftA.status, "DRAFT");

  const issued = await create(false);
  assert.equal(issued.invoiceNumber, no(1));

  // A draft deleted before it is issued takes no number with it.
  const draftC = await create(true);
  targetId = draftC.id;
  const deleted = await DELETE(req("DELETE"), { params: Promise.resolve({ id: draftC.id }) });
  assert.equal(deleted.status, 200);

  const a = await issue(draftA.id);
  const b = await issue(draftB.id);
  assert.equal(a.invoiceNumber, no(2));
  assert.equal(b.invoiceNumber, no(3));
  assert.equal(a.status, "UNPAID");

  // The issue date is the day it is issued, not the day the draft was saved.
  assert.notEqual(new Date(a.issueDate).toISOString(), new Date("2026-11-01").toISOString());

  const numbers = [...invoices.values()].map((row) => row.invoiceNumber).sort();
  assert.deepEqual(numbers, [no(1), no(2), no(3)]);
  assert.equal(sequence.get(`tenant-1:${year}`), 4);
});

test("issuing keeps a number a draft already had (drafts saved before this change)", async () => {
  const legacy = await create(true);
  invoices.get(legacy.id)!.invoiceNumber = "INV-2026-0900";
  const before = sequence.get(`tenant-1:${year}`);
  const issued = await issue(legacy.id);
  assert.equal(issued.invoiceNumber, "INV-2026-0900");
  assert.equal(sequence.get(`tenant-1:${year}`), before);
});
