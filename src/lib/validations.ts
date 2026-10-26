import { z } from "zod";
import { hasValidJodPrecision, MAX_JOD_AMOUNT } from "@/lib/money";
import {
  NATIONAL_ID_DIGITS_MESSAGE,
  PHONE_DIGITS_MESSAGE,
  TEN_DIGITS,
  toLatinDigits,
} from "@/lib/digits";

// Upper bounds for free text, so one request cannot store megabytes per field.
export const SHORT_TEXT_MAX = 200;
export const LONG_TEXT_MAX = 10_000;
const DATE_STRING_MAX = 40;

export const strongPasswordSchema = z
  .string()
  .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
  .max(128, "كلمة المرور طويلة جدًا")
  .regex(/[a-z]/, "كلمة المرور يجب أن تحتوي على حرف صغير")
  .regex(/[A-Z]/, "كلمة المرور يجب أن تحتوي على حرف كبير")
  .regex(/\d/, "كلمة المرور يجب أن تحتوي على رقم")
  .regex(/[^A-Za-z0-9]/, "كلمة المرور يجب أن تحتوي على رمز خاص");

export const loginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
  slug: z.string().optional(),
});

export const SIGNUP_PLAN_CODES = ["BASIC", "PRO", "BUSINESS"] as const;
export type SignupPlanCode = (typeof SIGNUP_PLAN_CODES)[number];

export const registerSchema = z.object({
  tenantName: z
    .string()
    .trim()
    .min(2, "اسم المكتب مطلوب")
    .max(120, "اسم المكتب طويل جدًا"),

  name: z.string().trim().min(2, "الاسم مطلوب").max(120, "الاسم طويل جدًا"),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("بريد إلكتروني غير صالح")
    .max(160, "البريد الإلكتروني طويل جدًا"),

  phone: z
    .string()
    .trim()
    .min(10, "رقم الهاتف غير صحيح")
    .max(20, "رقم الهاتف طويل جدًا")
    .regex(
      /^(\+9627\d{8}|07\d{8})$/,
      "أدخل رقم هاتف أردني صحيح مثل 07XXXXXXXX",
    ),

  password: strongPasswordSchema,
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "يجب الموافقة على الشروط والأحكام" }),
  }),
  acceptPrivacy: z.literal(true, {
    errorMap: () => ({ message: "يجب الإقرار بسياسة الخصوصية" }),
  }),

  // The plan picked on the website (/register?plan=...). Anything else is
  // dropped rather than rejected: it only preselects the subscribe page.
  signupPlan: z.preprocess(
    (value) => {
      const code = String(value ?? "").trim().toUpperCase();
      return SIGNUP_PLAN_CODES.includes(code as SignupPlanCode) ? code : undefined;
    },
    z.enum(SIGNUP_PLAN_CODES).optional(),
  ),
});

// Exactly 10 digits (phone, national ID). Arabic/Persian digits count as
// digits; nothing else (spaces, "+", "-") is stripped: the input already
// sends clean digits, so anything else is rejected rather than guessed at.
function tenDigits(message: string) {
  return z.preprocess(
    (value) => (typeof value === "string" ? toLatinDigits(value).trim() : value),
    z.string({ required_error: message, invalid_type_error: message }).regex(TEN_DIGITS, message),
  );
}

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(120),

  email: z
    .string()
    .trim()
    .email("Invalid email")
    .max(160, "Email is too long")
    .optional()
    .or(z.literal("")),

  phone: tenDigits(PHONE_DIGITS_MESSAGE),
  nationalId: tenDigits(NATIONAL_ID_DIGITS_MESSAGE),

  address: z.string().trim().max(500, "Address is too long").optional().or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(LONG_TEXT_MAX, "Notes are too long")
    .optional()
    .or(z.literal("")),
});

function optionalText(max: number) {
  return z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }

    return value;
  }, z.string().max(max, "النص طويل جدًا").nullable().optional());
}
const optionalId = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  return value;
}, z.string().min(1).nullable().optional());

const optionalDateString = z
  .string()
  .max(DATE_STRING_MAX, "التاريخ غير صالح")
  .optional()
  .nullable()
  .refine((value) => {
    if (!value) return true;
    return !Number.isNaN(new Date(value).getTime());
  }, "التاريخ غير صالح");

// An ISO 8601 date-time with an explicit timezone (Z or ±hh:mm) that
// parses to a real instant, e.g. "2026-10-01T09:00:00.000Z". A local time
// without timezone is ambiguous for the office's time zone, so it is refused.
const isoDateTimeWithZone = z
  .string()
  .trim()
  .max(DATE_STRING_MAX, "التاريخ غير صالح")
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?([zZ]|[+-]\d{2}:\d{2})$/.test(value) &&
      !Number.isNaN(Date.parse(value)),
    "التاريخ يجب أن يكون بصيغة ISO مع المنطقة الزمنية",
  );

const nonNegativeMoney = z.coerce
  .number({ invalid_type_error: "القيمة يجب أن تكون رقمًا" })
  .finite("القيمة يجب أن تكون رقمًا صالحًا")
  .min(0, "القيمة لا يمكن أن تكون سالبة")
  .max(MAX_JOD_AMOUNT, "القيمة أكبر من الحد المسموح")
  .refine(
    hasValidJodPrecision,
    "القيمة يجب ألا تحتوي على أكثر من 3 منازل عشرية",
  );

