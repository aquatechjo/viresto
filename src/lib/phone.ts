// One phone number format for the whole app: E.164 ("+962791234567").
//
// Every phone that is saved, encrypted, hashed for search or compared goes
// through normalizePhone first, so "0791234567", "+962 79 123 4567",
// "00962791234567" and "٠٧٩١٢٣٤٥٦٧" are the same number everywhere. What a
// user reads goes through formatPhoneForDisplay.
//
// Accepted:
// - Jordanian mobiles: 07XXXXXXXX, 7XXXXXXXX, 9627XXXXXXXX, 009627..., +9627...
// - Jordanian landlines: 0[2356] + 7 digits (and the same with 962 / 00962 / +962)
// - Any other country, written with its code after "+" or "00": 8 to 15
//   digits in all (E.164), the first one not 0.
// Shared by the browser (inputs) and the server: no Node-only imports.

import { toLatinDigits } from "@/lib/digits";

export const JORDAN_COUNTRY_CODE = "962";

// Longest phone an input keeps, separators included ("+962 79 123 4567").
export const PHONE_INPUT_MAX = 24;

export const PHONE_INVALID_MESSAGE =
  "رقم الهاتف غير صالح: أدخل رقمًا أردنيًا مثل 0791234567 أو رقمًا دوليًا يبدأ بـ + أو 00";
export const PHONE_INVALID_MESSAGE_EN =
  "Invalid phone number: enter a Jordanian number such as 0791234567, or an international one starting with + or 00";

// Jordanian national numbers, without the trunk 0: mobiles 7XXXXXXXX,
// landlines [2356]XXXXXXX (Amman 6, north 2, south 3, centre 5).
const JORDAN_MOBILE = /^7\d{8}$/;
const JORDAN_LANDLINE = /^[2356]\d{7}$/;

// Spaces of every kind, dashes, dots, brackets and the invisible direction
// marks that RTL text pastes around numbers.
const SEPARATORS = /[\s ‎‏‪-‮⁦-⁩().\-‐-―]/g;

function jordanNational(digits: string) {
  // "+962 079..." happens: drop one trunk 0 after the country code.
  const national = digits.startsWith("0") ? digits.slice(1) : digits;
  return JORDAN_MOBILE.test(national) || JORDAN_LANDLINE.test(national)
    ? national
    : null;
}

/**
 * The E.164 form of a phone number ("+962791234567"), or null when it is
 * empty or not a phone number this app accepts. Idempotent.
 */
export function normalizePhone(value?: string | null): string | null {
  if (typeof value !== "string") return null;

  const cleaned = toLatinDigits(value).replace(SEPARATORS, "");
  if (!cleaned) return null;

  let international: string | null = null;
  if (/^\+\d+$/.test(cleaned)) international = cleaned.slice(1);
  else if (/^00\d+$/.test(cleaned)) international = cleaned.slice(2);
  else if (!/^\d+$/.test(cleaned)) return null;

  if (international === null) {
    // No "+" or "00": a Jordanian number, local or with 962 in front.
    if (cleaned.startsWith(JORDAN_COUNTRY_CODE) && cleaned.length >= 11) {
      const national = jordanNational(cleaned.slice(JORDAN_COUNTRY_CODE.length));
      return national ? `+${JORDAN_COUNTRY_CODE}${national}` : null;
    }

    const local = /^0[2356]\d{7}$/.test(cleaned) || /^07\d{8}$/.test(cleaned)
      ? cleaned.slice(1)
      : JORDAN_MOBILE.test(cleaned)
        ? cleaned
        : null;
    return local ? `+${JORDAN_COUNTRY_CODE}${local}` : null;
  }

  if (international.startsWith(JORDAN_COUNTRY_CODE)) {
    const national = jordanNational(international.slice(JORDAN_COUNTRY_CODE.length));
    return national ? `+${JORDAN_COUNTRY_CODE}${national}` : null;
  }

  // E.164: at most 15 digits, country codes never start with 0. 8 is a
  // sane floor (the shortest real numbers, with their country code).
  if (!/^[1-9]\d{7,14}$/.test(international)) return null;
  return `+${international}`;
}

export function isValidPhone(value?: string | null) {
  return normalizePhone(value) !== null;
}

/**
 * How a phone number is shown: Jordanian numbers in their local, readable
 * form ("079 123 4567", "06 512 3456"), others in E.164 ("+966501234567").
 * Anything that is not a valid number (older data) is shown unchanged.
 *
 * In right-to-left text the groups of "079 123 4567" would be laid out in
 * reverse, and "+966..." would show its "+" at the end. Show the result
 * in a dir="ltr" element, or pass `{ isolate: true }` to wrap it in
 * left-to-right isolate marks where only a string fits (normalizePhone
 * strips them again if the text is pasted back).
 */
export function formatPhoneForDisplay(
  value?: string | null,
  options: { isolate?: boolean } = {},
): string {
  if (!value) return "";
  const normalized = normalizePhone(value);
  let shown = normalized ?? value;

  const jordan = `+${JORDAN_COUNTRY_CODE}`;
  if (normalized?.startsWith(jordan)) {
    const local = `0${normalized.slice(jordan.length)}`;
    shown = local.length === 10
      ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
      : `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
  }

  return options.isolate ? `⁦${shown}⁩` : shown;
}

/** What a phone input keeps: Latin digits, a leading "+", and separators. */
export function sanitizePhoneInput(value: string) {
  const latin = toLatinDigits(value);
  const plus = latin.trimStart().startsWith("+") ? "+" : "";
  const rest = latin.replace(/[^\d\s()\-]/g, "").replace(/^\s+/, "");
  return (plus + rest).slice(0, PHONE_INPUT_MAX);
}
