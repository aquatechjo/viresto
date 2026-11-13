import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// POST /api/cases keeps its interactive transaction short (P2028 on a slow
// database link, 2026-11-13): only the tenant lock, the capacity recount,
// the case-number check and the writes run inside it, with explicit limits;
// lookups, the billing state and the response read run outside.

type Row = Record<string, any>;

const calls: { where: "db" | "tx"; op: string }[] = [];
const state = {
  transactionOptions: undefined as Row | undefined,
  limitOutside: { ok: true, status: 200, billing: { canCreate: true }, limit: 10, used: 3 } as Row,
  capacityUnderLock: { ok: true } as Row,
  duplicateCaseNumber: false,
  created: [] as Row[],
  activities: [] as Row[],
};

function client(where: "db" | "tx"): Row {
  const log = (op: string) => calls.push({ where, op });
  return {
    client: {
      findFirst: async () => {
        log("client.findFirst");
        return { id: "client-1", name: "c", archivedAt: null };
      },
    },
    user: {
      findFirst: async () => {
        log("user.findFirst");
        return { id: "user-1", name: "u", role: "ADMIN", isActive: true };
      },
      count: async ({ where: w }: Row) => {
        log("user.count");
        return w.id.in.length;
      },
    },
    case: {
      findFirst: async () => {
        log("case.findFirst");
        return state.duplicateCaseNumber ? { id: "other" } : null;
      },
      create: async ({ data }: Row) => {
        log("case.create");
        const row = { id: `case-${state.created.length + 1}`, title: data.title, data };
        state.created.push(row);
        return { id: row.id, title: row.title };
      },
      findUniqueOrThrow: async ({ where: w }: Row) => {
        log("case.findUniqueOrThrow");
        return { id: w.id, title: "read after commit", client: {}, leadLawyer: {}, members: [] };
      },
    },
    activity: {
      create: async ({ data }: Row) => {
        log("activity.create");
        state.activities.push(data);
        return data;
      },
    },
  };
}

const tx = client("tx");
const db: Row = {
  ...client("db"),
  $transaction: async (fn: (t: Row) => unknown, options?: Row) => {
    state.transactionOptions = options;
    return fn(tx);
  },
};

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
mock.module("@/lib/tenant-mutation-lock", {
  namedExports: {
    lockTenantMutation: async (t: Row) => calls.push({ where: t === tx ? "tx" : "db", op: "lock" }),
  },
});
mock.module("@/lib/billing-limits", {
  namedExports: {
    assertTenantCanCreate: async (_tenantId: string, _resource: string, d?: Row) => {
      calls.push({ where: d === tx ? "tx" : "db", op: "assertTenantCanCreate" });
      return state.limitOutside;
    },
    recheckCapacityUnderLock: async (_t: string, _r: string, limit: number | null, d: Row) => {
      calls.push({ where: d === tx ? "tx" : "db", op: `recheckCapacity(limit=${limit})` });
      return state.capacityUnderLock;
    },
  },
});

let POST: (req: NextRequest) => Promise<Response>;

before(async () => {
  ({ POST } = await import("../../src/app/api/cases/route"));
});

beforeEach(() => {
  calls.length = 0;
  state.transactionOptions = undefined;
  state.limitOutside = { ok: true, status: 200, billing: { canCreate: true }, limit: 10, used: 3 };
  state.capacityUnderLock = { ok: true };
  state.duplicateCaseNumber = false;
  state.created = [];
  state.activities = [];
});

function create(body: Row) {
  return POST(
    new NextRequest("http://localhost/api/cases", {
      method: "POST",
      body: JSON.stringify({ clientId: "client-1", title: "قضية", ...body }),
      headers: { "content-type": "application/json" },
    }),
  );
}

const inTx = () => calls.filter((c) => c.where === "tx").map((c) => c.op);
const outside = () => calls.filter((c) => c.where === "db").map((c) => c.op);

test("case create: only the lock, recount, number check and writes run in the transaction, with explicit limits", async () => {
  const res = await create({ caseNumber: "12/2026", memberIds: ["user-1"] });
  assert.equal(res.status, 201);

  assert.deepEqual(state.transactionOptions, { timeout: 15_000, maxWait: 10_000 });
  assert.deepEqual(inTx(), [
    "lock",
    "recheckCapacity(limit=10)",
    "case.findFirst",
    "case.create",
    "activity.create",
  ]);
  // Lookups and the billing state before; the response shape after the commit.
  assert.ok(outside().includes("client.findFirst"));
  assert.ok(outside().includes("user.findFirst"));
  assert.ok(outside().includes("assertTenantCanCreate"));
  assert.equal(outside().at(-1), "case.findUniqueOrThrow");

  assert.equal(state.created.length, 1);
  assert.equal(state.activities.length, 1);
  assert.equal(state.activities[0].entityId, "case-1");
  assert.equal((await res.json()).data.title, "read after commit");
});

test("case create: without a case number, no duplicate check in the transaction", async () => {
  const res = await create({});
  assert.equal(res.status, 201);
  assert.deepEqual(inTx(), ["lock", "recheckCapacity(limit=10)", "case.create", "activity.create"]);
});

test("case create: the plan limit reached under the lock is 400 PLAN_LIMIT_REACHED and writes nothing", async () => {
  state.capacityUnderLock = { ok: false, status: 402, message: "limit", limit: 10, used: 10 };
  const res = await create({});
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.details.code, "PLAN_LIMIT_REACHED");
  assert.equal(json.details.resource, "cases");
  assert.equal(state.created.length, 0);
  assert.equal(state.activities.length, 0);
});

test("case create: an inactive subscription is 402 before any transaction", async () => {
  state.limitOutside = { ok: false, status: 402, message: "inactive", billing: { canCreate: false } };
  const res = await create({});
  assert.equal(res.status, 402);
  assert.equal((await res.json()).details.code, "SUBSCRIPTION_INACTIVE");
  assert.equal(state.transactionOptions, undefined);
  assert.deepEqual(inTx(), []);
});

test("case create: a case number taken under the lock is 409 and writes nothing", async () => {
  state.duplicateCaseNumber = true;
  const res = await create({ caseNumber: "12/2026" });
  assert.equal(res.status, 409);
  assert.equal(state.created.length, 0);
  assert.equal(state.activities.length, 0);
});
