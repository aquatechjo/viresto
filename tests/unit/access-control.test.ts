import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClientAccessWhere,
  type AccessControlUser,
} from "../../src/lib/access-control";

const lawyer: AccessControlUser = {
  userId: "lawyer-a",
  tenantId: "tenant-a",
  role: "LAWYER",
};

test("lawyer intake access is limited to clients created by that lawyer", () => {
  const where = buildClientAccessWhere(lawyer);
  const accessScope = (where.AND as unknown[])[1] as {
    OR: Array<Record<string, unknown>>;
  };

  assert.deepEqual(accessScope.OR[1], {
    createdById: lawyer.userId,
    cases: { none: {} },
  });
  assert.notDeepEqual(accessScope.OR[1], { cases: { none: {} } });
});

test("client access remains tenant scoped for every role", () => {
  for (const role of ["ADMIN", "LAWYER", "STAFF"] as const) {
    const where = buildClientAccessWhere({ ...lawyer, role });
    const scopes = where.AND as unknown[];

    assert.deepEqual(scopes[0], { tenantId: lawyer.tenantId });
  }
});

test("staff do not receive intake-client access", () => {
  const where = buildClientAccessWhere({ ...lawyer, role: "STAFF" });
  const accessScope = (where.AND as unknown[])[1];

  assert.deepEqual(accessScope, {
    cases: {
      some: {
        tenantId: lawyer.tenantId,
        OR: [
          { leadLawyerId: lawyer.userId },
          {
            members: {
              some: {
                tenantId: lawyer.tenantId,
                userId: lawyer.userId,
              },
            },
          },
          {
            tasks: {
              some: {
                tenantId: lawyer.tenantId,
                assignedToId: lawyer.userId,
              },
            },
          },
          {
            appointments: {
              some: {
                tenantId: lawyer.tenantId,
                assignedToId: lawyer.userId,
              },
            },
          },
        ],
      },
    },
  });
});
