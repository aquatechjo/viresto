import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POST_LOGIN_PATH,
  safeNextPath,
} from "../../src/lib/safe-redirect";

test("accepts same-origin relative paths", () => {
  for (const path of [
    "/dashboard",
    "/dashboard/cases/abc123",
    "/dashboard/cases?status=OPEN&page=2",
    "/dashboard/clients#notes",
    "/dashboard/cases/%D9%82%D8%B6%D9%8A%D8%A9",
  ]) {
    assert.equal(safeNextPath(path), path, path);
  }
});

test("rejects absolute and scheme URLs", () => {
  for (const value of [
    "http://evil.example",
    "https://evil.example/dashboard",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "evil.example",
    "dashboard",
  ]) {
    assert.equal(safeNextPath(value), DEFAULT_POST_LOGIN_PATH, value);
  }
});

test("rejects protocol-relative and backslash tricks", () => {
  for (const value of [
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "\\/evil.example",
    "/dashboard\\..\\evil",
  ]) {
    assert.equal(safeNextPath(value), DEFAULT_POST_LOGIN_PATH, value);
  }
});

test("rejects percent-encoded variants, including double encoding", () => {
  for (const value of [
    "/%2Fevil.example",
    "/%2F%2Fevil.example",
    "%2F%2Fevil.example",
    "/%5Cevil.example",
    "/%5C%5Cevil.example",
    "/%252F%252Fevil.example",
    "/%25252F%25252Fevil.example",
    "/%E0%A4%A",
  ]) {
    assert.equal(safeNextPath(value), DEFAULT_POST_LOGIN_PATH, value);
  }
});

test("rejects whitespace and control characters anywhere", () => {
  for (const value of [
    " /dashboard",
    " //evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/dashboard\u0000",
    "/%09/evil.example",
    "/%0A/evil.example",
  ]) {
    assert.equal(safeNextPath(value), DEFAULT_POST_LOGIN_PATH, JSON.stringify(value));
  }
});

test("rejects auth and api paths, non-strings, empty and oversized input", () => {
  for (const value of [
    "/login",
    "/login?next=/dashboard",
    "/register",
    "/api/auth/logout",
    "",
    null,
    undefined,
    42,
    ["/dashboard"],
    `/${"a".repeat(3000)}`,
  ]) {
    assert.equal(safeNextPath(value), DEFAULT_POST_LOGIN_PATH, String(value));
  }
});

test("uses the supplied fallback", () => {
  assert.equal(safeNextPath("//evil.example", "/admin"), "/admin");
});
