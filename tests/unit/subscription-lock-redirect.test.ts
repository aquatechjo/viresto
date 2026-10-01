import assert from "node:assert/strict";
import test from "node:test";
import {
  createSubscriptionLockFetch,
  isAllowedWhenLocked,
} from "../../src/lib/subscription-lock-redirect";

// AUDIT_REPORT.md L10: a locked office's API calls answer 402
// SUBSCRIPTION_REQUIRED. On a page a locked office cannot use, that response
// must send the user to billing instead of reaching the page (which would
// show a "failed to load" toast).

const ORIGIN = "https://app.example";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const locked = () =>
  json(402, { success: false, message: "locked", details: { code: "SUBSCRIPTION_REQUIRED", reason: "TRIAL_EXPIRED" } });

function setup(pathname: string, response: () => Response) {
  const redirects: number[] = [];
  const wrapped = createSubscriptionLockFetch({
    fetch: async () => response(),
    location: { origin: ORIGIN, pathname },
    onLocked: () => redirects.push(1),
  });
  return { wrapped, redirects };
}

async function settles(promise: Promise<unknown>) {
  const pending = Symbol("pending");
  const result = await Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(pending), 50)),
  ]);
  return result !== pending;
}

test("402 SUBSCRIPTION_REQUIRED on a locked-out page redirects and never reaches the caller", async () => {
  for (const input of ["/api/clients", `${ORIGIN}/api/cases?page=2`, new URL(`${ORIGIN}/api/tasks`)]) {
    const { wrapped, redirects } = setup("/dashboard/clients", locked);
    assert.equal(await settles(wrapped(input)), false, String(input));
    assert.equal(redirects.length, 1, String(input));
  }
});

test("everything else passes through untouched", async () => {
  const cases: Array<[string, string, () => Response]> = [
    // Pages a locked office may use: the page handles its own 402s.
    ["/dashboard/billing", "/api/clients", locked],
    ["/dashboard/settings", "/api/settings/ai", locked],
    // A 402 that is not the lockout (plan feature, AI quota).
    ["/dashboard/documents", "/api/documents/x/summarize", () => json(402, { success: false, message: "plan" })],
    // Other statuses.
    ["/dashboard/clients", "/api/clients", () => json(200, { success: true, data: [] })],
    ["/dashboard/clients", "/api/clients", () => json(401, { success: false })],
    // Not our API.
    ["/dashboard/clients", "https://other.example/api/clients", locked],
    ["/dashboard/clients", "/not-api", locked],
    // Not JSON.
    ["/dashboard/clients", "/api/clients", () => new Response("Payment Required", { status: 402 })],
  ];

  for (const [pathname, input, response] of cases) {
    const { wrapped, redirects } = setup(pathname, response);
    const result = await wrapped(input);
    assert.ok(result instanceof Response, `${pathname} ${input}`);
    assert.equal(redirects.length, 0, `${pathname} ${input}`);
  }
});

test("the caller can still read the body of a passed-through 402", async () => {
  const { wrapped } = setup("/dashboard/settings", locked);
  const body = await (await wrapped("/api/clients")).json();
  assert.equal(body.details.code, "SUBSCRIPTION_REQUIRED");
});

test("pages a locked office may open", () => {
  assert.equal(isAllowedWhenLocked("/dashboard/billing"), true);
  assert.equal(isAllowedWhenLocked("/dashboard/billing/success"), true);
  assert.equal(isAllowedWhenLocked("/dashboard/settings"), true);
  assert.equal(isAllowedWhenLocked("/dashboard/settingsx"), false);
  assert.equal(isAllowedWhenLocked("/dashboard"), false);
  assert.equal(isAllowedWhenLocked("/dashboard/clients"), false);
});
