import assert from "node:assert/strict";
import test from "node:test";
import { getLocationFromHeaders } from "../../src/lib/geo";
import { PLANS, planHasEntitlement } from "../../src/config/plans";

test("official plans expose the expected commercial entitlements", () => {
  assert.equal(planHasEntitlement("BASIC", "teamManagement"), false);
  assert.equal(planHasEntitlement("BASIC", "advancedReports"), false);
  assert.equal(planHasEntitlement("BASIC", "fullExport"), false);

  for (const code of ["PRO", "BUSINESS"] as const) {
    assert.equal(planHasEntitlement(code, "teamManagement"), true);
    assert.equal(planHasEntitlement(code, "advancedReports"), true);
    assert.equal(planHasEntitlement(code, "fullExport"), true);
  }
});

test("unknown plans fail closed for paid features", () => {
  assert.equal(planHasEntitlement("legacy", "fullExport"), false);
  assert.equal(planHasEntitlement(null, "advancedReports"), false);
});

test("every official plan declares every entitlement", () => {
  for (const plan of PLANS) {
    assert.equal(typeof plan.entitlements.teamManagement, "boolean");
    assert.equal(typeof plan.entitlements.advancedReports, "boolean");
    assert.equal(typeof plan.entitlements.fullExport, "boolean");
  }
});

test("login geography uses trusted platform headers without an external lookup", () => {
  const headers = new Headers({
    "x-vercel-ip-country": "JO",
    "x-vercel-ip-city": "Amman%20City",
  });

  assert.deepEqual(getLocationFromHeaders(headers), {
    country: "JO",
    city: "Amman City",
  });
  assert.deepEqual(getLocationFromHeaders(new Headers()), {
    country: null,
    city: null,
  });
});
