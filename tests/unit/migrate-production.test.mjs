import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

// The build's migration step must never touch a database outside Vercel
// production builds (Preview, CI, local).
function run(vercelEnv) {
  const env = { ...process.env, DIRECT_URL: "postgresql://nobody@127.0.0.1:1/none" };
  if (vercelEnv === undefined) delete env.VERCEL_ENV;
  else env.VERCEL_ENV = vercelEnv;
  return spawnSync(process.execPath, ["scripts/migrate-production.mjs"], { env, encoding: "utf8" });
}

for (const vercelEnv of ["preview", "development", undefined]) {
  test(`no migrations when VERCEL_ENV=${vercelEnv ?? "unset"}`, () => {
    const result = run(vercelEnv);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /skipped/);
    assert.doesNotMatch(result.stdout, /applying/);
  });
}

test("a production build without DIRECT_URL fails instead of building", () => {
  const env = { ...process.env, VERCEL_ENV: "production" };
  delete env.DIRECT_URL;
  const result = spawnSync(process.execPath, ["scripts/migrate-production.mjs"], { env, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DIRECT_URL is not set/);
});
