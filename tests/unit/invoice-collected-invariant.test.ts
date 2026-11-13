import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { MONEY_EPSILON } from "../../src/lib/money";

// Invariant: no invoice ever has collected (PAID payments) above its
// total, and an invoice stored as UNPAID or PARTIALLY_PAID always has
// collected below its total. combineInvoiceStats (src/lib/invoice-stats.ts)
// depends on it: it sums "still to collect" as sum(total) - sum(collected)
// over open invoices.
//
// Random sequences of every operation that changes collected or total go
// through the real route handlers (database, auth and side effects
// mocked): new payments (collected or pending, often above the balance),
// collecting a pending payment, changing a pending amount, cancelling a
// collected payment, and editing the invoice's lines. The invariant is
// checked after every step. Removing any balance guard makes this fail.

type Row = Record<string, any>;

const state: { invoice: Row; payments: Row[] } = { invoice: {}, payments: [] };
let receiptCounter = 0;
const UPDATED_AT = new Date("2026-11-13T08:00:00.000Z");

function paymentsFor(args: Row | undefined) {
  const spec = args?.select?.payments ?? args?.include?.payments;
  const where = spec?.where ?? {};
  return state.payments
    .filter((p) => (where.status ? p.status === where.status : true))
    .filter((p) => (where.id?.not ? p.id !== where.id.not : true))
    .map((p) => ({ ...p }));
}

function invoiceView(args?: Row) {
  return {
    ...state.invoice,
    client: { id: "client-1", name: "c", phone: null, email: null, archivedAt: null },
    case: null,
    items: [],
    payments: paymentsFor(args),
  };
}

function paymentView(row: Row) {
  return {
    ...row,
    client: { id: "client-1", name: "c", archivedAt: null },
    case: null,
    invoice: { ...state.invoice },
  };
}

const SCALAR_INVOICE_FIELDS = ["status", "subtotal", "tax", "discount", "total", "dueDate", "notes"];

const db: Row = {
  $queryRaw: async () => [{ id: "locked" }],
  invoice: {
    findFirst: async (args: Row) => invoiceView(args),
    findUnique: async (args: Row) => invoiceView(args),
    update: async ({ data }: Row) => {
      for (const field of SCALAR_INVOICE_FIELDS) {
        if (data[field] !== undefined) state.invoice[field] = Number.isFinite(Number(data[field])) && field !== "status" && field !== "notes" && field !== "dueDate" ? Number(data[field]) : data[field];
      }
      return invoiceView({ include: { payments: {} } });
    },
  },
  case: { findFirst: async () => null },
  client: { findFirst: async () => ({ id: "client-1", archivedAt: null }) },
  payment: {
    findFirst: async ({ where }: Row) => {
      const id = where?.id ?? where?.AND?.find?.((c: Row) => c.id)?.id;
      const found = state.payments.find((p) => p.id === id);
      return found ? paymentView(found) : null;
    },
    create: async ({ data }: Row) => {
      const row = { ...data, amount: Number(data.amount), id: `pay-${state.payments.length + 1}` };
      state.payments.push(row);
      return paymentView(row);
    },
    update: async ({ where, data }: Row) => {
      const row = state.payments.find((p) => p.id === where.id)!;
      Object.assign(row, data, data.amount !== undefined ? { amount: Number(data.amount) } : {});
      return paymentView(row);
    },
    count: async () => state.payments.length,
  },
};
db.$transaction = async (fn: (tx: Row) => unknown) => fn(db);

mock.module("@/lib/prisma", { namedExports: { prisma: db } });
mock.module("@/lib/api-auth", {
  namedExports: {
    requirePermission: async () => ({
      error: null,
      user: { userId: "user-1", tenantId: "tenant-1", role: "ADMIN" },
    }),
    getRequestMeta: () => ({ ipAddress: null, userAgent: null }),
  },
});
mock.module("@/lib/csrf", { namedExports: { verifySameOrigin: () => null } });
mock.module("@/lib/activity", { namedExports: { logActivity: async () => undefined } });
mock.module("@/lib/billing-limits", {
  namedExports: { assertTenantCanWrite: async () => ({ ok: true }) },
});
mock.module("@/lib/encryption", {
  namedExports: { decryptText: (v: unknown) => v, encryptText: (v: unknown) => v },
});
mock.module("@/lib/server/receipt-number", {
  namedExports: {
    allocateReceiptNumber: async () => `R-2026-${String(++receiptCounter).padStart(4, "0")}`,
  },
});
mock.module("@/lib/server/invoice-number", {
  namedExports: { allocateInvoiceNumber: async () => "INV-2026-9999" },
});
mock.module("@/lib/server/case-finance-integrity", {
  namedExports: {
    assertCaseCanAcceptAmount: async () => undefined,
    isCaseFinancialLimitError: () => false,
  },
});

type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let CREATE_PAYMENT: (req: NextRequest) => Promise<Response>;
let PATCH_PAYMENT: Handler;
let PATCH_INVOICE: Handler;

before(async () => {
  ({ POST: CREATE_PAYMENT } = await import("../../src/app/api/payments/route"));
  ({ PATCH: PATCH_PAYMENT } = await import("../../src/app/api/payments/[id]/route"));
  ({ PATCH: PATCH_INVOICE } = await import("../../src/app/api/invoices/[id]/route"));
});

