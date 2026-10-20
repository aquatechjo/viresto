// Local preview of the verification email (development only: a script, not
// a route, so nothing here is part of the Next.js build or the deployment).
//
//   npm run email:preview            -> code 642332
//   npm run email:preview -- 123456  -> another code
//
// Writes .email-preview/verification-email.html (+ .txt) and prints the
// path; open it in a browser and check 375px and 1280px wide.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { renderVerificationEmail } from "../src/lib/email/verification-email";

const code = process.argv[2] ?? "642332";
const { subject, html, text } = renderVerificationEmail({ code });

const dir = path.resolve(".email-preview");
mkdirSync(dir, { recursive: true });
const htmlPath = path.join(dir, "verification-email.html");
writeFileSync(htmlPath, html, "utf8");
writeFileSync(path.join(dir, "verification-email.txt"), `Subject: ${subject}\n\n${text}\n`, "utf8");

console.log(`Subject: ${subject}`);
console.log(`HTML:    ${htmlPath}`);
console.log(`Open:    ${pathToFileURL(htmlPath).href}`);
