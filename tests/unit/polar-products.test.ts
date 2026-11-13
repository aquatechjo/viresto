import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sandboxPlanCodeForProduct,
  sandboxProductOverride,
  withPolarProductIds,
} from "../../src/lib/polar-products";

// Sandbox product map (POLAR_PRODUCT_IDS). Production must be untouched.

const ROW = { code: "PRO", polarMonthlyProductId: "prod-m", polarYearlyProductId: "prod-y", extra: 1 };
const MAP = JSON.stringify({ BASIC: { monthly: "sb-basic-m" }, PRO: { monthly: "sb-pro-m" } });

test("production: the stored ids, as they are, even with POLAR_PRODUCT_IDS set", () => {
  const env = { POLAR_ENVIRONMENT: "production", POLAR_PRODUCT_IDS: MAP };
  assert.equal(sandboxProductOverride(env), null);
  assert.equal(withPolarProductIds(ROW, env), ROW); // the same object
  assert.equal(sandboxPlanCodeForProduct("prod-m", env), undefined);
});

test("no map set: the stored ids, as they are", () => {
  const env = { POLAR_ENVIRONMENT: "sandbox" };
  assert.equal(withPolarProductIds(ROW, env), ROW);
  assert.equal(sandboxPlanCodeForProduct("prod-m", env), undefined);
});

test("sandbox with a map: it replaces the columns; a cycle left out is not set up", () => {
  const env = { POLAR_ENVIRONMENT: "sandbox", POLAR_PRODUCT_IDS: MAP };
  assert.deepEqual(withPolarProductIds(ROW, env), {
    code: "PRO",
    polarMonthlyProductId: "sb-pro-m",
    polarYearlyProductId: null,
    extra: 1,
  });
  // A plan missing from the map has no products at all.
  assert.deepEqual(
    withPolarProductIds({ code: "BUSINESS", polarMonthlyProductId: "x", polarYearlyProductId: "y" }, env),
    { code: "BUSINESS", polarMonthlyProductId: null, polarYearlyProductId: null },
  );
});

test("sandbox lookup by product id: the plan code, null for an unknown product (production ids are unknown)", () => {
  const env = { POLAR_ENVIRONMENT: "sandbox", POLAR_PRODUCT_IDS: MAP };
  assert.equal(sandboxPlanCodeForProduct("sb-basic-m", env), "BASIC");
  assert.equal(sandboxPlanCodeForProduct("prod-m", env), null);
});

test("an invalid map is ignored (stored ids), and bad ids are dropped", () => {
  assert.equal(sandboxProductOverride({ POLAR_ENVIRONMENT: "sandbox", POLAR_PRODUCT_IDS: "{not json" }), null);
  const odd = sandboxProductOverride({
    POLAR_ENVIRONMENT: "sandbox",
    POLAR_PRODUCT_IDS: JSON.stringify({ pro: { monthly: "ok-1", yearly: "bad id with spaces" } }),
  });
  assert.deepEqual(odd, { PRO: { monthly: "ok-1", yearly: undefined } });
});
