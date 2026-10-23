import assert from "node:assert/strict";
import test from "node:test";
import {
  arabicPluralCategory,
  pluralize,
  pluralizeAr,
  pluralizeEn,
} from "../../src/lib/plural";

const TASKS = {
  zero: "لا مهام",
  one: "مهمة واحدة",
  two: "مهمتان",
  few: "{n} مهام",
  many: "{n} مهمة",
};

test("Arabic plural categories follow CLDR for whole numbers", () => {
  const cases: Array<[number, string]> = [
    [0, "zero"],
    [1, "one"],
    [2, "two"],
    [3, "few"],
    [10, "few"],
    [11, "many"],
    [99, "many"],
    [100, "other"],
    [101, "other"],
    [102, "other"],
    [103, "few"],
    [110, "few"],
    [111, "many"],
    [1000, "other"],
  ];

  for (const [count, category] of cases) {
    assert.equal(arabicPluralCategory(count), category, String(count));
  }
});

test("fractions and negative counts fall back to other", () => {
  assert.equal(arabicPluralCategory(1.5), "other");
  assert.equal(arabicPluralCategory(-1), "other");
});

test("pluralizeAr picks the right form and writes Latin digits", () => {
  assert.equal(pluralizeAr(0, TASKS), "لا مهام");
  assert.equal(pluralizeAr(1, TASKS), "مهمة واحدة");
  assert.equal(pluralizeAr(2, TASKS), "مهمتان");
  assert.equal(pluralizeAr(5, TASKS), "5 مهام");
  assert.equal(pluralizeAr(11, TASKS), "11 مهمة");
  assert.equal(pluralizeAr(1250, TASKS), "1,250 مهمة");
  assert.doesNotMatch(pluralizeAr(5, TASKS), /[٠-٩]/);
});

test("pluralizeAr uses many for other unless an other form is given", () => {
  assert.equal(pluralizeAr(100, TASKS), "100 مهمة");
  assert.equal(pluralizeAr(100, { ...TASKS, other: "{n} من المهام" }), "100 من المهام");
});

test("pluralizeEn uses one, other and an optional zero", () => {
  const forms = { one: "1 task", other: "{n} tasks" };
  assert.equal(pluralizeEn(1, forms), "1 task");
  assert.equal(pluralizeEn(0, forms), "0 tasks");
  assert.equal(pluralizeEn(0, { ...forms, zero: "No tasks" }), "No tasks");
  assert.equal(pluralizeEn(12, forms), "12 tasks");
});

test("pluralize switches on the locale", () => {
  const forms = { ar: TASKS, en: { one: "1 task", other: "{n} tasks" } };
  assert.equal(pluralize("ar", 3, forms), "3 مهام");
  assert.equal(pluralize("en", 3, forms), "3 tasks");
});
