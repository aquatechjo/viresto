import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// The real payment route handlers (POST /api/payments and
// PATCH /api/payments/[id]) against an in-memory invoice and its payments.
// The balance check runs inside the handler's transaction, after the
// invoice row lock, exactly as on the server.

type Row = Record<string, any>;

const state: {
  invoice: Row;
  payments: Row[];
  locks: string[];
  activities: Row[];
} = { invoice: {}, payments: [], locks: [], activities: [] };

let receiptCounter = 0;

function paidPayments(excludeId?: string) {
  return state.payments
    .filter((p) => p.status === "PAID" && p.id !== excludeId)
    .map((p) => ({ amount: p.amount }));
}

function invoiceView(where: Row = {}) {
  const excludeId = where?.payments?.where?.id?.not;
  return {
    ...state.invoice,
    client: { id: "client-1", archivedAt: null },
    case: null,
    payments: paidPayments(excludeId),
  };
}

const db: Row = {
  $queryRaw: async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    state.locks.push(sql.includes('"Payment"') ? "payment" : "invoice");
    return [{ id: "locked" }];
  },
  invoice: {
    findFirst: async (args: Row) => invoiceView(args?.select),
    update: async ({ data }: Row) => {
      Object.assign(state.invoice, data);
      return { ...state.invoice };
    },
  },
  case: { findFirst: async () => null },
  payment: {
    findFirst: async ({ where }: Row) => {
      const id = where?.id ?? where?.AND?.find?.((c: Row) => c.id)?.id;
      const found = state.payments.find((p) => p.id === id) ?? state.payments[0];
      return found
        ? {
            ...found,
            client: { id: "client-1", name: "c", archivedAt: null },
            case: null,
            invoice: { ...state.invoice },
          }
        : null;
    },
    create: async ({ data }: Row) => {
      const row = { ...data, id: `pay-${state.payments.length + 1}` };
      state.payments.push(row);
      return {
        ...row,
        client: { id: "client-1", name: "c", archivedAt: null },
        case: null,
        invoice: { ...state.invoice },
      };
    },
    update: async ({ where, data }: Row) => {
      const row = state.payments.find((p) => p.id === where.id)!;
      Object.assign(row, data);
      return {
        ...row,
        client: { id: "client-1", name: "c", archivedAt: null },
        case: null,
        invoice: { ...state.invoice },
      };
    },
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
mock.module("@/lib/activity", {
  namedExports: {
    logActivity: async (data: Row) => {
      state.activities.push(data);
    },
  },
});
mock.module("@/lib/billing-limits", {
  namedExports: { assertTenantCanWrite: async () => ({ ok: true }) },
});
mock.module("@/lib/server/receipt-number", {
  namedExports: {
    allocateReceiptNumber: async () => `R-2026-${String(++receiptCounter).padStart(4, "0")}`,
  },
});
mock.module("@/lib/server/case-finance-integrity", {
  namedExports: {
    assertCaseCanAcceptAmount: async () => undefined,
    isCaseFinancialLimitError: () => false,
  },
});

let POST: (req: NextRequest) => Promise<Response>;
let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

before(async () => {
  ({ POST } = await import("../../src/app/api/payments/route"));
  ({ PATCH } = await import("../../src/app/api/payments/[id]/route"));
});

function reset(total = 100) {
  state.invoice = {
    id: "inv-1",
    invoiceNumber: "INV-2026-0001",
    clientId: "client-1",
    caseId: null,
    status: "UNPAID",
    total,
    dueDate: null,
  };
  state.payments = [];
  state.locks = [];
  state.activities = [];
}

function pay(amount: number, status?: "PAID" | "PENDING") {
  return POST(
    new NextRequest("http://localhost/api/payments", {
      method: "POST",
      body: JSON.stringify({ invoiceId: "inv-1", amount, ...(status ? { status } : {}) }),
      headers: { "content-type": "application/json" },
    }),
  );
}

async function body(response: Response) {
  return (await response.json()) as { success: boolean; message?: string; details?: Row };
}

test("POST: a second payment above the invoice's remaining balance is rejected (409) and not saved", async () => {
  reset(100);

  const first = await pay(60);
  assert.equal(first.status, 201);
  assert.equal(state.invoice.status, "PARTIALLY_PAID");

  const second = await pay(50);
  assert.equal(second.status, 409);
  const result = await body(second);
  assert.equal(result.message, "قيمة الدفعة أكبر من الرصيد المتبقي على الفاتورة");
  assert.deepEqual(result.details, {
    invoiceTotal: 100,
    paidTotal: 60,
    remaining: 40,
    requestedAmount: 50,
  });

  // Nothing written by the rejected call: one payment, invoice unchanged.
  assert.equal(state.payments.length, 1);
  assert.equal(state.invoice.status, "PARTIALLY_PAID");
  assert.equal(state.activities.length, 1);
  // The invoice row was locked before the balance was read, both times.
  assert.deepEqual(state.locks, ["invoice", "invoice"]);
});

test("POST: one fils over the balance is rejected; the exact balance is accepted; then the invoice takes nothing more", async () => {
  reset(100);
  assert.equal((await pay(60)).status, 201);

  assert.equal((await pay(40.001)).status, 409);
  assert.equal(state.payments.length, 1);

  assert.equal((await pay(40)).status, 201);
  assert.equal(state.invoice.status, "PAID");

  const after = await pay(0.001);
  assert.equal(after.status, 409);
  assert.equal((await body(after)).message, "الفاتورة مدفوعة بالكامل ولا تقبل دفعة إضافية");
  assert.equal(state.payments.length, 2);
});

test("POST: a PENDING payment above the remaining balance is rejected (409), same message, nothing saved", async () => {
  reset(100);
  assert.equal((await pay(60)).status, 201);

  const response = await pay(50, "PENDING");
  assert.equal(response.status, 409);
  const result = await body(response);
  assert.equal(result.message, "قيمة الدفعة أكبر من الرصيد المتبقي على الفاتورة");
  assert.deepEqual(result.details, {
    invoiceTotal: 100,
    paidTotal: 60,
    remaining: 40,
    requestedAmount: 50,
  });
  assert.equal(state.payments.length, 1);
  assert.deepEqual(state.locks, ["invoice", "invoice"]); // checked after the lock
});

test("POST: a PENDING payment within the remaining balance is accepted; none on a fully paid invoice", async () => {
  reset(100);
  assert.equal((await pay(60)).status, 201);
  assert.equal((await pay(40, "PENDING")).status, 201);
  assert.equal(state.payments.filter((p) => p.status === "PENDING").length, 1);

  reset(100);
  assert.equal((await pay(100)).status, 201);
  const after = await pay(1, "PENDING");
  assert.equal(after.status, 409);
  assert.equal((await body(after)).message, "الفاتورة مدفوعة بالكامل ولا تقبل دفعة إضافية");
});

test("PATCH: collecting a pending payment above the remaining balance is rejected (409)", async () => {
  // Two pending payments that each fit, then the first is collected: the
  // second no longer fits, and collecting it is refused.
  reset(100);
  assert.equal((await pay(60)).status, 201);
  assert.equal((await pay(30, "PENDING")).status, 201);
  assert.equal((await pay(40, "PENDING")).status, 201);
  const [first, pending] = state.payments.filter((p) => p.status === "PENDING");
  first.status = "PAID"; // collected: 90 of 100, so 10 left for the pending 40

  const response = await PATCH(
    new NextRequest(`http://localhost/api/payments/${pending.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "PAID" }),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ id: pending.id }) },
  );

  assert.equal(response.status, 409);
  assert.equal((await body(response)).message, "قيمة الدفعة أكبر من الرصيد المتاح على الفاتورة");
  assert.equal(pending.status, "PENDING");
  assert.equal(state.invoice.status, "PARTIALLY_PAID");
});
