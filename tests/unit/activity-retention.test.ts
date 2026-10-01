import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  ACTIVITY_RETENTION_DAYS,
  AUDIT_ACTIVITY_TYPES,
  isAuditActivityType,
} from "@/lib/activity-retention";

// The audit list must name only types the app really emits, and every
// deletion the API logs must be kept for the audit period.

const SRC = path.resolve(__dirname, "../../src");
// The list itself and the activity page's display labels do not count as emitters.
const NOT_EMITTERS = new Set([
  path.join(SRC, "lib", "activity-retention.ts"),
  path.join(SRC, "app", "dashboard", "activity", "page.tsx"),
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const emitterSource = sourceFiles(SRC)
  .filter((file) => !NOT_EMITTERS.has(file))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

test("audit retention is a year, everything else 30 days", () => {
  assert.equal(ACTIVITY_RETENTION_DAYS.audit, 365);
  assert.equal(ACTIVITY_RETENTION_DAYS.default, 30);
});

test("every audit type in the list is actually emitted by the app", () => {
  const dead = AUDIT_ACTIVITY_TYPES.filter((type) => !emitterSource.includes(`"${type}"`));
  assert.deepEqual(dead, []);
});

test("every *_DELETED activity the API logs is kept for the audit period", () => {
  const apiSource = sourceFiles(path.join(SRC, "app", "api"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  const deletions = [...new Set(apiSource.match(/"[A-Z]+_DELETED"/g) ?? [])].map((quoted) =>
    quoted.slice(1, -1),
  );

  assert.ok(deletions.length >= 5, `found ${deletions.join(", ")}`);
  assert.deepEqual(
    deletions.filter((type) => !isAuditActivityType(type)),
    [],
  );
});

test("dynamic system-admin types are audit; routine events are not", () => {
  for (const type of [
    "SYSTEM_ADMIN_SUBSCRIPTION_END_NOW",
    "SYSTEM_ADMIN_TENANT_SUSPENDED",
    "PAYMENT_UPDATED",
    "BILLING_PLAN_CHANGED",
    "TEAM_MEMBER_UPDATED",
    "PASSWORD_RESET",
  ]) {
    assert.equal(isAuditActivityType(type), true, type);
  }

  for (const type of ["CASE_UPDATED", "DOCUMENT_VIEWED", "AI_CHAT_USED", "TASK_CREATED"]) {
    assert.equal(isAuditActivityType(type), false, type);
  }
});
