import assert from "node:assert/strict";
import test from "node:test";
import { hasPlanCapacity } from "../../src/lib/plan-capacity";

test("allows exactly the remaining resource capacity", () => {
  assert.equal(hasPlanCapacity(4, 5), true);
  assert.equal(hasPlanCapacity(5, 5), false);
  assert.equal(hasPlanCapacity(4, 5, 2), false);
});

test("allows positive allocations when the plan limit is unlimited", () => {
  assert.equal(hasPlanCapacity(10_000, null), true);
  assert.equal(hasPlanCapacity(10_000, null, 5_000), true);
});

test("checks byte capacity without overflowing the boundary", () => {
  const oneMb = 1024 * 1024;

  assert.equal(hasPlanCapacity(4 * oneMb, 5 * oneMb, oneMb), true);
  assert.equal(hasPlanCapacity(4 * oneMb, 5 * oneMb, oneMb + 1), false);
});

test("rejects invalid counters and allocations", () => {
  assert.equal(hasPlanCapacity(-1, 5), false);
  assert.equal(hasPlanCapacity(0.5, 5), false);
  assert.equal(hasPlanCapacity(0, -1), false);
  assert.equal(hasPlanCapacity(0, 5, 0), false);
  assert.equal(hasPlanCapacity(0, 5, 1.5), false);
});
