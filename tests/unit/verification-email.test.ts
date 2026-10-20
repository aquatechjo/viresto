import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EMAIL_LOGO, renderVerificationEmail } from "../../src/lib/email/verification-email";
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

test("the logo is an absolute URL on the site, with alt text and fixed size", () => {
  const { html } = renderVerificationEmail({ code: "642332", appUrl: "https://www.virestojo.com/" });
  const img = html.match(/<img\s[^>]*>/)?.[0] ?? "";

  assert.match(img, /src="https:\/\/www\.virestojo\.com\/email\/viresto-logo\.png"/);
  assert.match(img, /alt="Viresto"/);
  assert.match(img, new RegExp(`width="${EMAIL_LOGO.width}" height="${EMAIL_LOGO.height}"`));
  assert.match(img, /display:block/);
  assert.match(img, /border:0/);
  // The old text header is gone: the logo replaces it.
  assert.equal(html.match(/>\s*Viresto\s*</g), null);
});

test("the logo file is the declared size at 2x, with a transparent background", () => {
  const png = readFileSync("public/email/viresto-logo.png");
  // PNG IHDR: width and height at bytes 16-23, colour type at 25 (6 = RGBA).
  assert.equal(png.readUInt32BE(16), EMAIL_LOGO.width * 2);
  assert.equal(png.readUInt32BE(20), EMAIL_LOGO.height * 2);
  assert.equal(png[25], 6);
});
