import type {
  AppointmentStatus,
  AppointmentType,
  CaseStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { DateTime } from "luxon";
import { formatSequentialInvoiceNumber } from "@/lib/financial-audit";
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo/constants";

// The sample office a trial user explores in demo mode: realistic Jordanian
// data, all of it fake. Pure (ids, clock, encryption and hashing injected)
// so it is unit-tested without a database; sandbox.ts writes the result.
//
// Fake by construction:
// - phones are 0700000NNN: Jordanian mobiles are 077/078/079, 070 is not
//   allocated, and the form's 10-digit rule still accepts them;
// - national IDs are 00000000NN: real national numbers never start with 0;
// - emails are on the reserved .invalid TLD, so nothing is ever delivered.

export const DEMO_ZONE = "Asia/Amman";

export type DemoUserIds = { admin: string; lawyer: string; staff: string };

export type DemoSampleInput = {
  tenantId: string;
  users: DemoUserIds;
  now: Date;
  newId: () => string;
  encrypt: (value: string) => string;
  hash: (value: string) => string;
  normalizePhone: (value: string) => string | null;
  normalizeEmail: (value: string) => string | null;
};

export type DemoSampleData = {
  clients: Prisma.ClientCreateManyInput[];
  cases: Prisma.CaseCreateManyInput[];
  caseMembers: Prisma.CaseMemberCreateManyInput[];
  appointments: Prisma.AppointmentCreateManyInput[];
  tasks: Prisma.TaskCreateManyInput[];
  documents: Prisma.DocumentCreateManyInput[];
  invoices: Prisma.InvoiceCreateManyInput[];
  invoiceItems: Prisma.InvoiceItemCreateManyInput[];
  payments: Prisma.PaymentCreateManyInput[];
  invoiceSequence: Prisma.InvoiceSequenceCreateManyInput;
  activities: Prisma.ActivityCreateManyInput[];
};

export const DEMO_TEAM = {
  lawyer: { name: "المحامية سارة الخطيب", role: "LAWYER" as const },
  staff: { name: "عمر الزعبي", role: "STAFF" as const },
};

export function demoEmail(localPart: string) {
  return `${localPart}@${DEMO_EMAIL_DOMAIN}`;
}

export function demoPhone(index: number) {
  return `0700000${String(index).padStart(3, "0")}`;
}

export function demoNationalId(index: number) {
  return `00000000${String(index).padStart(2, "0")}`;
}

const CLIENTS: Array<{ name: string; city: string; email?: boolean; notes?: string }> = [
  { name: "محمد أحمد العبادي", city: "عمّان - خلدا", email: true },
  { name: "ليلى سمير حداد", city: "عمّان - عبدون", email: true },
  { name: "شركة النخبة للتجارة العامة", city: "عمّان - شارع مكة", email: true, notes: "عميل شركات - عقد سنوي" },
  { name: "خالد يوسف الطراونة", city: "الكرك" },
  { name: "رنا عبد الله المومني", city: "إربد - شارع الجامعة", email: true },
  { name: "مؤسسة الأفق للمقاولات", city: "الزرقاء - الزرقاء الجديدة", notes: "نزاعات عقود مقاولات" },
  { name: "سامي إبراهيم الحوراني", city: "المفرق" },
  { name: "هبة محمود الزعبي", city: "السلط", email: true },
  { name: "شركة الشرق للصناعات الغذائية", city: "سحاب - المدينة الصناعية", email: true },
  { name: "عمر فيصل المجالي", city: "عمّان - الصويفية" },
  { name: "نور الهدى خليل العمري", city: "جرش", email: true },
  { name: "يزن طارق القضاة", city: "عجلون" },
  { name: "شركة البتراء للاستثمار السياحي", city: "العقبة", email: true, notes: "عقود إيجار وتشغيل" },
  { name: "أحمد سليمان بني هاني", city: "إربد - الحصن" },
  { name: "دينا ماهر الصمادي", city: "مادبا", email: true },
];

type CaseSeed = {
  kind: "مدنية" | "جزائية" | "عمالية" | "تجارية";
  title: string;
  court: string;
  client: number;
  opponent: string;
  clientIsPlaintiff: boolean;
  status: CaseStatus;
  fee: number;
  judge: string;
  lead: keyof DemoUserIds;
};

const CASES: CaseSeed[] = [
  { kind: "مدنية", title: "مطالبة بقيمة أجور عقار", court: "محكمة صلح حقوق عمّان", client: 0, opponent: "فراس نادر الخصاونة", clientIsPlaintiff: true, status: "IN_PROGRESS", fee: 900, judge: "القاضي محمود الرواشدة", lead: "admin" },
  { kind: "جزائية", title: "شيك بدون رصيد", court: "محكمة صلح جزاء عمّان", client: 1, opponent: "الحق العام وزيد عماد", clientIsPlaintiff: true, status: "OPEN", fee: 1200, judge: "القاضي باسل العدوان", lead: "lawyer" },
  { kind: "تجارية", title: "مطالبة بقيمة بضاعة مورّدة", court: "محكمة بداية حقوق عمّان", client: 2, opponent: "شركة الريان للتوزيع", clientIsPlaintiff: true, status: "IN_PROGRESS", fee: 6500, judge: "القاضي سهى الفايز", lead: "admin" },
  { kind: "عمالية", title: "مطالبة بحقوق عمالية وفصل تعسفي", court: "محكمة صلح حقوق الكرك", client: 3, opponent: "مصنع الجنوب للإسمنت", clientIsPlaintiff: true, status: "IN_PROGRESS", fee: 1500, judge: "القاضي عامر الحباشنة", lead: "lawyer" },
  { kind: "مدنية", title: "فسخ عقد بيع شقة", court: "محكمة بداية حقوق إربد", client: 4, opponent: "معاذ وليد الشرع", clientIsPlaintiff: true, status: "OPEN", fee: 3000, judge: "القاضي رائد بني ياسين", lead: "admin" },
  { kind: "تجارية", title: "نزاع عقد مقاولة مشروع سكني", court: "محكمة بداية حقوق الزرقاء", client: 5, opponent: "شركة الأمل للإسكان", clientIsPlaintiff: false, status: "IN_PROGRESS", fee: 8000, judge: "القاضي لينا القيسي", lead: "admin" },
  { kind: "جزائية", title: "إيذاء بسيط", court: "محكمة صلح جزاء المفرق", client: 6, opponent: "الحق العام", clientIsPlaintiff: false, status: "CLOSED", fee: 700, judge: "القاضي حسن السرحان", lead: "lawyer" },
  { kind: "مدنية", title: "دعوى نفقة وحضانة", court: "محكمة السلط الشرعية", client: 7, opponent: "ماجد أنور الحياري", clientIsPlaintiff: true, status: "IN_PROGRESS", fee: 1000, judge: "القاضي إبراهيم العربيات", lead: "lawyer" },
  { kind: "تجارية", title: "منع منافسة غير مشروعة وعلامة تجارية", court: "محكمة بداية حقوق عمّان", client: 8, opponent: "شركة الوادي للأغذية", clientIsPlaintiff: true, status: "OPEN", fee: 7000, judge: "القاضي سهى الفايز", lead: "admin" },
  { kind: "عمالية", title: "بدل ساعات عمل إضافية", court: "محكمة صلح حقوق عمّان", client: 9, opponent: "شركة المدار للاتصالات", clientIsPlaintiff: true, status: "CLOSED", fee: 1100, judge: "القاضي محمود الرواشدة", lead: "lawyer" },
  { kind: "مدنية", title: "تعويض عن حادث سير", court: "محكمة بداية حقوق جرش", client: 10, opponent: "شركة التأمين الوطنية", clientIsPlaintiff: true, status: "IN_PROGRESS", fee: 2500, judge: "القاضي علا الرفاعي", lead: "admin" },
  { kind: "جزائية", title: "احتيال وإساءة ائتمان", court: "محكمة بداية جزاء عجلون", client: 11, opponent: "الحق العام ورامي فؤاد", clientIsPlaintiff: true, status: "OPEN", fee: 2000, judge: "القاضي خالد المومني", lead: "admin" },
  { kind: "تجارية", title: "إخلاء مأجور تجاري", court: "محكمة صلح حقوق العقبة", client: 12, opponent: "مؤسسة البحر الأحمر للسياحة", clientIsPlaintiff: true, status: "IN_PROGRESS", fee: 3500, judge: "القاضي نادر الحسنات", lead: "lawyer" },
  { kind: "مدنية", title: "إزالة شيوع أرض زراعية", court: "محكمة صلح حقوق إربد", client: 13, opponent: "ورثة سليمان بني هاني", clientIsPlaintiff: true, status: "OPEN", fee: 1800, judge: "القاضي رائد بني ياسين", lead: "admin" },
  { kind: "عمالية", title: "مكافأة نهاية خدمة", court: "محكمة صلح حقوق مادبا", client: 14, opponent: "مستشفى السلام الخاص", clientIsPlaintiff: true, status: "IN_PROGRESS", fee: 1300, judge: "القاضي جمال الشوابكة", lead: "lawyer" },
  { kind: "جزائية", title: "استئناف حكم جنحة", court: "محكمة استئناف عمّان", client: 0, opponent: "الحق العام", clientIsPlaintiff: false, status: "IN_PROGRESS", fee: 1600, judge: "الهيئة الثالثة", lead: "admin" },
  { kind: "تجارية", title: "تمييز حكم مطالبة مالية", court: "محكمة التمييز", client: 2, opponent: "شركة الريان للتوزيع", clientIsPlaintiff: true, status: "OPEN", fee: 4000, judge: "الهيئة العامة", lead: "admin" },
  { kind: "جزائية", title: "دعوى جناية سرقة", court: "محكمة الجنايات الكبرى", client: 6, opponent: "الحق العام", clientIsPlaintiff: false, status: "IN_PROGRESS", fee: 3000, judge: "القاضي منذر العزام", lead: "lawyer" },
  { kind: "مدنية", title: "إبطال قرار إداري", court: "المحكمة الإدارية", client: 9, opponent: "أمانة عمّان الكبرى", clientIsPlaintiff: true, status: "ARCHIVED", fee: 2200, judge: "القاضي سامر الدباس", lead: "admin" },
  { kind: "عمالية", title: "إصابة عمل", court: "محكمة صلح حقوق الزرقاء", client: 5, opponent: "عامل لدى المؤسسة", clientIsPlaintiff: false, status: "OPEN", fee: 900, judge: "القاضي لينا القيسي", lead: "lawyer" },
];

const SESSION_TITLES = ["جلسة سماع بينات", "جلسة تقديم لوائح", "جلسة خبرة", "جلسة مرافعة ختامية", "جلسة تبليغ", "جلسة نطق بالحكم"];
const MEETING_TITLES = ["اجتماع مع الموكل لمراجعة البينات", "اجتماع تسوية ودية", "اجتماع توقيع وكالة", "مراجعة عقد مع الموكل"];

const TASKS: Array<{ title: string; when: "done" | "overdue" | "upcoming"; days: number; priority: TaskPriority; case?: number; to: keyof DemoUserIds }> = [
  { title: "تقديم لائحة الدعوى", when: "done", days: -20, priority: "HIGH", case: 4, to: "admin" },
  { title: "تبليغ المدعى عليه", when: "done", days: -15, priority: "MEDIUM", case: 0, to: "staff" },
  { title: "تحضير قائمة البينات", when: "done", days: -12, priority: "HIGH", case: 2, to: "lawyer" },
  { title: "دفع رسوم الدعوى", when: "done", days: -10, priority: "URGENT", case: 8, to: "staff" },
  { title: "مراجعة تقرير الخبرة", when: "done", days: -6, priority: "MEDIUM", case: 10, to: "admin" },
  { title: "أرشفة ملف القضية المنتهية", when: "done", days: -3, priority: "LOW", case: 9, to: "staff" },
  { title: "الرد على لائحة الدفاع", when: "overdue", days: -4, priority: "URGENT", case: 5, to: "admin" },
  { title: "تجهيز مذكرة الاستئناف", when: "overdue", days: -3, priority: "HIGH", case: 15, to: "admin" },
  { title: "متابعة تبليغ الشهود", when: "overdue", days: -2, priority: "MEDIUM", case: 3, to: "staff" },
  { title: "طلب نسخة مصدقة من الحكم", when: "overdue", days: -2, priority: "LOW", case: 18, to: "staff" },
  { title: "الاتصال بشركة التأمين", when: "overdue", days: -1, priority: "MEDIUM", case: 10, to: "lawyer" },
  { title: "تحضير مرافعة ختامية", when: "upcoming", days: 2, priority: "HIGH", case: 2, to: "admin" },
  { title: "مراجعة عقد الإيجار التجاري", when: "upcoming", days: 3, priority: "MEDIUM", case: 12, to: "lawyer" },
  { title: "إعداد لائحة تمييز", when: "upcoming", days: 6, priority: "URGENT", case: 16, to: "admin" },
  { title: "تحصيل الدفعة الثانية من الأتعاب", when: "upcoming", days: 8, priority: "MEDIUM", to: "staff" },
  { title: "تجهيز بينات الدفاع", when: "upcoming", days: 10, priority: "HIGH", case: 17, to: "lawyer" },
  { title: "تجديد وكالة الموكل", when: "upcoming", days: 14, priority: "LOW", case: 13, to: "staff" },
  { title: "مراجعة مسودة اتفاقية تسوية", when: "upcoming", days: 21, priority: "MEDIUM", case: 5, to: "admin" },
];

const DOCUMENTS: Array<{ name: string; case: number; size: number; tags: string[] }> = [
  { name: "لائحة دعوى.pdf", case: 0, size: 245_000, tags: ["لوائح"] },
  { name: "صورة الشيك.pdf", case: 1, size: 180_000, tags: ["بينات"] },
  { name: "فواتير البضاعة.xlsx", case: 2, size: 1_250_000, tags: ["بينات", "مالية"] },
  { name: "عقد العمل.docx", case: 3, size: 320_000, tags: ["عقود"] },
  { name: "عقد بيع الشقة.pdf", case: 4, size: 410_000, tags: ["عقود"] },
  { name: "عقد المقاولة.pdf", case: 5, size: 890_000, tags: ["عقود"] },
  { name: "تقرير طبي.jpg", case: 6, size: 150_000, tags: ["بينات"] },
  { name: "شهادة تسجيل العلامة التجارية.pdf", case: 8, size: 210_000, tags: ["بينات"] },
  { name: "تقرير الخبرة الفنية.pdf", case: 10, size: 760_000, tags: ["خبرة"] },
  { name: "عقد الإيجار.pdf", case: 12, size: 290_000, tags: ["عقود"] },
  { name: "مخطط الأرض.pdf", case: 13, size: 1_900_000, tags: ["بينات"] },
  { name: "وكالة عامة.pdf", case: 15, size: 120_000, tags: ["وكالات"] },
];

const DOCUMENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
};

