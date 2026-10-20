import assert from "node:assert/strict";
import test from "node:test";
import { renderVerificationEmail } from "../../src/lib/email/verification-email";
import { EMAIL_VERIFICATION_TTL_MINUTES } from "../../src/lib/verification-policy";

test("the subject starts with the code, so it shows in the notification", () => {
  const { subject } = renderVerificationEmail({ code: "642332" });
  assert.match(subject, /^642332 /);
});

test("the expiry comes from the backend's constant", () => {
  const { html, text } = renderVerificationEmail({ code: "642332" });
  const minutes = `${EMAIL_VERIFICATION_TTL_MINUTES} دقائق`;
  assert.ok(html.includes(`ينتهي الرمز خلال ${minutes}`), "html");
  assert.ok(text.includes(`ينتهي خلال ${minutes}`), "text");
});

test("the code stays on one line, left to right, inside the dark email", () => {
  const { html } = renderVerificationEmail({ code: "642332" });
  const codeCell = html.indexOf('class="code"');
  const cell = html.slice(html.lastIndexOf("<td", codeCell), html.indexOf("642332", codeCell) + 6);

  assert.match(html, /<html lang="ar" dir="rtl"/);
  assert.match(html, /<meta name="color-scheme" content="dark">/);
  assert.match(cell, /dir="ltr"/);
  assert.match(cell, /white-space:nowrap/);
});

test("a plain-text version carries the code", () => {
  const { text } = renderVerificationEmail({ code: "642332" });
  assert.match(text, /رمز التأكيد: 642332/);
});

test("only digits reach the HTML (nothing injectable)", () => {
  const { html, subject } = renderVerificationEmail({ code: "12<b>34</b>56" });
  assert.ok(!html.includes("<b>34"));
  assert.match(subject, /^123456 /);
});
