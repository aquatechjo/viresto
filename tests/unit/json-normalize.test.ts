import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { normalizeJsonValue } from "../../src/lib/json-normalize";

test("normalizes Prisma decimals to API-compatible numbers", () => {
  const createdAt = new Date("2026-07-17T12:00:00.000Z");
  const normalized = normalizeJsonValue({
    amount: new Prisma.Decimal("1.001"),
    nested: {
      total: new Prisma.Decimal("999999.999"),
    },
    items: [new Prisma.Decimal("0.010")],
    createdAt,
  });

  assert.equal(normalized.amount, 1.001);
  assert.equal(normalized.nested.total, 999999.999);
  assert.deepEqual(normalized.items, [0.01]);
  assert.equal(normalized.createdAt, createdAt);
});
