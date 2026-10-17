import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContentSecurityPolicy,
  createCspNonce,
} from "../../src/lib/csp";

function directive(csp: string, name: string) {
  return csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));
}

test("production CSP authorizes scripts with a per-request nonce", () => {
  const nonce = createCspNonce();
  const csp = buildContentSecurityPolicy(nonce, false);
  const scriptSrc = directive(csp, "script-src");
  const scriptElementSrc = directive(csp, "script-src-elem");

  assert.match(nonce, /^[A-Za-z0-9_-]{16,128}$/);
  assert.ok(scriptSrc?.includes(`'nonce-${nonce}'`));
  assert.ok(scriptElementSrc?.includes(`'nonce-${nonce}'`));
  assert.equal(scriptSrc?.includes("'unsafe-inline'"), false);
  assert.equal(scriptElementSrc?.includes("'unsafe-inline'"), false);
  assert.equal(scriptSrc?.includes("'unsafe-eval'"), false);
  assert.equal(directive(csp, "script-src-attr"), "script-src-attr 'none'");
});

test("development CSP permits eval without weakening inline scripts", () => {
  const csp = buildContentSecurityPolicy(createCspNonce(), true);
  const scriptSrc = directive(csp, "script-src");

  assert.ok(scriptSrc?.includes("'unsafe-eval'"));
  assert.equal(scriptSrc?.includes("'unsafe-inline'"), false);
});

test("CSP nonces differ between requests", () => {
  assert.notEqual(createCspNonce(), createCspNonce());
});

test("connect-src does not allow api.openai.com (only the server calls OpenAI)", () => {
  const policy = buildContentSecurityPolicy("abcdefghijklmnop1234", false);
  const connectSrc = policy.split(";").find((part) => part.trim().startsWith("connect-src"));

  assert.ok(connectSrc);
  assert.equal(connectSrc.includes("openai"), false);
});

test("connect-src allows Sentry ingest for browser error reports, nothing broader", () => {
  const policy = buildContentSecurityPolicy("abcdefghijklmnop", false);
  const connectSrc = policy.split(";").find((part) => part.trim().startsWith("connect-src")) ?? "";

  assert.match(connectSrc, /https:\/\/\*\.ingest\.sentry\.io/);
  assert.match(connectSrc, /https:\/\/\*\.ingest\.de\.sentry\.io/);
  assert.equal(connectSrc.includes("https://*.sentry.io"), false);
});
