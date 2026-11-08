/**
 * An amount in Jordanian dinars written in words, for receipts:
 * "مئتان وخمسون ديناراً وخمسمئة فلس" / "Two hundred fifty dinars and five
 * hundred fils". 1 dinar = 1000 fils (amounts are stored to 3 decimals).
 *
 * Arabic rules (counted nouns are masculine: دينار, فلس, ألف, مليون):
 * - 1 and 2 alone: "دينار واحد", "ديناران".
 * - 3 to 10: the plural, "ثلاثة دنانير", "ثلاثة آلاف".
 * - 11 to 99: the singular with tanween, "أحد عشر ديناراً", "عشرون ألفاً".
 * - a round hundred, thousand or million: the singular, "مئة دينار",
 *   "ألف دينار", "مليون دينار".
 * - a dual directly before its noun drops its nun: "مئتا دينار",
 *   "ألفا دينار", "مليونا دينار", "مئتا ألف"; inside a longer number it
 *   keeps it: "مئتان وخمسون", "ألفان وخمسمئة".
 * - a number above 100 ending in 1 or 2 takes the singular:
 *   "مئة وواحد دينار".
 */

type Noun = {
  /** genitive singular, after 100, 1000 and after a dual in construct */
  single: string;
  /** after 1 alone: "دينار واحد" */
  one: string;
  /** 2 alone */
  dual: string;
  /** 3 to 10 */
  plural: string;
  /** 11 to 99 */
  accusative: string;
};

const DINAR: Noun = {
  single: "دينار",
  one: "دينار واحد",
  dual: "ديناران",
  plural: "دنانير",
  accusative: "ديناراً",
};

const FILS: Noun = {
  single: "فلس",
  one: "فلس واحد",
  dual: "فلسان",
  plural: "فلوس",
  accusative: "فلساً",
};

// Scale words, with the forms used inside a number and in construct
// (directly before the counted noun).
const SCALES = [
  null,
  { single: "ألف", dual: "ألفان", dualConstruct: "ألفا", plural: "آلاف", accusative: "ألفاً" },
  { single: "مليون", dual: "مليونان", dualConstruct: "مليونا", plural: "ملايين", accusative: "مليوناً" },
  { single: "مليار", dual: "ملياران", dualConstruct: "مليارا", plural: "مليارات", accusative: "ملياراً" },
] as const;

const UNITS = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];

/** 1..999 in words; `construct` = directly before its noun (مئتا). */
function arabicBelowThousand(n: number, construct: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];

  if (hundreds) {
    parts.push(hundreds === 2 && rest === 0 && construct ? "مئتا" : HUNDREDS[hundreds]);
  }

  if (rest) {
    if (rest < 10) parts.push(UNITS[rest]);
    else if (rest < 20) parts.push(TEENS[rest - 10]);
    else {
      const unit = rest % 10;
      const ten = TENS[Math.floor(rest / 10)];
      parts.push(unit ? `${UNITS[unit]} و${ten}` : ten);
    }
  }

  return parts.join(" و");
}

/** The noun form a count of `n` (the last 0..999 group) takes. */
function nounFor(lastGroup: number, total: number, noun: Pick<Noun, "single" | "plural" | "accusative">) {
  if (total <= 2) return null; // handled by the caller
  const rest = lastGroup % 100;
  if (rest === 0 || rest <= 2) return noun.single;
  if (rest <= 10) return noun.plural;
  return noun.accusative;
}

/** A positive whole number with its counted noun, in Arabic. */
function arabicCount(total: number, noun: Noun): string {
  if (total === 1) return noun.one;
  if (total === 2) return noun.dual;

  const groups: number[] = [];
  for (let n = total; n > 0; n = Math.floor(n / 1000)) groups.push(n % 1000);

  // The lowest non-zero group is the one written directly before the noun.
  const lowest = groups.findIndex((g) => g !== 0);
  const parts: string[] = [];

  for (let i = groups.length - 1; i >= 0; i--) {
    const count = groups[i];
    if (!count) continue;
    const last = i === lowest;

    if (i === 0) {
      parts.push(arabicBelowThousand(count, last));
      continue;
    }

    const scale = SCALES[i];
    if (!scale) throw new Error("AMOUNT_TOO_LARGE");

    if (count === 1) parts.push(scale.single);
    else if (count === 2) parts.push(last ? scale.dualConstruct : scale.dual);
    else {
      const rest = count % 100;
      const word =
        rest >= 3 && rest <= 10
          ? scale.plural
          : rest >= 11
            ? last
              ? scale.single // "أحد عشر ألف دينار"
              : scale.accusative // "أحد عشر ألفاً وخمسمئة"
            : scale.single; // round hundreds, or ending in 1/2
      // The count is directly before its scale word: "مئتا ألف".
      parts.push(`${arabicBelowThousand(count, true)} ${word}`);
    }
  }

  // The noun follows the lowest group. A round scale ("ألف", "مئتا ألف",
  // "ثلاثة آلاف") is followed by the genitive singular.
  const lowestCount = groups[lowest];
  const scaleWordEnds = lowest > 0;
  const nounWord = scaleWordEnds
    ? noun.single
    : (nounFor(lowestCount, total, noun) ?? noun.single);

  return `${parts.join(" و")} ${nounWord}`;
}

function splitAmount(amount: number | string): { dinars: number; fils: number } {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new Error("INVALID_AMOUNT");
  const totalFils = Math.round(value * 1000);
  if (!Number.isSafeInteger(totalFils)) throw new Error("AMOUNT_TOO_LARGE");
  return { dinars: Math.floor(totalFils / 1000), fils: totalFils % 1000 };
}

export function amountInArabicWords(amount: number | string): string {
  const { dinars, fils } = splitAmount(amount);
  const parts: string[] = [];
  if (dinars) parts.push(arabicCount(dinars, DINAR));
  if (fils) parts.push(arabicCount(fils, FILS));
  return parts.length ? parts.join(" و") : `صفر ${DINAR.single}`;
}

// English ---------------------------------------------------------------

const EN_UNITS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const EN_SCALES = ["", "thousand", "million", "billion"];

function englishBelowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${EN_UNITS[hundreds]} hundred`);
  if (rest) {
    if (rest < 20) parts.push(EN_UNITS[rest]);
    else {
      const unit = rest % 10;
      parts.push(unit ? `${EN_TENS[Math.floor(rest / 10)]}-${EN_UNITS[unit]}` : EN_TENS[Math.floor(rest / 10)]);
    }
  }
  return parts.join(" ");
}

function englishNumber(n: number): string {
  const parts: string[] = [];
  for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
    const group = n % 1000;
    if (!group) continue;
    if (i >= EN_SCALES.length) throw new Error("AMOUNT_TOO_LARGE");
    parts.unshift(EN_SCALES[i] ? `${englishBelowThousand(group)} ${EN_SCALES[i]}` : englishBelowThousand(group));
  }
  return parts.join(" ");
}

export function amountInEnglishWords(amount: number | string): string {
  const { dinars, fils } = splitAmount(amount);
  const parts: string[] = [];
  if (dinars) parts.push(`${englishNumber(dinars)} ${dinars === 1 ? "dinar" : "dinars"}`);
  if (fils) parts.push(`${englishNumber(fils)} fils`);
  const text = parts.length ? parts.join(" and ") : "zero dinars";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
