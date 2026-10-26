// Digit-only fields (phone number, national ID): exactly 10 Latin digits.
// Shared by the inputs (DigitsInput) and the server schemas, so typing,
// pasting and the API all clean and check the value the same way.

export const DIGITS_FIELD_LENGTH = 10;
export const TEN_DIGITS = /^\d{10}$/;

export const PHONE_DIGITS_MESSAGE = "يجب أن يتكون رقم الهاتف من 10 أرقام";
export const NATIONAL_ID_DIGITS_MESSAGE = "يجب أن يتكون الرقم الوطني من 10 أرقام";

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → 0-9; everything else unchanged. */
export function toLatinDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (char) => {
    const code = char.charCodeAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}

/** What a digits input keeps: Latin digits only, at most `max` of them. */
export function sanitizeDigits(value: string, max = DIGITS_FIELD_LENGTH) {
  return toLatinDigits(value).replace(/\D/g, "").slice(0, max);
}
