import { test } from "node:test";
import assert from "node:assert/strict";
import { amountInArabicWords as ar, amountInEnglishWords as en } from "../../src/lib/amount-words";

// Receipt amounts in words (finance plan, batch 6): dinars and fils.

test("Arabic: the hard counts of a masculine noun", () => {
  const cases: Array<[number, string]> = [
    [1, "دينار واحد"],
    [2, "ديناران"],
    [3, "ثلاثة دنانير"],
    [7, "سبعة دنانير"],
    [10, "عشرة دنانير"],
    [11, "أحد عشر ديناراً"],
    [12, "اثنا عشر ديناراً"],
    [19, "تسعة عشر ديناراً"],
    [20, "عشرون ديناراً"],
    [21, "واحد وعشرون ديناراً"],
    [99, "تسعة وتسعون ديناراً"],
    [100, "مئة دينار"],
    [101, "مئة وواحد دينار"],
    [103, "مئة وثلاثة دنانير"],
    [111, "مئة وأحد عشر ديناراً"],
    [200, "مئتا دينار"],
    [250, "مئتان وخمسون ديناراً"],
    [300, "ثلاثمئة دينار"],
    [1000, "ألف دينار"],
    [1500, "ألف وخمسمئة دينار"],
    [2000, "ألفا دينار"],
    [2500, "ألفان وخمسمئة دينار"],
    [3000, "ثلاثة آلاف دينار"],
    [10000, "عشرة آلاف دينار"],
    [11000, "أحد عشر ألف دينار"],
    [11500, "أحد عشر ألفاً وخمسمئة دينار"],
    [100000, "مئة ألف دينار"],
    [200000, "مئتا ألف دينار"],
    [250000, "مئتان وخمسون ألف دينار"],
    [1000000, "مليون دينار"],
    [2000000, "مليونا دينار"],
    [3000000, "ثلاثة ملايين دينار"],
    [1250000, "مليون ومئتان وخمسون ألف دينار"],
  ];
  for (const [amount, words] of cases) {
    assert.equal(ar(amount), words, String(amount));
  }
});

test("Arabic: with fils and without", () => {
  assert.equal(ar(250.5), "مئتان وخمسون ديناراً وخمسمئة فلس");
  assert.equal(ar("250.500"), "مئتان وخمسون ديناراً وخمسمئة فلس");
  assert.equal(ar(1.001), "دينار واحد وفلس واحد");
  assert.equal(ar(2.002), "ديناران وفلسان");
  assert.equal(ar(3.005), "ثلاثة دنانير وخمسة فلوس");
  assert.equal(ar(11.011), "أحد عشر ديناراً وأحد عشر فلساً");
  assert.equal(ar(100.1), "مئة دينار ومئة فلس");
  assert.equal(ar(1000.25), "ألف دينار ومئتان وخمسون فلساً");
  assert.equal(ar(2000.2), "ألفا دينار ومئتا فلس");
  assert.equal(ar(1000000.999), "مليون دينار وتسعمئة وتسعة وتسعون فلساً");
  assert.equal(ar(0.5), "خمسمئة فلس");
  assert.equal(ar(400), "أربعمئة دينار");
});

test("English", () => {
  assert.equal(en(1), "One dinar");
  assert.equal(en(2), "Two dinars");
  assert.equal(en(11), "Eleven dinars");
  assert.equal(en(250.5), "Two hundred fifty dinars and five hundred fils");
  assert.equal(en(2000), "Two thousand dinars");
  assert.equal(en(1000000), "One million dinars");
  assert.equal(en(1.001), "One dinar and one fils");
  assert.equal(en(0.5), "Five hundred fils");
  assert.equal(en(1250021.05), "One million two hundred fifty thousand twenty-one dinars and fifty fils");
});

test("invalid amounts are refused", () => {
  assert.throws(() => ar(-1));
  assert.throws(() => ar(Number.NaN));
  assert.throws(() => en("abc"));
});
