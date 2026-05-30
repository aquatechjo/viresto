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