const positiveMoney = z.coerce
  .number({ invalid_type_error: "المبلغ يجب أن يكون رقمًا" })
  .finite("المبلغ يجب أن يكون رقمًا صالحًا")
  .positive("المبلغ يجب أن يكون موجبًا")
  .max(MAX_JOD_AMOUNT, "المبلغ أكبر من الحد المسموح")
  .refine(
    hasValidJodPrecision,
    "المبلغ يجب ألا يحتوي على أكثر من 3 منازل عشرية",
  );

const positiveQuantity = z.coerce
  .number({ invalid_type_error: "الكمية يجب أن تكون رقمًا" })
  .finite("الكمية يجب أن تكون رقمًا صالحًا")
  .positive("الكمية يجب أن تكون أكبر من صفر")
  .max(1_000_000, "الكمية أكبر من الحد المسموح")
  .refine(
    hasValidJodPrecision,
    "الكمية يجب ألا تحتوي على أكثر من 3 منازل عشرية",
  );

export const caseSchema = z.object({
  clientId: z.string().min(1, "الموكل مطلوب"),
  leadLawyerId: optionalId,
  memberIds: z
    .array(z.string().min(1))
    .max(50, "عدد المشاركين أكبر من المسموح")
    .optional(),
  title: z.string().min(1, "العنوان مطلوب").max(SHORT_TEXT_MAX, "العنوان طويل جدًا"),

  caseNumber: optionalText(SHORT_TEXT_MAX),
  court: optionalText(SHORT_TEXT_MAX),
  judgeName: optionalText(SHORT_TEXT_MAX),
  plaintiffName: optionalText(SHORT_TEXT_MAX),
  defendantName: optionalText(SHORT_TEXT_MAX),

  description: optionalText(LONG_TEXT_MAX),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED", "ARCHIVED"]).optional(),
  feeAgreed: nonNegativeMoney.optional(),
});

export const paymentSchema = z.object({
  caseId: optionalId,
  invoiceId: optionalId,

  amount: positiveMoney,

  method: z.enum(["CASH", "BANK_TRANSFER", "CHECK", "ONLINE"]).optional(),

  status: z.enum(["PAID", "PENDING", "OVERDUE", "CANCELLED"]).optional(),

  paidAt: optionalDateString,

  reference: z
    .string()
    .trim()
    .max(120, "رقم المرجع طويل جدًا")
    .optional()
    .nullable(),

  notes: z
    .string()
    .trim()
    .max(2000, "الملاحظات طويلة جدًا")
    .optional()
    .nullable(),
});

export const paymentUpdateSchema = paymentSchema.partial().extend({
  cancellationReason: z
    .string()
    .trim()
    .min(5, "سبب الإلغاء يجب أن يحتوي على 5 أحرف على الأقل")
    .max(500, "سبب الإلغاء طويل جدًا")
    .optional(),
});

export const appointmentSchema = z.object({
  clientId: optionalId,
  caseId: optionalId,
  assignedToId: optionalId,
  title: z.string().min(1, "العنوان مطلوب").max(SHORT_TEXT_MAX, "العنوان طويل جدًا"),
  description: z.string().max(LONG_TEXT_MAX, "الوصف طويل جدًا").optional(),
  startTime: isoDateTimeWithZone,
  endTime: isoDateTimeWithZone.optional(),
  location: z.string().max(300, "المكان طويل جدًا").optional(),
  type: z
    .enum(["MEETING", "COURT_SESSION", "PHONE_CALL", "DEADLINE", "OTHER"])
    .optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
});

export const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "العنوان مطلوب")
    .max(200, "عنوان المهمة طويل جدًا"),
  description: z
    .string()
    .trim()
    .max(2000, "وصف المهمة طويل جدًا")
    .optional()
    .nullable(),
  dueDate: optionalDateString,
  priority: z.enum(["URGENT", "LOW", "MEDIUM", "HIGH"]).optional(),
  status: z
    .enum(["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"])
    .optional(),
  assignedToId: optionalId,
  clientId: optionalId,
  caseId: optionalId,
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().max(160).optional(),
  currentPassword: z.string().optional(),
  newPassword: strongPasswordSchema.optional(),
});
export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "وصف البند مطلوب").max(500, "وصف البند طويل جدًا"),
  quantity: positiveQuantity,
  unitPrice: nonNegativeMoney,
});

export const invoiceCreateSchema = z.object({
  clientId: z.string().min(1, "يجب اختيار الموكل"),
  caseId: z.string().optional().nullable(),
  dueDate: optionalDateString,
  tax: nonNegativeMoney.optional().default(0),
  discount: nonNegativeMoney.optional().default(0),
  notes: z
    .string()
    .trim()
    .max(2000, "الملاحظات طويلة جدًا")
    .optional()
    .nullable(),
  items: z
    .array(invoiceItemSchema)
    .min(1, "يجب إضافة بند واحد على الأقل للفاتورة"),
});

export const invoiceUpdateSchema = z.object({
  clientId: z.string().min(1, "يجب اختيار الموكل").optional(),
  caseId: z.string().optional().nullable(),
  dueDate: optionalDateString,
  status: z
    .enum(["DRAFT", "UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"])
    .optional(),
  tax: nonNegativeMoney.optional(),
  discount: nonNegativeMoney.optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "الملاحظات طويلة جدًا")
    .optional()
    .nullable(),
  items: z
    .array(invoiceItemSchema)
    .min(1, "يجب إضافة بند واحد على الأقل للفاتورة")
    .optional(),
});
