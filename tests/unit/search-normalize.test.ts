import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  containsNormalized,
  normalizeSearchText,
  prepareSearchQuery,
  searchableFields,
} from "@/lib/search-normalize";

// Global search: Arabic spelling variants fold to one form, on the query in
// JS and on the columns in SQL, so either spelling finds the other.

test("hamza forms of alef fold to bare alef", () => {
  assert.equal(normalizeSearchText("أموال"), "اموال");
  assert.equal(normalizeSearchText("إدارة"), normalizeSearchText("اداره"));
  assert.equal(normalizeSearchText("آمنة"), normalizeSearchText("امنه"));
  assert.equal(normalizeSearchText("ٱلقضية"), normalizeSearchText("القضيه"));
});

test("taa marbuta, alef maqsura, waw and yaa hamza fold", () => {
  assert.equal(normalizeSearchText("بنكية"), "بنكيه");
  assert.equal(normalizeSearchText("مصطفى"), "مصطفي");
  assert.equal(normalizeSearchText("مسؤول"), normalizeSearchText("مسوول"));
  assert.equal(normalizeSearchText("قائمة"), normalizeSearchText("قايمه"));
});

test("harakat, superscript alef and tatweel are removed", () => {
  assert.equal(normalizeSearchText("اِخْتِلَاس"), "اختلاس");
  assert.equal(normalizeSearchText("مُحَمَّدٌ"), "محمد");
  assert.equal(normalizeSearchText("هٰذا"), "هذا");
  assert.equal(normalizeSearchText("اخـــتلاس"), "اختلاس");
});

test("digits become Latin, Latin letters lowercase, spaces collapse", () => {
  assert.equal(normalizeSearchText("٦٥٩٢٦"), "65926");
  assert.equal(normalizeSearchText("۶۵۹۲۶"), "65926");
  assert.equal(normalizeSearchText("  INV-2026   0042 "), "inv-2026 0042");
});

test("the example case title is found by either spelling", () => {
  const title = normalizeSearchText("اختلاس اموال بنكية");
  for (const query of ["اختلاس", "أموال", "اموال", "بنكيه", "إختلاس"]) {
    assert.ok(title.includes(normalizeSearchText(query)), query);
  }
});

test("prepareSearchQuery: at least two characters after folding", () => {
  assert.equal(prepareSearchQuery(""), null);
  assert.equal(prepareSearchQuery(null), null);
  assert.equal(prepareSearchQuery("  ا "), null);
  assert.equal(prepareSearchQuery("ـاـ"), null);
  assert.equal(prepareSearchQuery("اَ"), null);
  assert.deepEqual(prepareSearchQuery(" أم "), { raw: "أم", needle: "ام", number: null });
});

test("prepareSearchQuery: a whole number is also matched as a public id", () => {
  assert.deepEqual(prepareSearchQuery("٦٥٩٢٦"), {
    raw: "65926",
    needle: "65926",
    number: 65926,
  });
  assert.equal(prepareSearchQuery("00")?.number, null);
  assert.equal(prepareSearchQuery("12-34")?.number, null);
  assert.equal(prepareSearchQuery("1234567890")?.number, null);
});

test("prepareSearchQuery: long input is cut at 100 characters", () => {
  assert.equal(prepareSearchQuery("ا".repeat(500))?.raw.length, 100);
});

test("SQL: the query is a bound parameter, never part of the SQL text", () => {
  const needle = "'; DROP TABLE \"Case\"; --";
  const sql = containsNormalized(
    searchableFields(Prisma.sql`k."title"`, Prisma.sql`c."name"`),
    needle,
  );

  assert.ok(!sql.sql.includes("DROP"));
  assert.ok(sql.values.includes(needle));
  assert.match(sql.sql, /strpos\(regexp_replace\(translate\(lower\(concat_ws\(E'\\n', k\."title",c\."name"\)\)/);
});

test("SQL: folds with the same character map as the JS side", () => {
  const sql = containsNormalized(Prisma.sql`x`, "ab");
  const [from, to, strip] = sql.values as string[];

  assert.equal(from.length, to.length);
  for (let i = 0; i < from.length; i++) {
    assert.equal(normalizeSearchText(from[i]), to[i], `${from[i]} → ${to[i]}`);
  }
  assert.equal(strip, "[\\u064B-\\u065F\\u0670\\u0640]");
});
