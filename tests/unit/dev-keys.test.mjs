import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findProductionDatabaseInDev,
  findProductionKeysInDev,
  neonEndpointId,
} from "../../scripts/check-dev-keys.mjs";

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

test("a Polar token needs POLAR_ENVIRONMENT=sandbox exactly", () => {
  for (const POLAR_ENVIRONMENT of ["", "Sandbox", "live"]) {
    const problems = findProductionKeysInDev({ ...safe, POLAR_ENVIRONMENT });
    assert.equal(problems.length, 1, POLAR_ENVIRONMENT);
    assert.match(problems[0], /POLAR_ACCESS_TOKEN/);
  }
  assert.deepEqual(
    findProductionKeysInDev({ ...safe, POLAR_ACCESS_TOKEN: "", POLAR_ENVIRONMENT: "" }),
    [],
  );
});

const prodPooled = "postgresql://u:p@ep-prod-123-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const prodDirect = "postgresql://u:p@ep-prod-123.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const devPooled = "postgresql://u:p@ep-dev-456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const devDirect = "postgresql://u:p@ep-dev-456.eu-central-1.aws.neon.tech/neondb?sslmode=require";

test("the Neon endpoint id ignores the pooler suffix; other hosts have none", () => {
  assert.equal(neonEndpointId(prodPooled), "ep-prod-123");
  assert.equal(neonEndpointId(prodDirect), "ep-prod-123");
  assert.equal(neonEndpointId("postgresql://u:p@localhost:5432/viresto"), "");
  assert.equal(neonEndpointId("not a url"), "");
});

test("the dev branch is accepted", () => {
  assert.deepEqual(
    findProductionDatabaseInDev({
      DATABASE_URL: devPooled,
      DIRECT_URL: devDirect,
      PROD_DB_ENDPOINT_ID: "ep-prod-123",
    }),
    [],
  );
  assert.deepEqual(findProductionDatabaseInDev({}), []);
  assert.deepEqual(
    findProductionDatabaseInDev({ DATABASE_URL: "postgresql://u:p@localhost:5432/viresto" }),
    [],
  );
});

test("the production database is refused, pooled or direct", () => {
  const problems = findProductionDatabaseInDev({
    DATABASE_URL: prodPooled,
    DIRECT_URL: prodDirect,
    PROD_DB_ENDPOINT_ID: "ep-prod-123",
  });
  assert.equal(problems.length, 2);
  assert.match(problems[0], /DATABASE_URL points at the PRODUCTION database/);
  assert.match(problems[1], /DIRECT_URL points at the PRODUCTION database/);

  assert.equal(
    findProductionDatabaseInDev({
      DATABASE_URL: devPooled,
      DIRECT_URL: prodDirect,
      PROD_DB_ENDPOINT_ID: " EP-PROD-123 ",
    }).length,
    1,
  );
});

test("a Neon URL without PROD_DB_ENDPOINT_ID is refused (cannot tell)", () => {
  const problems = findProductionDatabaseInDev({ DATABASE_URL: devPooled });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /PROD_DB_ENDPOINT_ID is not set/);
});
