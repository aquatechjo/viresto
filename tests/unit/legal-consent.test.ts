import assert from "node:assert/strict";
import test from "node:test";
import { registerSchema } from "../../src/lib/validations";

const validRegistration = {
  tenantName: "مكتب العدالة",
  name: "أحمد محمد",
  email: "ahmad@example.com",
  phone: "0799999999",
  password: "Strong@123",
  acceptTerms: true,
  acceptPrivacy: true,
};

test("registration requires explicit terms and privacy acceptance", () => {
  assert.equal(registerSchema.safeParse(validRegistration).success, true);
  assert.equal(
    registerSchema.safeParse({
      ...validRegistration,
      acceptTerms: false,
    }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({
      ...validRegistration,
      acceptPrivacy: false,
    }).success,
    false,
  );
});

test("registration does not treat missing legal acceptance as consent", () => {
  const { acceptTerms: _terms, acceptPrivacy: _privacy, ...withoutConsent } =
    validRegistration;

  assert.equal(registerSchema.safeParse(withoutConsent).success, false);
});