function json(url: string, method: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

/** A money amount in whole fils between 0.001 and max. */
function amount(next: () => number, max: number) {
  return Math.max(1, Math.floor(next() * max * 1000)) / 1000;
}

function collected() {
  return state.payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

function checkInvariant(context: string) {
  const total = Number(state.invoice.total);
  const paid = Math.round(collected() * 1000) / 1000;
  assert.ok(paid <= total + MONEY_EPSILON, `collected ${paid} > total ${total} after ${context}`);
  if (state.invoice.status === "UNPAID" || state.invoice.status === "PARTIALLY_PAID") {
    assert.ok(
      paid + MONEY_EPSILON < total,
      `open invoice (${state.invoice.status}) with collected ${paid} >= total ${total} after ${context}`,
    );
  }
}

/**
 * An amount aimed at the edge: exactly what is left, one fils more, or
 * anything up to 1.3 x the total.
 */
function edgeAmount(next: () => number) {
  const total = Number(state.invoice.total);
  const left = Math.round((total - collected()) * 1000) / 1000;
  const roll = next();
  if (left > 0 && roll < 0.3) return left;
  if (roll < 0.45) return Math.round((Math.max(left, 0) + 0.001) * 1000) / 1000;
  return amount(next, total * 1.3);
}

const seen = { refusedPayment: 0, refusedCollect: 0, refusedEdit: 0, fullyCollected: 0, cancelled: 0 };

async function step(next: () => number, log: string[]) {
  const pending = state.payments.filter((p) => p.status === "PENDING");
  const paid = state.payments.filter((p) => p.status === "PAID");
  const pick = next();

  if (pick < 0.35) {
    // New payment, often exactly at or just above what is left.
    const status = next() < 0.6 ? "PAID" : "PENDING";
    const value = edgeAmount(next);
    log.push(`POST ${status} ${value}`);
    const res = await CREATE_PAYMENT(json("/api/payments", "POST", { invoiceId: "inv-1", amount: value, status }));
    if (res.status === 409) seen.refusedPayment++;
  } else if (pick < 0.55 && pending.length) {
    const p = pending[Math.floor(next() * pending.length)];
    log.push(`collect ${p.id} (${p.amount})`);
    const res = await PATCH_PAYMENT(json(`/api/payments/${p.id}`, "PATCH", { status: "PAID" }), { params: Promise.resolve({ id: p.id }) });
    if (res.status === 409) seen.refusedCollect++;
  } else if (pick < 0.65 && pending.length) {
    const p = pending[Math.floor(next() * pending.length)];
    const value = edgeAmount(next);
    log.push(`pending ${p.id} amount -> ${value}`);
    await PATCH_PAYMENT(json(`/api/payments/${p.id}`, "PATCH", { amount: value }), { params: Promise.resolve({ id: p.id }) });
  } else if (pick < 0.75 && paid.length) {
    const p = paid[Math.floor(next() * paid.length)];
    log.push(`cancel ${p.id}`);
    const res = await PATCH_PAYMENT(
      json(`/api/payments/${p.id}`, "PATCH", { status: "CANCELLED", cancellationReason: "تصحيح خطأ في التسجيل" }),
      { params: Promise.resolve({ id: p.id }) },
    );
    if (res.status === 200) seen.cancelled++;
  } else {
    // Edit the invoice's lines: a new total, often below what is collected.
    const value = next() < 0.5 && collected() > 0 ? amount(next, collected()) : amount(next, 200);
    log.push(`invoice total -> ${value}`);
    const res = await PATCH_INVOICE(
      json("/api/invoices/inv-1", "PATCH", { items: [{ description: "أتعاب", quantity: 1, unitPrice: value }] }),
      { params: Promise.resolve({ id: "inv-1" }) },
    );
    if (res.status === 409) seen.refusedEdit++;
  }
  if (state.invoice.status === "PAID") seen.fullyCollected++;
}

test("collected never exceeds total, and an open invoice is never fully collected, over 300 random sequences", async () => {
  const next = rng(20261113);
  for (let run = 0; run < 300; run++) {
    const total = amount(next, 200);
    state.invoice = {
      id: "inv-1",
      publicId: 1,
      tenantId: "tenant-1",
      invoiceNumber: "INV-2026-0001",
      clientId: "client-1",
      caseId: null,
      status: "UNPAID",
      subtotal: total,
      tax: 0,
      discount: 0,
      total,
      dueDate: null,
      notes: null,
      updatedAt: UPDATED_AT,
      cancelledAt: null,
    };
    state.payments = [];
    const log: string[] = [`invoice ${total}`];
    for (let i = 0; i < 25; i++) {
      await step(next, log);
      checkInvariant(`run ${run}: ${log.join(" | ")}`);
    }
  }

  // Not passing vacuously: every guard had to refuse something, invoices
  // did reach fully collected, and collected payments were cancelled.
  const coverage = JSON.stringify(seen);
  assert.ok(seen.refusedPayment > 100, coverage);
  assert.ok(seen.refusedCollect > 10, coverage);
  assert.ok(seen.refusedEdit > 100, coverage);
  assert.ok(seen.fullyCollected > 100, coverage);
  assert.ok(seen.cancelled > 50, coverage);
});
