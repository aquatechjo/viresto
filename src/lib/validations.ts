import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
  slug: z.string().optional(),
});

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

  password: z
    .string()
    .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    .max(128, "كلمة المرور طويلة جدًا")
    .regex(/[a-z]/, "كلمة المرور يجب أن تحتوي على حرف صغير")
    .regex(/[A-Z]/, "كلمة المرور يجب أن تحتوي على حرف كبير")
    .regex(/\d/, "كلمة المرور يجب أن تحتوي على رقم")
    .regex(/[^A-Za-z0-9]/, "كلمة المرور يجب أن تحتوي على رمز خاص"),
});

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(120),

  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),

  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),

  nationalId: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "National ID must be exactly 10 digits"),

  address: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

const optionalText = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  return value;
}, z.string().nullable().optional());
export const caseSchema = z.object({
  clientId: z.string().min(1, "الموكل مطلوب"),
  title: z.string().min(1, "العنوان مطلوب"),

  caseNumber: optionalText,
  court: optionalText,
  judgeName: optionalText,
  plaintiffName: optionalText,
  defendantName: optionalText,

  description: optionalText,
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED", "ARCHIVED"]).optional(),
  feeAgreed: z.number().min(0).optional(),
});

export const paymentSchema = z.object({
  caseId: z.string().min(1),
  amount: z.number().positive("المبلغ يجب أن يكون موجباً"),
  method: z.enum(["CASH", "BANK_TRANSFER", "CHECK", "ONLINE"]).optional(),
  status: z.enum(["PAID", "PENDING", "OVERDUE", "CANCELLED"]).optional(),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
});

export const appointmentSchema = z.object({
  clientId: z.string().optional(),
  caseId: z.string().optional(),
  title: z.string().min(1, "العنوان مطلوب"),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  type: z
    .enum(["MEETING", "COURT_SESSION", "PHONE_CALL", "DEADLINE", "OTHER"])
    .optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
});

export const documentSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  fileSize: z.number().optional(),
  publicId: z.string().optional(),
  clientId: z.string().optional(),
  caseId: z.string().optional(),
  notes: z.string().optional(),
  fileType: z.enum([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
});

export const taskSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  clientId: z.string().optional(),
  caseId: z.string().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    .max(128, "كلمة المرور طويلة جدًا")
    .regex(/[a-z]/, "كلمة المرور يجب أن تحتوي على حرف صغير")
    .regex(/[A-Z]/, "كلمة المرور يجب أن تحتوي على حرف كبير")
    .regex(/\d/, "كلمة المرور يجب أن تحتوي على رقم")
    .regex(/[^A-Za-z0-9]/, "كلمة المرور يجب أن تحتوي على رمز خاص")
    .optional(),
});
const money = z.coerce
  .number({ invalid_type_error: "القيمة يجب أن تكون رقمًا" })
  .finite("القيمة يجب أن تكون رقمًا صالحًا")
  .min(0, "القيمة لا يمكن أن تكون سالبة");

const optionalDateString = z
  .string()
  .optional()
  .nullable()
  .refine((value) => {
    if (!value) return true;
    return !Number.isNaN(new Date(value).getTime());
  }, "التاريخ غير صالح");

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "وصف البند مطلوب"),
  quantity: money.gt(0, "الكمية يجب أن تكون أكبر من صفر"),
  unitPrice: money,
});

export const invoiceCreateSchema = z.object({
  clientId: z.string().min(1, "يجب اختيار الموكل"),
  caseId: z.string().optional().nullable(),
  dueDate: optionalDateString,
  tax: money.optional().default(0),
  discount: money.optional().default(0),
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
    .enum(["DRAFT", "UNPAID", "PAID", "OVERDUE", "CANCELLED"])
    .optional(),
  tax: money.optional(),
  discount: money.optional(),
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
