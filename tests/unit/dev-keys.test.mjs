import { test } from "node:test";
import assert from "node:assert/strict";
import { findProductionKeysInDev } from "../../scripts/check-dev-keys.mjs";

// AUDIT_REPORT.md C1: `npm run dev` refuses to start with production
// billing/email keys or production URLs.

const safe = {
  POLAR_ACCESS_TOKEN: "polar_oat_sandbox_token",
  POLAR_ENVIRONMENT: "sandbox",
  RESEND_API_KEY: "",
  EMAIL_FROM: "Viresto <verify@virestojo.com>",
  APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

test("a sandbox setup starts", () => {
  assert.deepEqual(findProductionKeysInDev(safe), []);
  assert.deepEqual(findProductionKeysInDev({}), []);
});

test("a production Polar token is refused", () => {
  const problems = findProductionKeysInDev({ ...safe, POLAR_ENVIRONMENT: "production" });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /POLAR_ACCESS_TOKEN/);
});

test("a Resend key with the production sender is refused; without a key it is fine", () => {
  const problems = findProductionKeysInDev({ ...safe, RESEND_API_KEY: "re_live" });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /RESEND_API_KEY/);

  assert.deepEqual(
    findProductionKeysInDev({ ...safe, RESEND_API_KEY: "re_test", EMAIL_FROM: "Dev <dev@example.com>" }),
    [],
  );
});

test("production URLs are refused, subdomains included", () => {
  const problems = findProductionKeysInDev({
    ...safe,
    APP_URL: "https://www.virestojo.com",
    NEXT_PUBLIC_APP_URL: "https://virestojo.com",
  });
  assert.equal(problems.length, 2);
  assert.deepEqual(findProductionKeysInDev({ ...safe, APP_URL: "https://notvirestojo.com" }), []);
});
