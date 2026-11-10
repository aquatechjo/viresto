// Dev only: creates one client with enough cases, sessions/appointments
// and payments for a multi-page client file report (page breaks, repeated
// table headers, long notes). Goes through the app's own API as the E2E
// user, so encryption, search hashes, validation and office scoping are
// the real ones. Writes to whatever database the local dev server uses.
//
// Usage, with `npm run dev` running on the dev branch:
//   node scripts/seed-report-client.mjs            (dry run: prints the plan)
//   node scripts/seed-report-client.mjs --apply    (creates the records)
//
// Reads E2E_TEST_EMAIL / E2E_TEST_PASSWORD from .env.local; never prints them.

import { readFileSync } from "node:fs";

const BASE_URL = process.env.SEED_BASE_URL || "http://localhost:3000";
const APPLY = process.argv.includes("--apply");

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)) {
  console.error(`Refusing: ${BASE_URL} is not a local dev server.`);
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^"|"$/g, "")]),
);

const DAY = 24 * 60 * 60 * 1000;
const stamp = Date.now().toString().slice(-7);
const digits = (n) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");

const COURTS = ["محكمة بداية عمّان", "محكمة صلح جزاء عمّان", "محكمة الاستئناف", "محكمة صلح حقوق الزرقاء", "محكمة التمييز"];
const CASE_TITLES = ["مطالبة مالية", "إخلاء مأجور", "قضية عمالية", "فسخ عقد بيع", "تعويض عن ضرر", "شيك بدون رصيد", "قسمة أموال مشتركة", "منع معارضة"];
const STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED", "OPEN", "IN_PROGRESS", "ARCHIVED"];
const TYPES = ["COURT_SESSION", "COURT_SESSION", "MEETING", "COURT_SESSION", "PHONE_CALL", "DEADLINE"];
const METHODS = ["CASH", "BANK_TRANSFER", "CHECK", "ONLINE"];
const LONG_NOTE =
  "ملاحظة طويلة لاختبار التفاف النص داخل الخلية: تم الاتفاق مع الموكل على تقسيط المبلغ المتبقي على دفعات شهرية، مع مراجعة الحساب بعد صدور الحكم في الدعوى.";

const client = {
  name: `موكل تقرير متعدد الصفحات ${stamp}`,
  phone: `079${digits(7)}`,
  email: `report-client-${stamp}@example.com`,
  nationalId: `9${digits(9)}`,
  address: "عمّان، جبل عمّان، الدوار الثالث، شارع الأمير محمد، عمارة 12",
  notes: "موكل تجريبي لاختبار تقرير ملف الموكل على عدة صفحات.\nسطر ثانٍ في الملاحظات.",
};

const cases = Array.from({ length: 12 }, (_, i) => ({
  title: `${CASE_TITLES[i % CASE_TITLES.length]} ${i + 1}`,
  caseNumber: i % 4 === 3 ? null : `${100 + i * 7}/2026`,
  court: i % 5 === 4 ? null : COURTS[i % COURTS.length],
  status: STATUSES[i % STATUSES.length],
  feeAgreed: [500, 1250.5, 750, 2000, 300.25][i % 5],
}));

const now = Date.now();
const appointments = Array.from({ length: 34 }, (_, i) => {
  const start = new Date(now + (i - 20) * 4 * DAY + (i % 3) * 60 * 60 * 1000);
  start.setUTCHours(6 + (i % 4), i % 2 ? 30 : 0, 0, 0); // 9:00-12:30 in Amman
  const type = TYPES[i % TYPES.length];
  return {
    caseIndex: i % cases.length,
    title: type === "COURT_SESSION" ? `جلسة ${["بينات", "مرافعة", "حكم", "تبادل لوائح"][i % 4]}` : `موعد ${i + 1}`,
    description: i % 6 === 0 ? LONG_NOTE : i % 4 === 0 ? "إحضار المستندات الأصلية" : undefined,
    startTime: start.toISOString(),
    endTime: i % 3 === 0 ? new Date(start.getTime() + 60 * 60 * 1000).toISOString() : undefined,
    location: type === "COURT_SESSION" && i % 2 ? COURTS[i % COURTS.length] : type === "MEETING" ? "مقر المكتب" : undefined,
    type,
    status: start.getTime() < now ? (i % 5 === 0 ? "CANCELLED" : "COMPLETED") : "SCHEDULED",
  };
});

const payments = Array.from({ length: 26 }, (_, i) => ({
  caseIndex: i % cases.length,
  amount: [150, 250.5, 75, 400, 1000, 62.75][i % 6],
  method: METHODS[i % METHODS.length],
  status: i % 7 === 3 ? "PENDING" : "PAID",
  paidAt: new Date(now - (26 - i) * 9 * DAY).toISOString(),
  reference: i % 3 === 1 ? `TRX-${digits(5)}` : null,
  notes: i % 8 === 0 ? LONG_NOTE : i % 3 === 0 ? `دفعة رقم ${i + 1}` : null,
}));

console.log(
  `${APPLY ? "Creating" : "Dry run:"} 1 client, ${cases.length} cases, ${appointments.length} appointments, ${payments.length} payments on ${BASE_URL}`,
);
if (!APPLY) {
  console.log("Nothing written. Add --apply to create the records.");
  process.exit(0);
}

const login = await fetch(`${BASE_URL}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: BASE_URL },
  body: JSON.stringify({ email: env.E2E_TEST_EMAIL, password: env.E2E_TEST_PASSWORD }),
});
if (!login.ok) {
  console.error(`Login failed: ${login.status}`);
  process.exit(1);
}
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

async function post(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL, cookie },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    throw new Error(`${path} ${response.status}: ${json.error || json.message || JSON.stringify(json).slice(0, 200)}`);
  }
  return json.data;
}

const created = await post("/api/clients", client);
console.log(`client ${created.id} (#${created.publicId})`);

const caseIds = [];
for (const item of cases) {
  caseIds.push((await post("/api/cases", { ...item, clientId: created.id })).id);
}
console.log(`cases: ${caseIds.length}`);

for (const { caseIndex, ...item } of appointments) {
  await post("/api/appointments", { ...item, clientId: created.id, caseId: caseIds[caseIndex] });
}
console.log(`appointments: ${appointments.length}`);

for (const { caseIndex, ...item } of payments) {
  await post("/api/payments", { ...item, caseId: caseIds[caseIndex] });
}
console.log(`payments: ${payments.length}`);
console.log(`Open: ${BASE_URL}/dashboard/clients/${created.id}`);
