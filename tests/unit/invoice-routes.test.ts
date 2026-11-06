import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { err } from "@/lib/api-response";
import { hasPermission, type UserRole } from "@/lib/permissions";
import { INVOICE_MESSAGES } from "@/lib/invoice-lifecycle";

// The real invoice route handlers (create, edit, delete, cancel) with the
// database, auth and side effects mocked. The role check uses the real
// permission table, so "a lawyer cannot cancel" is the server's own answer.

type Row = Record<string, any>;

const state: {
  role: UserRole;
  invoice: Row | null;
  client: Row | null;
  updates: Row[];
  deleted: string[];
  created: Row[];
  activities: Row[];
} = {
  role: "ADMIN",
  invoice: null,
  client: null,
  updates: [],
  deleted: [],
  created: [],
  activities: [],
};

const UPDATED_AT = new Date("2026-11-06T08:00:00.000Z");

function invoiceRow(overrides: Row = {}): Row {
  return {
    id: "inv-1",
    publicId: 1,
    tenantId: "tenant-1",
    clientId: "client-1",
    caseId: null,
    invoiceNumber: "INV-2026-0001",
    status: "UNPAID",
    issueDate: new Date("2026-11-01"),
    dueDate: null,
    subtotal: 100,
    tax: 0,
    discount: 0,
    total: 100,
    notes: null,
    cancelledAt: null,
    cancelledById: null,
    cancellationReason: null,
    updatedAt: UPDATED_AT,
    client: { id: "client-1", name: "c", archivedAt: null },
    case: null,
    items: [{ description: "x", quantity: 1, unitPrice: 100 }],
    payments: [],
    ...overrides,
  };
}

const db: Row = {
  invoice: {
    findFirst: async () => (state.invoice ? { ...state.invoice } : null),
    findUnique: async () => (state.invoice ? { ...state.invoice } : null),
    update: async ({ data }: Row) => {
      state.updates.push(data);
      Object.assign(state.invoice!, data);
      return { ...state.invoice };
    },
    delete: async ({ where }: Row) => {
      state.deleted.push(where.id);
      return {};
    },
    create: async ({ data }: Row) => {
      state.created.push(data);
      return { ...data, id: "inv-new", items: [], payments: [], client: null, case: null };
    },
  },
  client: { findFirst: async () => state.client },
  case: { findFirst: async () => null },
  payment: { count: async () => state.invoice?.payments.length ?? 0 },
  $queryRaw: async () => [{ id: "inv-1", sequenceNumber: 7 }],
  $transaction: async (fn: (tx: Row) => unknown) => fn(db),
};

mock.module("@/lib/prisma", { namedExports: { prisma: db } });
mock.module("@/lib/api-auth", {
  namedExports: {
    requirePermission: async (_req: unknown, permission: Parameters<typeof hasPermission>[1]) =>
      hasPermission(state.role, permission)
        ? { error: null, user: { userId: "user-1", tenantId: "tenant-1", role: state.role } }
        : { error: err("لا تملك صلاحية لتنفيذ هذا الإجراء.", 403), user: null },
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
mock.module("@/lib/encryption", {
  namedExports: { decryptText: (value: unknown) => value, encryptText: (value: unknown) => value },
});
mock.module("@/lib/server/case-finance-integrity", {
  namedExports: {
    assertCaseCanAcceptAmount: async () => undefined,
    isCaseFinancialLimitError: () => false,
  },
});

type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let CANCEL: Handler;
let PATCH: Handler;
let DELETE: Handler;
let CREATE: (req: NextRequest) => Promise<Response>;

before(async () => {
  ({ POST: CANCEL } = await import("../../src/app/api/invoices/[id]/cancel/route"));
  ({ PATCH, DELETE } = await import("../../src/app/api/invoices/[id]/route"));
  ({ POST: CREATE } = await import("../../src/app/api/invoices/route"));
});

function reset(role: UserRole, invoice: Row | null) {
  state.role = role;
  state.invoice = invoice;
  state.client = { id: "client-1", publicId: 1, name: "c", archivedAt: null };
  state.updates = [];
  state.deleted = [];
  state.created = [];
  state.activities = [];
}

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/invoices/inv-1", {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } }
      : {}),
  });
}
const ctx = { params: Promise.resolve({ id: "inv-1" }) };

async function json(response: Response) {
  return (await response.json()) as { success: boolean; message?: string; data?: Row };
}

test("cancel: a lawyer is refused by the server (403) and nothing changes", async () => {
  reset("LAWYER", invoiceRow());
  const response = await CANCEL(req("POST", { reason: "خطأ في البنود" }), ctx);
  assert.equal(response.status, 403);
  assert.equal(state.updates.length, 0);
});

test("cancel: without a reason, or a too short one, is refused (400)", async () => {
  for (const body of [{}, { reason: "" }, { reason: "   " }, { reason: "abc" }]) {
    reset("ADMIN", invoiceRow());
    const response = await CANCEL(req("POST", body), ctx);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await json(response)).message, INVOICE_MESSAGES.reasonRequired);
    assert.equal(state.updates.length, 0);
  }
});

test("cancel: the admin cancels with a reason; who, when and why are saved", async () => {
  reset("ADMIN", invoiceRow());
  const response = await CANCEL(req("POST", { reason: "  أُصدرت بالخطأ  " }), ctx);
  assert.equal(response.status, 200);
  assert.equal(state.updates.length, 1);
  const data = state.updates[0];
  assert.equal(data.status, "CANCELLED");
  assert.equal(data.cancelledById, "user-1");
  assert.equal(data.cancellationReason, "أُصدرت بالخطأ");
  assert.ok(data.cancelledAt instanceof Date);
  assert.equal(state.activities[0]?.type, "INVOICE_CANCELLED");
});

