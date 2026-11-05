import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "@/lib/utils";
import { tenantSlugBase } from "@/lib/tenant-slug";

test("slugify keeps Latin letters and digits, joined by single dashes", () => {
  assert.equal(slugify("Aqua Law Office"), "aqua-law-office");
  assert.equal(slugify("  Al-Mansouri   & Partners  "), "al-mansouri-partners");
  assert.equal(slugify("Café Légal"), "cafe-legal");
  assert.equal(slugify("Office_2026"), "office-2026");
  assert.equal(slugify("مكتب Hamza للمحاماة"), "hamza");
  assert.equal(slugify("مكتب 7 للمحاماة"), "7");
  assert.equal(slugify("a".repeat(39) + " b"), "a".repeat(39));
});

test("slugify returns nothing for a name with no Latin letter or digit", () => {
  for (const name of ["مكتب حمزة الحديدي", "مكتب   المحاماة", "---", "   ", ""]) {
    assert.equal(slugify(name), "", JSON.stringify(name));
  }
});

test("an Arabic office name gets office-<8 random base36>, not dashes", () => {
  const a = tenantSlugBase("مكتب حمزة الحديدي");
  const b = tenantSlugBase("مكتب حمزة الحديدي");
  assert.match(a, /^office-[a-z0-9]{8}$/);
  assert.match(b, /^office-[a-z0-9]{8}$/);
  assert.notEqual(a, b);
});

test("a Latin office name keeps its readable slug", () => {
  assert.equal(tenantSlugBase("Aqua Law"), "aqua-law");
});
