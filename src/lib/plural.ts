// Count sentences ("3 مهام", "مهمتان", "1 task") in both languages.
// Arabic follows the CLDR plural categories, decided by hand so the result
// never depends on the runtime's ICU data:
//   zero  0                 "لا توجد مهام"
//   one   1                 "مهمة واحدة"
//   two   2                 "مهمتان"
//   few   n % 100 = 3..10   "{n} مهام"
//   many  n % 100 = 11..99  "{n} مهمة"
//   other 100, 101, 102 …   "{n} مهمة" (falls back to many)
// "{n}" in a form is replaced by the count in Latin digits ("1,250").

import type { Locale } from "@/lib/i18n";

export type ArabicPluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

export type ArabicPluralForms = {
  zero: string;
  one: string;
  two: string;
  few: string;
  many: string;
  other?: string;
};

export type EnglishPluralForms = {
  zero?: string;
  one: string;
  other: string;
};

export type PluralForms = { ar: ArabicPluralForms; en: EnglishPluralForms };

const countFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatCount(count: number) {
  return countFormatter.format(count);
}

export function arabicPluralCategory(count: number): ArabicPluralCategory {
  if (!Number.isInteger(count) || count < 0) return "other";
  if (count === 0) return "zero";
  if (count === 1) return "one";
  if (count === 2) return "two";

  const lastTwo = count % 100;
  if (lastTwo >= 3 && lastTwo <= 10) return "few";
  if (lastTwo >= 11 && lastTwo <= 99) return "many";
  return "other";
}

function fill(form: string, count: number) {
  return form.replace(/\{n\}/g, formatCount(count));
}

export function pluralizeAr(count: number, forms: ArabicPluralForms) {
  const category = arabicPluralCategory(count);
  const form = category === "other" ? forms.other ?? forms.many : forms[category];
  return fill(form, count);
}

export function pluralizeEn(count: number, forms: EnglishPluralForms) {
  if (count === 0 && forms.zero !== undefined) return fill(forms.zero, count);
  return fill(count === 1 ? forms.one : forms.other, count);
}

export function pluralize(locale: Locale, count: number, forms: PluralForms) {
  return locale === "ar" ? pluralizeAr(count, forms.ar) : pluralizeEn(count, forms.en);
}
