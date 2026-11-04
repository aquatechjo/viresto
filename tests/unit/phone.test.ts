import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatPhoneForDisplay,
  isValidPhone,
  normalizePhone,
  sanitizePhoneInput,
} from "@/lib/phone";
import { normalizeNationalId } from "@/lib/digits";
import { clientSchema, registerSchema } from "@/lib/validations";
import { normalizeWhatsAppPhone } from "@/lib/invoice-print";

process.env.SEARCH_HASH_SECRET ||= "test-search-hash-secret";

// One phone format everywhere (E.164): what is encrypted, hashed and
// searched. Display is local for Jordanian numbers.

test("every form of a Jordanian mobile becomes the same E.164 number", () => {
  for (const input of [
    "0791234567",
    "791234567",
    "962791234567",
    "00962791234567",
    "+962791234567",
    "+962 79 123 4567",
    "079 123 4567",
    "079-123-4567",
    "(079) 123-4567",
    " 0791234567 ",
    "٠٧٩١٢٣٤٥٦٧",
    "۰۷۹۱۲۳۴۵۶۷",
    "+٩٦٢٧٩١٢٣٤٥٦٧",
    "‎+962 79 123 4567‏",
    "⁦079 123 4567⁩",
    "+962 0791234567", // trunk 0 kept after the country code
  ]) {
    assert.equal(normalizePhone(input), "+962791234567", JSON.stringify(input));
  }
});

test("Jordanian landlines (02/03/05/06 + 7 digits) are accepted", () => {
  assert.equal(normalizePhone("065123456"), "+96265123456");
  assert.equal(normalizePhone("06 512 3456"), "+96265123456");
  assert.equal(normalizePhone("+962 6 512 3456"), "+96265123456");
  assert.equal(normalizePhone("0096265123456"), "+96265123456");
  assert.equal(normalizePhone("96265123456"), "+96265123456");
  assert.equal(normalizePhone("027123456"), "+96227123456");
  assert.equal(normalizePhone("032123456"), "+96232123456");
  assert.equal(normalizePhone("053123456"), "+96253123456");
});

test("international numbers need their country code after + or 00", () => {
  // Saudi Arabia, Iraq, UAE, Syria.
  assert.equal(normalizePhone("+966501234567"), "+966501234567");
  assert.equal(normalizePhone("00966 50 123 4567"), "+966501234567");
  assert.equal(normalizePhone("+964 770 123 4567"), "+9647701234567");
  assert.equal(normalizePhone("+971501234567"), "+971501234567");
  assert.equal(normalizePhone("00963944123456"), "+963944123456");
  // A Saudi local number without its country code is not guessed at.
  assert.equal(normalizePhone("0501234567"), null);
});

test("anything else is rejected", () => {
  for (const input of [
    "",
    "   ",
    null,
    undefined,
    "079123456", // 9 digits starting 07
    "07912345678", // 11 digits
    "0812345678", // no such Jordanian prefix
    "04123456", // 04 is not a landline area
    "+9628123456789",
    "+962 79 123 456", // too short
    "+1234567", // 7 digits: below E.164's sensible floor
    "+1234567890123456", // 16 digits: above E.164's maximum
    "+0123456789",
    "0791234abc",
    "07912+34567",
    "++962791234567",
    "abc",
  ]) {
    assert.equal(normalizePhone(input), null, JSON.stringify(input));
    assert.equal(isValidPhone(input), false, JSON.stringify(input));
  }
});

test("normalizePhone is idempotent", () => {
  for (const input of ["0791234567", "065123456", "+966501234567"]) {
    const once = normalizePhone(input);
    assert.equal(normalizePhone(once), once);
  }
});

test("display: Jordanian numbers local and readable, others in E.164", () => {
  assert.equal(formatPhoneForDisplay("+962791234567"), "079 123 4567");
  assert.equal(formatPhoneForDisplay("0791234567"), "079 123 4567");
  assert.equal(formatPhoneForDisplay("+96265123456"), "06 512 3456");
  assert.equal(formatPhoneForDisplay("+966501234567"), "+966501234567");
  assert.equal(formatPhoneForDisplay("00966501234567"), "+966501234567");
  // Older data that is not a valid number is shown as it is.
  assert.equal(formatPhoneForDisplay("079-12"), "079-12");
  assert.equal(formatPhoneForDisplay(null), "");
  assert.equal(formatPhoneForDisplay(""), "");
});