test("cancel: refused with pending payments, with collected payments, for a draft, and twice", async () => {
  const cases: Array<[Row, string]> = [
    [invoiceRow({ payments: [{ status: "PENDING", amount: 20 }] }), INVOICE_MESSAGES.pendingPayments],
    [invoiceRow({ status: "PARTIALLY_PAID", payments: [{ status: "PAID", amount: 20 }] }), INVOICE_MESSAGES.collectedPayments],
    [invoiceRow({ status: "DRAFT" }), INVOICE_MESSAGES.draftNotCancelled],
    [invoiceRow({ status: "CANCELLED" }), INVOICE_MESSAGES.alreadyCancelled],
  ];
  for (const [invoice, message] of cases) {
    reset("ADMIN", invoice);
    const response = await CANCEL(req("POST", { reason: "سبب كافٍ للإلغاء" }), ctx);
    assert.equal(response.status, 409, message);
    assert.equal((await json(response)).message, message);
    assert.equal(state.updates.length, 0);
  }
});

test("edit: a cancelled invoice cannot be edited or brought back", async () => {
  for (const body of [{ notes: "x" }, { status: "UNPAID" }, { status: "DRAFT" }, { dueDate: "2026-12-01" }]) {
    reset("ADMIN", invoiceRow({ status: "CANCELLED", cancellationReason: "سبب", cancelledAt: new Date(), cancelledById: "user-1" }));
    const response = await PATCH(req("PATCH", body), ctx);
    assert.equal(response.status, 409, JSON.stringify(body));
    assert.equal((await json(response)).message, INVOICE_MESSAGES.cancelledLocked);
    assert.equal(state.updates.length, 0);
  }
});

test("edit: cancelling through a status change is refused; it has its own route", async () => {
  reset("ADMIN", invoiceRow());
  const response = await PATCH(req("PATCH", { status: "CANCELLED" }), ctx);
  assert.equal(response.status, 409);
  assert.equal((await json(response)).message, INVOICE_MESSAGES.useCancel);
  assert.equal(state.updates.length, 0);
});

test("edit: an issued invoice does not go back to draft", async () => {
  reset("ADMIN", invoiceRow());
  const response = await PATCH(req("PATCH", { status: "DRAFT" }), ctx);
  assert.equal(response.status, 409);
  assert.equal((await json(response)).message, INVOICE_MESSAGES.noBackToDraft);
});

test("edit: issuing a draft makes it unpaid", async () => {
  reset("LAWYER", invoiceRow({ status: "DRAFT", invoiceNumber: null }));
  const response = await PATCH(req("PATCH", { status: "UNPAID" }), ctx);
  assert.equal(response.status, 200);
  assert.equal(state.updates[0]?.status, "UNPAID");
  // The number is taken now, from the sequence (mocked to give 7).
  assert.match(String(state.updates[0]?.invoiceNumber), /^INV-\d{4}-0007$/);
  assert.equal(state.activities[0]?.type, "INVOICE_ISSUED");
});

test("edit: a draft of an archived client is not issued", async () => {
  reset("ADMIN", invoiceRow({ status: "DRAFT", client: { id: "client-1", name: "c", archivedAt: new Date() } }));
  const response = await PATCH(req("PATCH", { status: "UNPAID" }), ctx);
  assert.equal(response.status, 400);
  assert.equal((await json(response)).message, INVOICE_MESSAGES.archivedClientIssue);
  assert.equal(state.updates.length, 0);
});

test("delete: only a draft is deleted", async () => {
  for (const status of ["UNPAID", "OVERDUE", "CANCELLED", "PAID"]) {
    reset("ADMIN", invoiceRow({ status }));
    const response = await DELETE(req("DELETE"), ctx);
    assert.equal(response.status, 409, status);
    assert.equal((await json(response)).message, INVOICE_MESSAGES.deleteDraftOnly);
    assert.deepEqual(state.deleted, []);
  }

  reset("ADMIN", invoiceRow({ status: "DRAFT" }));
  const response = await DELETE(req("DELETE"), ctx);
  assert.equal(response.status, 200);
  assert.deepEqual(state.deleted, ["inv-1"]);
});

const NEW_INVOICE = {
  clientId: "client-1",
  items: [{ description: "استشارة", quantity: 1, unitPrice: 50 }],
};

test("create: issued (UNPAID) by default, DRAFT with 'save as draft'", async () => {
  reset("LAWYER", null);
  assert.equal((await CREATE(req("POST", NEW_INVOICE))).status, 201);
  assert.equal(state.created[0]?.status, "UNPAID");

  reset("LAWYER", null);
  assert.equal((await CREATE(req("POST", { ...NEW_INVOICE, asDraft: true }))).status, 201);
  assert.equal(state.created[0]?.status, "DRAFT");
  assert.equal(state.created[0]?.invoiceNumber, null);
});

test("create: no new invoice for an archived client", async () => {
  reset("ADMIN", null);
  state.client = { id: "client-1", publicId: 1, name: "c", archivedAt: new Date() };
  const response = await CREATE(req("POST", NEW_INVOICE));
  assert.equal(response.status, 400);
  assert.equal((await json(response)).message, INVOICE_MESSAGES.archivedClientCreate);
  assert.equal(state.created.length, 0);
});
