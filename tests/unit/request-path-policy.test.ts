import assert from "node:assert/strict";
import test from "node:test";
import { isMachineAuthenticatedPath } from "../../src/lib/request-path-policy";

test("machine-authenticated handlers bypass the user session check", () => {
  assert.equal(isMachineAuthenticatedPath("/api/health"), true);
  assert.equal(isMachineAuthenticatedPath("/api/cron/prune-activity"), true);
  assert.equal(
    isMachineAuthenticatedPath("/api/cron/generate-notifications"),
    true,
  );
});

test("machine-authenticated path matching stays exact", () => {
  assert.equal(isMachineAuthenticatedPath("/api/health/details"), false);
  assert.equal(isMachineAuthenticatedPath("/api/perf/db"), false);
  assert.equal(isMachineAuthenticatedPath("/api/cron"), false);
});