test("display with isolate marks round-trips through normalizePhone", () => {
  const shown = formatPhoneForDisplay("+962791234567", { isolate: true });
  assert.equal(shown, "⁦079 123 4567⁩");
  assert.equal(normalizePhone(shown), "+962791234567");
});

test("the phone input keeps digits, a leading + and separators only", () => {
  assert.equal(sanitizePhoneInput("+962 79 123 4567"), "+962 79 123 4567");
  assert.equal(sanitizePhoneInput("٠٧٩١٢٣٤٥٦٧"), "0791234567");
  assert.equal(sanitizePhoneInput("07a9b1"), "0791");
  assert.equal(sanitizePhoneInput("79+1"), "791");
  assert.equal(sanitizePhoneInput("x".repeat(5) + "1".repeat(40)).length, 24);
});

test("national ID: one form for saving and search", () => {
  assert.equal(normalizeNationalId("9991234567"), "9991234567");
  assert.equal(normalizeNationalId(" 999 123 4567 "), "9991234567");
  assert.equal(normalizeNationalId("999-123-4567"), "9991234567");
  assert.equal(normalizeNationalId("٩٩٩١٢٣٤٥٦٧"), "9991234567");
  assert.equal(normalizeNationalId("أحمد"), null);
  assert.equal(normalizeNationalId("client@example.com"), null);
  assert.equal(normalizeNationalId(""), null);
  assert.equal(normalizeNationalId(null), null);
});

const validClient = { name: "Client", phone: "0791234567", nationalId: "9991234567" };

test("client schema: every accepted form is stored in E.164", () => {
  for (const [phone, stored] of [
    ["0791234567", "+962791234567"],
    ["+962 79 123 4567", "+962791234567"],
    ["06 512 3456", "+96265123456"],
    ["+966 50 123 4567", "+966501234567"],
  ] as const) {
    const parsed = clientSchema.safeParse({ ...validClient, phone });
    assert.equal(parsed.success, true, phone);
    assert.equal(parsed.success && parsed.data.phone, stored, phone);
  }
  for (const phone of ["079", "0501234567", "", undefined]) {
    assert.equal(clientSchema.safeParse({ ...validClient, phone }).success, false, String(phone));
  }
});

test("register schema: the same rules and the same E.164 form", () => {
  const base = {
    tenantName: "Office",
    name: "Owner",
    email: "owner@example.com",
    password: "Str0ng!Password",
    acceptTerms: true,
    acceptPrivacy: true,
  };
  for (const phone of ["0791234567", "+962791234567", "00962 79 123 4567"]) {
    const parsed = registerSchema.safeParse({ ...base, phone });
    assert.equal(parsed.success, true, phone);
    assert.equal(parsed.success && parsed.data.phone, "+962791234567", phone);
  }
  assert.equal(registerSchema.safeParse({ ...base, phone: "079" }).success, false);
});

test("the search hash of a saved phone equals the hash of every way to type it", async () => {
  const { hashSearchValue } = await import("@/lib/encryption");
  const parsed = clientSchema.safeParse(validClient);
  assert.equal(parsed.success, true);
  const saved = hashSearchValue(normalizePhone(parsed.success ? parsed.data.phone : ""));

  for (const typed of ["0791234567", "+962791234567", "00962791234567", "962791234567", "٠٧٩ ١٢٣ ٤٥٦٧"]) {
    assert.equal(hashSearchValue(normalizePhone(typed)), saved, typed);
  }
});

test("WhatsApp links use the E.164 digits", () => {
  assert.equal(normalizeWhatsAppPhone("+962791234567"), "962791234567");
  assert.equal(normalizeWhatsAppPhone("079 123 4567"), "962791234567");
  assert.equal(normalizeWhatsAppPhone("+966501234567"), "966501234567");
  assert.equal(normalizeWhatsAppPhone(""), "");
});
