import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeDigits, toLatinDigits } from "@/lib/digits";
import { clientSchema } from "@/lib/validations";

// Phone number and national ID: what the input keeps (typing and pasting)
// and what the server accepts.

test("toLatinDigits: Arabic-Indic and Persian digits become 0-9, the rest stays", () => {
  assert.equal(toLatinDigits("٠١٢٣٤٥٦٧٨٩"), "0123456789");
  assert.equal(toLatinDigits("۰۱۲۳۴۵۶۷۸۹"), "0123456789");
  assert.equal(toLatinDigits("+٩٦٢ 79"), "+962 79");
});

test("sanitizeDigits: keeps digits only, a leading 0 included, cut at 10", () => {
  assert.equal(sanitizeDigits("0791234567"), "0791234567");
  assert.equal(sanitizeDigits("٠٧٩١٢٣٤٥٦٧"), "0791234567");
  assert.equal(sanitizeDigits("079 123-4567"), "0791234567");
  assert.equal(sanitizeDigits("abc07x9"), "079");
  assert.equal(sanitizeDigits("07912345678999"), "0791234567");
  assert.equal(sanitizeDigits(""), "");
});

const validClient = { name: "Client", phone: "0791234567", nationalId: "9991234567" };

test("server: phone and national ID must be exactly 10 digits", () => {
  assert.equal(clientSchema.safeParse(validClient).success, true);

  for (const field of ["phone", "nationalId"] as const) {
    for (const bad of ["079123456", "07912345678", "079 123 4567", "+962791234", "07912a4567", "", undefined]) {
      assert.equal(
        clientSchema.safeParse({ ...validClient, [field]: bad }).success,
        false,
        `${field}=${bad}`,
      );
    }
  }
});

test("server: Arabic-Indic digits are accepted and stored as Latin digits", () => {
  const parsed = clientSchema.safeParse({ ...validClient, phone: "٠٧٩١٢٣٤٥٦٧" });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.phone, "0791234567");
});

test("server: the messages name the field, in Arabic", () => {
  const parsed = clientSchema.safeParse({ ...validClient, phone: "079", nationalId: "1" });
  assert.equal(parsed.success, false);
  const messages = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
  assert.deepEqual(messages, [
    "يجب أن يتكون رقم الهاتف من 10 أرقام",
    "يجب أن يتكون الرقم الوطني من 10 أرقام",
  ]);
});