// paid: 0 = unpaid, between = partial, total = paid. dueDays from now.
// Spread over the last six months so the dashboard's finance chart and
// receivables aging (0-30 … 90+ days) all have something to show.
const INVOICES: Array<{ case: number; items: Array<[string, number]>; paid: number; issueDays: number; dueDays: number }> = [
  { case: 2, items: [["أتعاب محاماة - استشارة وصياغة إنذار", 1200], ["رسوم كاتب عدل", 80]], paid: 1280, issueDays: -170, dueDays: -140 },
  { case: 5, items: [["أتعاب محاماة - مرحلة التحكيم", 2800]], paid: 2800, issueDays: -150, dueDays: -120 },
  { case: 11, items: [["أتعاب محاماة", 1500]], paid: 1500, issueDays: -132, dueDays: -102 },
  { case: 15, items: [["أتعاب محاماة - مرحلة البداية", 1800]], paid: 900, issueDays: -112, dueDays: -82 },
  { case: 13, items: [["أتعاب محاماة", 2400]], paid: 2400, issueDays: -96, dueDays: -66 },
  { case: 7, items: [["أتعاب محاماة", 1200]], paid: 0, issueDays: -76, dueDays: -46 },
  { case: 10, items: [["أتعاب محاماة - الدفعة الأولى", 2600]], paid: 2600, issueDays: -66, dueDays: -36 },
  { case: 17, items: [["أتعاب محاماة", 1900]], paid: 1000, issueDays: -56, dueDays: -26 },
  { case: 2, items: [["أتعاب محاماة - الدفعة الأولى", 3000], ["مصاريف تبليغ ورسوم", 250]], paid: 3250, issueDays: -50, dueDays: -35 },
  { case: 5, items: [["أتعاب محاماة", 4000]], paid: 4000, issueDays: -45, dueDays: -30 },
  { case: 0, items: [["أتعاب محاماة", 900]], paid: 900, issueDays: -30, dueDays: -15 },
  { case: 9, items: [["أتعاب محاماة", 1100]], paid: 1100, issueDays: -40, dueDays: -25 },
  { case: 8, items: [["أتعاب محاماة - الدفعة الأولى", 3500], ["رسوم تسجيل الدعوى", 300]], paid: 2000, issueDays: -25, dueDays: 5 },
  { case: 10, items: [["أتعاب محاماة", 2500]], paid: 1000, issueDays: -20, dueDays: 10 },
  { case: 12, items: [["أتعاب محاماة", 3500]], paid: 1500, issueDays: -15, dueDays: 15 },
  { case: 4, items: [["أتعاب محاماة", 3000]], paid: 1000, issueDays: -7, dueDays: 23 },
  { case: 16, items: [["أتعاب محاماة - تمييز", 4000]], paid: 0, issueDays: -3, dueDays: 27 },
  { case: 3, items: [["أتعاب محاماة", 750], ["مصاريف خبرة", 150]], paid: 0, issueDays: -40, dueDays: -10 },
];

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CHECK", "BANK_TRANSFER"];

