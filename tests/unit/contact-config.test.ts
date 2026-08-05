import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COMPANY_CONTACT } from "../../src/config/contact";

test("official Aqua Tech contact addresses stay canonical", () => {
  assert.equal(COMPANY_CONTACT.infoEmail, "info@aquatechagency.com");
  assert.equal(COMPANY_CONTACT.supportEmail, "support@aquatechagency.com");
  assert.notEqual(COMPANY_CONTACT.infoEmail, COMPANY_CONTACT.supportEmail);
});

test("public and transactional contact surfaces use the canonical addresses", () => {
  const legalShell = readFileSync(
    "src/components/legal/LegalPageShell.tsx",
    "utf8",
  );
  const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");
  const terms = readFileSync("src/app/terms/page.tsx", "utf8");
  const subscription = readFileSync(
    "src/app/subscription-policy/page.tsx",
    "utf8",
  );
  const homepage = readFileSync("src/app/page.tsx", "utf8");
  const email = readFileSync("src/lib/email.ts", "utf8");

  for (const source of [legalShell, privacy, terms, subscription, homepage]) {
    assert.doesNotMatch(source, /info\.aquatech\.jo@gmail\.com/i);
  }

  assert.match(legalShell, /COMPANY_CONTACT\.infoEmail/);
  assert.match(legalShell, /COMPANY_CONTACT\.supportEmail/);
  assert.match(privacy, /support@aquatechagency\.com/);
  assert.match(terms, /info@aquatechagency\.com/);
  assert.match(terms, /support@aquatechagency\.com/);
  assert.match(subscription, /support@aquatechagency\.com/);
  assert.match(homepage, /COMPANY_CONTACT\.infoEmail/);
  assert.match(homepage, /COMPANY_CONTACT\.supportEmail/);
  assert.match(email, /reply_to: getEmailReplyTo\(\)/);
});
