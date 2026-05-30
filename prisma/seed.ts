import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Viresto...')

  const tenant = await prisma.tenant.upsert({
    where:  { slug: 'almansouri-law' },
    update: {},
    create: { name: 'مكتب المنصوري للمحاماة', slug: 'almansouri-law', plan: 'PRO' },
  })

const passwordHash = await bcrypt.hash('Lawyer@123456', 12)

const user = await prisma.user.upsert({
  where: {
    email: 'lawyer@example.com',
  },
  update: {
    passwordHash,
    role: UserRole.ADMIN,
    isActive: true,
  },
  create: {
    tenantId: tenant.id,
    name: 'المحامي أحمد المنصوري',
    email: 'lawyer@example.com',
    passwordHash,
     role: UserRole.ADMIN,
  },
})

  const c1 = await prisma.client.create({ data: { tenantId: tenant.id, name: 'خالد العمري', phone: '0501234567', email: 'khalid@example.com', address: 'الرياض، حي النخيل' } })
  const c2 = await prisma.client.create({ data: { tenantId: tenant.id, name: 'سارة القحطاني', phone: '0559876543', email: 'sara@example.com', address: 'جدة، حي الروضة' } })
  const c3 = await prisma.client.create({ data: { tenantId: tenant.id, name: 'محمد البلوي', phone: '0533456789' } })
  const c4 = await prisma.client.create({ data: { tenantId: tenant.id, name: 'رنا الحمدان', phone: '0771234567', email: 'rana@example.com' } })

  const case1 = await prisma.case.create({ data: { tenantId: tenant.id, clientId: c1.id, title: 'قضية عمالية — فصل تعسفي', caseNumber: '2024/158', court: 'المحكمة العمالية — الرياض', status: 'IN_PROGRESS', feeAgreed: 8000 } })
  const case2 = await prisma.case.create({ data: { tenantId: tenant.id, clientId: c2.id, title: 'نزاع عقاري — إخلاء وحدة سكنية', caseNumber: '2024/203', court: 'المحكمة العامة — جدة', status: 'OPEN', feeAgreed: 12000 } })
  const case3 = await prisma.case.create({ data: { tenantId: tenant.id, clientId: c3.id, title: 'قضية تجارية — مطالبة بعقد', caseNumber: '2024/174', court: 'المحكمة التجارية — الرياض', status: 'CLOSED', feeAgreed: 15000 } })
  const case4 = await prisma.case.create({ data: { tenantId: tenant.id, clientId: c4.id, title: 'قضية أحوال شخصية', caseNumber: '2024/190', court: 'محكمة الأحوال الشخصية', status: 'OPEN', feeAgreed: 5000 } })

  const now = new Date()
  await prisma.payment.createMany({ data: [
    { tenantId: tenant.id, caseId: case1.id, amount: 5000, method: 'BANK_TRANSFER', status: 'PAID', paidAt: new Date(now.getTime()-15*86400000), notes: 'دفعة أولى' },
    { tenantId: tenant.id, caseId: case1.id, amount: 3000, method: 'CASH', status: 'PENDING', notes: 'دفعة ثانية عند الحكم' },
    { tenantId: tenant.id, caseId: case2.id, amount: 6000, method: 'BANK_TRANSFER', status: 'PAID' },
    { tenantId: tenant.id, caseId: case2.id, amount: 6000, method: 'BANK_TRANSFER', status: 'PENDING' },
    { tenantId: tenant.id, caseId: case3.id, amount: 15000, method: 'CHECK', status: 'PAID', notes: 'مبلغ كامل' },
    { tenantId: tenant.id, caseId: case4.id, amount: 2500, method: 'CASH', status: 'PAID' },
    { tenantId: tenant.id, caseId: case4.id, amount: 2500, method: 'CASH', status: 'PENDING' },
  ]})

  await prisma.appointment.createMany({ data: [
    { tenantId: tenant.id, clientId: c1.id, caseId: case1.id, title: 'جلسة استماع أولى', type: 'COURT_SESSION', startTime: new Date(now.getTime()+2*86400000), location: 'المحكمة العمالية — قاعة 3', status: 'SCHEDULED' },
    { tenantId: tenant.id, clientId: c2.id, caseId: case2.id, title: 'جلسة استئناف #203', type: 'COURT_SESSION', startTime: new Date(now.getTime()+86400000+4*3600000), location: 'محكمة الاستئناف', status: 'SCHEDULED' },
    { tenantId: tenant.id, clientId: c4.id, title: 'اجتماع موكل المكتب', type: 'MEETING', startTime: new Date(now.getTime()+5*3600000), location: 'المكتب', status: 'SCHEDULED' },
    { tenantId: tenant.id, clientId: c3.id, title: 'مراجعة ملف القضية', type: 'MEETING', startTime: new Date(now.getTime()+5*86400000), status: 'SCHEDULED' },
  ]})

  await prisma.task.createMany({ data: [
    { tenantId: tenant.id, caseId: case1.id, title: 'إعداد مذكرة الدفاع', priority: 'HIGH', dueDate: new Date(now.getTime()+3*86400000) },
    { tenantId: tenant.id, caseId: case2.id, title: 'مراجعة عقد الإيجار', priority: 'MEDIUM', dueDate: new Date(now.getTime()+7*86400000) },
    { tenantId: tenant.id, title: 'تجديد رخصة المكتب', priority: 'LOW', dueDate: new Date(now.getTime()+30*86400000) },
    { tenantId: tenant.id, caseId: case3.id, title: 'أرشفة ملف القضية المغلقة', priority: 'LOW', completed: true },
    { tenantId: tenant.id, caseId: case1.id, title: 'طلب تأجيل الجلسة', priority: 'HIGH', dueDate: new Date(now.getTime()+86400000) },
  ]})

  console.log('✅ Seed complete!')
  console.log(`   Email : lawyer@example.com`)
  console.log(`   Pass  : Lawyer@123456`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