function invoiceStatus(total: number, paid: number, due: Date, now: Date): InvoiceStatus {
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIALLY_PAID";
  return due.getTime() < now.getTime() ? "OVERDUE" : "UNPAID";
}

// Open cases left untouched for over 30 days (the dashboard flags them).
const STALE_CASES = new Set([1, 7]);

function caseNumber(index: number, year: number) {
  return `${1200 + index * 37}/${year}`;
}

export function buildDemoSampleData(input: DemoSampleInput): DemoSampleData {
  const { tenantId, users, now, newId, encrypt, hash } = input;
  const today = DateTime.fromJSDate(now).setZone(DEMO_ZONE).startOf("day");
  const year = today.year;
  const at = (days: number, hour = 10, minute = 0) =>
    today.plus({ days }).set({ hour, minute }).toJSDate();
  const notAfterNow = (date: Date) => new Date(Math.min(date.getTime(), now.getTime()));

  const clients = CLIENTS.map((seed, index) => {
    const phone = demoPhone(index + 1);
    const nationalId = demoNationalId(index + 1);
    const email = seed.email ? demoEmail(`client${String(index + 1).padStart(2, "0")}`) : null;
    const normalizedPhone = input.normalizePhone(phone);
    const normalizedEmail = email ? input.normalizeEmail(email) : null;

    return {
      id: newId(),
      tenantId,
      createdById: users.admin,
      name: seed.name,
      phone: encrypt(phone),
      nationalId: encrypt(nationalId),
      email: email ? encrypt(email) : null,
      address: encrypt(seed.city),
      notes: seed.notes ? encrypt(seed.notes) : null,
      phoneHash: normalizedPhone ? hash(normalizedPhone) : null,
      nationalIdHash: hash(nationalId),
      emailHash: normalizedEmail ? hash(normalizedEmail) : null,
      createdAt: at(-60 + index * 3),
    } satisfies Prisma.ClientCreateManyInput;
  });

  const cases = CASES.map((seed, index) => {
    const client = clients[seed.client];
    return {
      id: newId(),
      tenantId,
      clientId: client.id,
      leadLawyerId: users[seed.lead],
      title: `دعوى ${seed.kind} - ${seed.title}`,
      caseNumber: caseNumber(index, year),
      court: seed.court,
      judgeName: seed.judge,
      plaintiffName: seed.clientIsPlaintiff ? client.name : seed.opponent,
      defendantName: seed.clientIsPlaintiff ? seed.opponent : client.name,
      description: `قضية ${seed.kind} (بيانات تجريبية).`,
      status: seed.status,
      feeAgreed: seed.fee,
      createdAt: at(-55 + index * 2),
      // Most were touched this week or last; STALE_CASES not for 30+ days.
      updatedAt: STALE_CASES.has(index)
        ? at(-42 + index)
        : notAfterNow(at(Math.max(-55 + index * 2, -(index % 12)), 16)),
    } satisfies Prisma.CaseCreateManyInput;
  });

  const caseMembers = cases.flatMap((item) => {
    const members = new Set([item.leadLawyerId!, users.admin]);
    return [...members].map((userId) => ({
      id: newId(),
      tenantId,
      caseId: item.id,
      userId,
    }));
  });

  // Sessions and appointments over this month and next, in office hours.
  const monthStart = today.startOf("month");
  const span = Math.floor(monthStart.plus({ months: 2 }).diff(monthStart, "days").days) - 1;
  const openCases = cases.filter((item) => item.status === "OPEN" || item.status === "IN_PROGRESS");
  const appointments: Prisma.AppointmentCreateManyInput[] = [];
  const types: AppointmentType[] = [
    "COURT_SESSION", "COURT_SESSION", "MEETING", "COURT_SESSION", "PHONE_CALL",
    "COURT_SESSION", "MEETING", "DEADLINE",
  ];

  for (let index = 0; index < 26; index++) {
    const type = types[index % types.length];
    const linked = openCases[index % openCases.length];
    const day = monthStart.plus({ days: Math.round((index * span) / 25) });
    // Courts sit Sunday to Thursday; move Friday/Saturday to Sunday.
    const weekday = day.weekday; // 1 Monday … 7 Sunday
    const workday = weekday === 5 ? day.plus({ days: 2 }) : weekday === 6 ? day.plus({ days: 1 }) : day;
    const hour = type === "COURT_SESSION" ? 9 + (index % 3) : 11 + (index % 5);
    const start = workday.set({ hour, minute: index % 2 ? 30 : 0 });
    const past = start.toMillis() < now.getTime();
    const status: AppointmentStatus = past ? (index % 9 === 4 ? "CANCELLED" : "COMPLETED") : "SCHEDULED";
    const title =
      type === "COURT_SESSION"
        ? SESSION_TITLES[index % SESSION_TITLES.length]
        : type === "MEETING"
          ? MEETING_TITLES[index % MEETING_TITLES.length]
          : type === "PHONE_CALL"
            ? "مكالمة متابعة مع الموكل"
            : "آخر موعد لتقديم اللائحة الجوابية";

    appointments.push({
      id: newId(),
      tenantId,
      caseId: linked.id,
      clientId: linked.clientId,
      assignedToId: linked.leadLawyerId,
      createdById: users.admin,
      title,
      type,
      status,
      startTime: start.toJSDate(),
      endTime: start.plus({ minutes: type === "PHONE_CALL" ? 15 : 60 }).toJSDate(),
      location: type === "COURT_SESSION" ? linked.court : type === "MEETING" ? "مقر المكتب" : null,
    });
  }

  // A full week ahead: court sessions on every working day of the next
  // seven, two on some, so the agenda and the "within 48 hours" alert
  // always have something whatever day the sandbox is created.
  for (let offset = 0; offset < 7; offset++) {
    const day = today.plus({ days: offset });
    if (day.weekday === 5 || day.weekday === 6) continue;

    const hours = offset % 2 ? [9.5, 12] : [10];
    hours.forEach((hour, slot) => {
      const linked = openCases[(offset * 3 + slot * 5) % openCases.length];
      const start = day.set({ hour: Math.floor(hour), minute: hour % 1 ? 30 : 0 });
      appointments.push({
        id: newId(),
        tenantId,
        caseId: linked.id,
        clientId: linked.clientId,
        assignedToId: linked.leadLawyerId,
        createdById: users.admin,
        title: SESSION_TITLES[(offset + slot) % SESSION_TITLES.length],
        type: "COURT_SESSION",
        status: start.toMillis() < now.getTime() ? "COMPLETED" : "SCHEDULED",
        startTime: start.toJSDate(),
        endTime: start.plus({ minutes: 60 }).toJSDate(),
        location: linked.court,
      });
    });
  }

  const tasks = TASKS.map((seed) => {
    const linked = seed.case === undefined ? null : cases[seed.case];
    const status: TaskStatus =
      seed.when === "done" ? "COMPLETED" : seed.when === "overdue" && seed.priority === "URGENT" ? "IN_PROGRESS" : "TODO";
    const dueDate = at(seed.days, 14);
    return {
      id: newId(),
      tenantId,
      caseId: linked?.id ?? null,
      clientId: linked?.clientId ?? null,
      assignedToId: users[seed.to],
      createdById: users.admin,
      title: seed.title,
      dueDate,
      priority: seed.priority,
      status,
      completed: seed.when === "done",
      completedAt: seed.when === "done" ? at(seed.days - 1, 16) : null,
      createdAt: at(seed.days - 7),
    } satisfies Prisma.TaskCreateManyInput;
  });

  // Records only: no file behind them (preview answers 404, never another
  // office's file), so nothing is stored in Cloudinary for the sample.
  const documents = DOCUMENTS.map((seed, index) => {
    const linked = cases[seed.case];
    return {
      id: newId(),
      tenantId,
      caseId: linked.id,
      clientId: linked.clientId,
      fileName: seed.name,
      fileType: DOCUMENT_TYPES[seed.name.split(".").pop()!],
      fileUrl: "",
      fileSize: seed.size,
      publicId: null,
      notes: "مستند تجريبي بدون ملف فعلي",
      tags: seed.tags,
      createdAt: at(-45 + index * 3),
    } satisfies Prisma.DocumentCreateManyInput;
  });

  const invoices: Prisma.InvoiceCreateManyInput[] = [];
  const invoiceItems: Prisma.InvoiceItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];

  // Numbered in issue order, like real sequential invoices.
  [...INVOICES].sort((a, b) => a.issueDays - b.issueDays).forEach((seed, index) => {
    const linked = cases[seed.case];
    const total = seed.items.reduce((sum, [, amount]) => sum + amount, 0);
    const paid = Math.min(seed.paid, total);
    const issueDate = at(seed.issueDays);
    const dueDate = at(seed.dueDays, 23, 59);
    const id = newId();

    invoices.push({
      id,
      tenantId,
      clientId: linked.clientId,
      caseId: linked.id,
      invoiceNumber: formatSequentialInvoiceNumber(year, index + 1),
      status: invoiceStatus(total, paid, dueDate, now),
      issueDate,
      dueDate,
      subtotal: total,
      tax: 0,
      discount: 0,
      total,
      createdAt: issueDate,
    });

    for (const [description, amount] of seed.items) {
      invoiceItems.push({ id: newId(), invoiceId: id, description, quantity: 1, unitPrice: amount, total: amount });
    }

    // A partial payment is one instalment; a full one may be two.
    const instalments = paid === total && total > 2000 ? [Math.round(total / 2), total - Math.round(total / 2)] : paid > 0 ? [paid] : [];
    instalments.forEach((amount, part) => {
      const paidAt = at(Math.min(seed.issueDays + 5 + part * 10, -1), 12);
      payments.push({
        id: newId(),
        tenantId,
        clientId: linked.clientId,
        caseId: linked.id,
        invoiceId: id,
        amount,
        method: PAYMENT_METHODS[(index + part) % PAYMENT_METHODS.length],
        status: "PAID" satisfies PaymentStatus,
        paidAt,
        reference: PAYMENT_METHODS[(index + part) % PAYMENT_METHODS.length] === "CASH" ? null : `REF-${1000 + index * 10 + part}`,
        createdAt: paidAt,
      });
    });
  });

  // Two pending payments with no invoice yet (expected next week).
  [cases[13], cases[14]].forEach((linked, index) => {
    payments.push({
      id: newId(),
      tenantId,
      clientId: linked.clientId,
      caseId: linked.id,
      amount: index ? 650 : 900,
      method: "BANK_TRANSFER",
      status: "PENDING",
      paidAt: null,
      notes: "دفعة متوقعة من الموكل",
      createdAt: at(-2),
    });
  });

  // The activity log the office would have built up, in the same shape
  // the API routes write (src/app/api/*: logActivity).
  const caseById = new Map(cases.map((item) => [item.id, item]));
  const invoiceById = new Map(invoices.map((item) => [item.id, item]));
  const activities: Prisma.ActivityCreateManyInput[] = [];
  const activity = (
    row: Omit<Prisma.ActivityCreateManyInput, "id" | "tenantId" | "createdAt"> & { createdAt: Date },
  ) => {
    if (row.createdAt.getTime() <= now.getTime()) activities.push({ id: newId(), tenantId, ...row });
  };

  clients.forEach((client) =>
    activity({ type: "CLIENT_CREATED", title: "تم إضافة موكل جديد", message: client.name, entityType: "CLIENT", entityId: client.id, actorId: users.admin, createdAt: client.createdAt as Date }),
  );

  cases.forEach((item) => {
    activity({ type: "CASE_CREATED", title: "تم إنشاء قضية جديدة", message: item.title, entityType: "CASE", entityId: item.id, actorId: item.leadLawyerId, createdAt: item.createdAt as Date });
    if ((item.updatedAt as Date).getTime() > (item.createdAt as Date).getTime()) {
      activity({ type: "CASE_UPDATED", title: "تم تعديل قضية", message: item.title, entityType: "CASE", entityId: item.id, actorId: item.leadLawyerId, createdAt: item.updatedAt as Date });
    }
  });

  documents.forEach((doc) => {
    const linked = caseById.get(doc.caseId!)!;
    activity({ type: "DOCUMENT_UPLOADED", title: "تم رفع مستند", message: `${doc.fileName} — ${linked.title}`, entityType: "CASE", entityId: linked.id, actorId: users.staff, createdAt: doc.createdAt as Date });
  });

  payments
    .filter((payment) => payment.status === "PAID")
    .forEach((payment) => {
      const invoice = invoiceById.get(payment.invoiceId!)!;
      activity({ type: "PAYMENT_CREATED", title: "تم تسجيل دفعة جديدة", message: `${payment.amount} - ${invoice.invoiceNumber}`, entityType: "CASE", entityId: payment.caseId, actorId: users.admin, createdAt: payment.paidAt as Date });
    });

  appointments
    .filter((item) => item.status === "SCHEDULED" && item.type === "COURT_SESSION")
    .slice(0, 6)
    .forEach((item, index) => {
      activity({ type: "APPOINTMENT_CREATED", title: "تم إضافة موعد", message: item.title, entityType: "CASE", entityId: item.caseId, actorId: users.lawyer, createdAt: notAfterNow(at(-(index + 1), 9 + index)) });
    });

  activities.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());

  return {
    clients,
    cases,
    caseMembers,
    appointments,
    tasks,
    documents,
    invoices,
    invoiceItems,
    payments,
    invoiceSequence: { tenantId, year, nextNumber: INVOICES.length + 1 },
    activities,
  };
}
