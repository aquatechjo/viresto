import { test } from "node:test";
import assert from "node:assert/strict";
import { TRIAL_DAYS, isPlanCode, trialLimitsNote } from "../../src/lib/trial-copy";
import { APP_TRIAL_DAYS } from "../../src/lib/tenant-access";
import { getPlanByCode } from "../../src/config/plans";

// AUDIT_REPORT.md M1: the trial is honest about running on Pro limits,
// whatever plan was picked on the website.

test("the copy uses the real trial length and Pro's real limits", () => {
  assert.equal(TRIAL_DAYS, APP_TRIAL_DAYS);

  const pro = getPlanByCode("PRO")!;
  for (const isArabic of [true, false]) {
    const note = trialLimitsNote(isArabic, null);
    assert.ok(note.includes(String(pro.limits.users)));
    assert.ok(note.includes(pro.limits.clients.toLocaleString("en-US")));
    assert.ok(note.includes(`${pro.limits.storageGb}GB`));
    assert.ok(note.includes("Pro"));
  }
});

test("a visitor who picked Business is told the trial runs on Pro limits and Business waits for them", () => {
  const ar = trialLimitsNote(true, "BUSINESS");
  assert.match(ar, /اخترت خطة Business/);
  assert.match(ar, /بحدود خطة Pro/);
  assert.match(ar, /محددة لك/);

  const en = trialLimitsNote(false, "BASIC");
  assert.match(en, /You picked Basic/);
  assert.match(en, /on Pro limits/);
  assert.match(en, /Basic is preselected/);
});

test("only the three plan codes are accepted", () => {
  assert.equal(isPlanCode("BUSINESS"), true);
  assert.equal(isPlanCode("business"), false);
  assert.equal(isPlanCode("ENTERPRISE"), false);
  assert.equal(isPlanCode(undefined), false);
});

test("on the trial card the note speaks to an office already on its trial", () => {
  const ar = trialLimitsNote(true, "BUSINESS", "during");
  assert.match(ar, /كل الميزات مفتوحة في تجربتك/);
  assert.match(ar, /اخترت خطة Business عند التسجيل/);

  assert.doesNotMatch(trialLimitsNote(false, "PRO", "during"), /You picked/);
  assert.doesNotMatch(trialLimitsNote(false, null, "during"), /You start/);
});
