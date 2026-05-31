import { z } from 'zod'

export const loginSchema = z.object({
  email:    z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور 6 أحرف على الأقل'),
  slug:     z.string().optional(),
})

export const registerSchema = z.object({
  tenantName: z.string().min(2, 'اسم المكتب مطلوب'),
  name:       z.string().min(2, 'الاسم مطلوب'),
  email:      z.string().email('بريد إلكتروني غير صالح'),
  password:   z.string().min(8, 'كلمة المرور 8 أحرف على الأقل'),
})

export const clientSchema = z.object({
  name:       z.string().min(1, 'الاسم مطلوب'),
  email:      z.string().email().optional().or(z.literal('')),
  phone:      z.string().optional(),
  nationalId: z.string().optional(),
  address:    z.string().optional(),
  notes:      z.string().optional(),
})

export const caseSchema = z.object({
  clientId:    z.string().min(1, 'الموكل مطلوب'),
  title:       z.string().min(1, 'العنوان مطلوب'),
  caseNumber:  z.string().optional(),
  court:       z.string().optional(),
  description: z.string().optional(),
  status:      z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED']).optional(),
  feeAgreed:   z.number().min(0).optional(),
})

export const paymentSchema = z.object({
  caseId: z.string().min(1),
  amount: z.number().positive('المبلغ يجب أن يكون موجباً'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK', 'ONLINE']).optional(),
  status: z.enum(['PAID', 'PENDING', 'OVERDUE', 'CANCELLED']).optional(),
  paidAt: z.string().optional(),
  notes:  z.string().optional(),
})

export const appointmentSchema = z.object({
  clientId:    z.string().optional(),
  caseId:      z.string().optional(),
  title:       z.string().min(1, 'العنوان مطلوب'),
  description: z.string().optional(),
  startTime:   z.string(),
  endTime:     z.string().optional(),
  location:    z.string().optional(),
  type:        z.enum(['MEETING', 'COURT_SESSION', 'PHONE_CALL', 'DEADLINE', 'OTHER']).optional(),
  status:      z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
})

export const documentSchema = z.object({
  fileName: z.string().min(1),
  fileUrl:  z.string().url(),
  fileSize: z.number().optional(),
  publicId: z.string().optional(),
  clientId: z.string().optional(),
  caseId:   z.string().optional(),
  notes:    z.string().optional(),
  fileType: z.enum([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]),
})

export const taskSchema = z.object({
  title:       z.string().min(1, 'العنوان مطلوب'),
  description: z.string().optional(),
  dueDate:     z.string().optional(),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  clientId:    z.string().optional(),
  caseId:      z.string().optional(),
})

export const updateProfileSchema = z.object({
  name:            z.string().min(2).optional(),
  email:           z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword:     z.string().min(8).optional(),
})
const money = z.coerce
  .number({ invalid_type_error: 'القيمة يجب أن تكون رقمًا' })
  .finite('القيمة يجب أن تكون رقمًا صالحًا')
  .min(0, 'القيمة لا يمكن أن تكون سالبة')

const optionalDateString = z
  .string()
  .optional()
  .nullable()
  .refine((value) => {
    if (!value) return true
    return !Number.isNaN(new Date(value).getTime())
  }, 'التاريخ غير صالح')

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'وصف البند مطلوب'),
  quantity: money.gt(0, 'الكمية يجب أن تكون أكبر من صفر'),
  unitPrice: money,
})

export const invoiceCreateSchema = z.object({
  clientId: z.string().min(1, 'يجب اختيار الموكل'),
  caseId: z.string().optional().nullable(),
  dueDate: optionalDateString,
  tax: money.optional().default(0),
  discount: money.optional().default(0),
  notes: z.string().trim().max(2000, 'الملاحظات طويلة جدًا').optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'يجب إضافة بند واحد على الأقل للفاتورة'),
})

export const invoiceUpdateSchema = z.object({
  clientId: z.string().min(1, 'يجب اختيار الموكل').optional(),
  caseId: z.string().optional().nullable(),
  dueDate: optionalDateString,
  status: z.enum(['DRAFT', 'UNPAID', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  tax: money.optional(),
  discount: money.optional(),
  notes: z.string().trim().max(2000, 'الملاحظات طويلة جدًا').optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'يجب إضافة بند واحد على الأقل للفاتورة').optional(),
})

