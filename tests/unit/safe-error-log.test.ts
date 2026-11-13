import { test } from "node:test";
import assert from "node:assert/strict";
import { describeError, redactSecrets } from "../../src/lib/safe-error-log";

// The 2026-11-13 leak: a Polar SDK error carries the request it failed on,
// and console.error(error) printed its Authorization header.

const TOKEN = "polar_oat_" + "x".repeat(43);

function polarLikeError() {
  const error = new Error(
    `API error occurred: {"detail":[{"msg":"value is not a valid email address","input":"someone@lawfirm.jo"}]}`,
  ) as Error & Record<string, unknown>;
  error.name = "HTTPValidationError";
  error.statusCode = 422;
  error["request$"] = { headers: { authorization: `Bearer ${TOKEN}`, cookie: "session=abc" } };
  error.body = JSON.stringify({ input: { customer_email: "someone@lawfirm.jo" } });
  return error;
}

test("a Polar-like SDK error: name, status and message, never the request headers, token or email", () => {
  const line = describeError(polarLikeError());
  assert.match(line, /^HTTPValidationError status=422: API error occurred/);
  assert.ok(!line.includes(TOKEN), "token");
  assert.ok(!line.includes("Bearer"), "bearer");
  assert.ok(!line.includes("session=abc"), "cookie");
  assert.ok(!line.includes("someone@lawfirm.jo"), "email");
  assert.ok(line.includes("[email]"));
});

test("tokens and emails inside a message or stack are redacted", () => {
  const error = new Error(`failed with Authorization: Bearer ${TOKEN} for a@b.co`);
  const line = describeError(error);
  assert.ok(!line.includes(TOKEN));
  assert.ok(!line.includes("a@b.co"));
  assert.equal(redactSecrets(`token ${TOKEN}`), "token [polar-token]");
  assert.equal(redactSecrets("key sk_live_abcdefghijkl"), "key [secret]");
});

test("non-Error values are stringified and redacted; long messages are cut", () => {
  assert.equal(describeError(`oops ${TOKEN}`), "oops [polar-token]");
  assert.ok(describeError(new Error("x".repeat(5000))).length < 1000);
});

test("no server logging path prints a raw error object any more", async () => {
  const { readFileSync } = await import("node:fs");
  const { execSync } = await import("node:child_process");
  const files = execSync("git ls-files src", { encoding: "utf8" }).split("\n").filter((f) => /\.(ts|tsx)$/.test(f));
  const offenders: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    // Browser code logs to the user's own console, not the server log.
    if (/^\s*["']use client["']/.test(text)) continue;
    // console.error / console.warn whose last argument is a bare `error` or `err`.
    const matches = text.match(/console\.(?:error|warn)\([^;]*?,\s*(?:error|err)\s*\)/g) ?? [];
    for (const m of matches) offenders.push(`${file}: ${m.slice(0, 80)}`);
  }
  assert.deepEqual(offenders, []);
});
