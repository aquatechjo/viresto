import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateAiTokenBudget,
  getAiUsagePeriod,
  normalizeActualTokenUsage,
} from "../../src/lib/ai-usage-core";

test("AI usage periods reset at Amman month boundaries", () => {
  const july = getAiUsagePeriod(new Date("2026-06-30T21:00:00.000Z"));

  assert.equal(july.start.toISOString(), "2026-06-30T21:00:00.000Z");
  assert.equal(july.end.toISOString(), "2026-07-31T21:00:00.000Z");

  const june = getAiUsagePeriod(new Date("2026-06-30T20:59:59.999Z"));

  assert.equal(june.start.toISOString(), "2026-05-31T21:00:00.000Z");
  assert.equal(june.end.toISOString(), "2026-06-30T21:00:00.000Z");
});

test("AI token budgets conservatively include prompt and completion", () => {
  assert.equal(estimateAiTokenBudget(["1234", "567"], 500), 763);
  assert.equal(estimateAiTokenBudget([], 0), 256);
});

test("AI usage falls back to the reservation when provider usage is missing", () => {
  assert.equal(normalizeActualTokenUsage(123, 1_000), 123);
  assert.equal(normalizeActualTokenUsage(null, 1_000), 1_000);
  assert.equal(normalizeActualTokenUsage(0, 1_000), 1_000);
  assert.equal(normalizeActualTokenUsage(1.5, 1_000), 1_000);
});
