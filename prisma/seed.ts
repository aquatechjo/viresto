import {
  AppointmentStatus,
  AppointmentType,
  CaseStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  TaskPriority,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Viresto...");

  const passwordHash = await bcrypt.hash("Lawyer@123456", 12);
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      const tenant = await tx.tenant.upsert({
        where: { slug: "almansouri-law" },
        update: {
          plan: "PRO",
          status: "ACTIVE",
          isSuspended: false,
        },
        create: {
          name: "مكتب المنصوري للمحاماة",
          slug: "almansouri-law",
          plan: "PRO",
          status: "ACTIVE",
          isSuspended: false,
        },
      });

      await tx.user.upsert({
        where: {
          email: "lawyer@example.com",
        },
        update: {
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
          phone: "+962790000000",
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: new Date(),
        },
        create: {
          tenantId: tenant.id,
          name: "المحامي أحمد المنصوري",
          email: "lawyer@example.com",
          phone: "+962790000000",
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: new Date(),
        },
      });

      // تنظيف بيانات الديمو القديمة لنفس المكتب فقط حتى لا تتكرر عند تشغيل seed
      await tx.payment.deleteMany({
        where: { tenantId: tenant.id },
      });

      await tx.invoiceItem.deleteMany({
        where: {
          invoice: {
            tenantId: tenant.id,
          },
        },
      });

      await tx.invoice.deleteMany({
        where: { tenantId: tenant.id },
      });

      await tx.document.deleteMany({
        where: { tenantId: tenant.id },
      });

      await tx.task.deleteMany({
        where: { tenantId: tenant.id },
      });

      await tx.appointment.deleteMany({
        where: { tenantId: tenant.id },
      });

      await tx.case.deleteMany({
        where: { tenantId: tenant.id },
      });

      await tx.client.deleteMany({
        where: { tenantId: tenant.id },
      });

      const c1 = await tx.client.create({
        data: {
          tenantId: tenant.id,
          name: "خالد العمري",
          phone: "0501234567",
          email: "khalid@example.com",
          address: "الرياض، حي النخيل",
        },
      });

      const c2 = await tx.client.create({
        data: {
          tenantId: tenant.id,
          name: "سارة القحطاني",
          phone: "0559876543",
          email: "sara@example.com",
          address: "جدة، حي الروضة",
        },
      });

      const c3 = await tx.client.create({
        data: {
          tenantId: tenant.id,
          name: "محمد البلوي",
          phone: "0533456789",
        },
      });

      const c4 = await tx.client.create({
        data: {
          tenantId: tenant.id,
          name: "رنا الحمدان",
          phone: "0771234567",
          email: "rana@example.com",
        },
      });

      const case1 = await tx.case.create({
        data: {
          tenantId: tenant.id,
          clientId: c1.id,
          title: "قضية عمالية — فصل تعسفي",
          caseNumber: "2024/158",
          court: "المحكمة العمالية — الرياض",
          status: CaseStatus.IN_PROGRESS,
          feeAgreed: 8000,
        },
      });

      const case2 = await tx.case.create({
        data: {
          tenantId: tenant.id,
          clientId: c2.id,
          title: "نزاع عقاري — إخلاء وحدة سكنية",
          caseNumber: "2024/203",
          court: "المحكمة العامة — جدة",
          status: CaseStatus.OPEN,
          feeAgreed: 12000,
        },
      });

      const case3 = await tx.case.create({
        data: {
          tenantId: tenant.id,
          clientId: c3.id,
          title: "قضية تجارية — مطالبة بعقد",
          caseNumber: "2024/174",
          court: "المحكمة التجارية — الرياض",
          status: CaseStatus.CLOSED,
          feeAgreed: 15000,
        },
      });

      const case4 = await tx.case.create({
        data: {
          tenantId: tenant.id,
          clientId: c4.id,
          title: "قضية أحوال شخصية",
          caseNumber: "2024/190",
          court: "محكمة الأحوال الشخصية",
          status: CaseStatus.OPEN,
          feeAgreed: 5000,
        },
      });

      await tx.payment.createMany({
        data: [
          {
            tenantId: tenant.id,
            clientId: c1.id,
            caseId: case1.id,
            amount: 5000,
            method: PaymentMethod.BANK_TRANSFER,
            status: PaymentStatus.PAID,
            paidAt: new Date(now.getTime() - 15 * 86400000),
            notes: "دفعة أولى",
          },
          {
            tenantId: tenant.id,
            clientId: c1.id,
            caseId: case1.id,
            amount: 3000,
            method: PaymentMethod.CASH,
            status: PaymentStatus.PENDING,
            notes: "دفعة ثانية عند الحكم",
          },
          {
            tenantId: tenant.id,
            clientId: c2.id,
            caseId: case2.id,
            amount: 6000,
            method: PaymentMethod.BANK_TRANSFER,
            status: PaymentStatus.PAID,
          },
          {
            tenantId: tenant.id,
            clientId: c2.id,
            caseId: case2.id,
            amount: 6000,
            method: PaymentMethod.BANK_TRANSFER,
            status: PaymentStatus.PENDING,
          },
          {
            tenantId: tenant.id,
            clientId: c3.id,
            caseId: case3.id,
            amount: 15000,
            method: PaymentMethod.CHECK,
            status: PaymentStatus.PAID,
            notes: "مبلغ كامل",
          },
          {
            tenantId: tenant.id,
            clientId: c4.id,
            caseId: case4.id,
            amount: 2500,
            method: PaymentMethod.CASH,
            status: PaymentStatus.PAID,
          },
          {
            tenantId: tenant.id,
            clientId: c4.id,
            caseId: case4.id,
            amount: 2500,
            method: PaymentMethod.CASH,
            status: PaymentStatus.PENDING,
          },
        ],
      });

      await tx.appointment.createMany({
        data: [
          {
            tenantId: tenant.id,
            clientId: c1.id,
            caseId: case1.id,
            title: "جلسة استماع أولى",
            type: AppointmentType.COURT_SESSION,
            startTime: new Date(now.getTime() + 2 * 86400000),
            location: "المحكمة العمالية — قاعة 3",
            status: AppointmentStatus.SCHEDULED,
          },
          {
            tenantId: tenant.id,
            clientId: c2.id,
            caseId: case2.id,
            title: "جلسة استئناف #203",
            type: AppointmentType.COURT_SESSION,
            startTime: new Date(now.getTime() + 86400000 + 4 * 3600000),
            location: "محكمة الاستئناف",
            status: AppointmentStatus.SCHEDULED,
          },
          {
            tenantId: tenant.id,
            clientId: c4.id,
            title: "اجتماع موكل المكتب",
            type: AppointmentType.MEETING,
            startTime: new Date(now.getTime() + 5 * 3600000),
            location: "المكتب",
            status: AppointmentStatus.SCHEDULED,
          },
          {
            tenantId: tenant.id,
            clientId: c3.id,
            title: "مراجعة ملف القضية",
            type: AppointmentType.MEETING,
            startTime: new Date(now.getTime() + 5 * 86400000),
            status: AppointmentStatus.SCHEDULED,
          },
        ],
      });

      await tx.task.createMany({
        data: [
          {
            tenantId: tenant.id,
            caseId: case1.id,
            title: "إعداد مذكرة الدفاع",
            priority: TaskPriority.HIGH,
            dueDate: new Date(now.getTime() + 3 * 86400000),
          },
          {
            tenantId: tenant.id,
            caseId: case2.id,
            title: "مراجعة عقد الإيجار",
            priority: TaskPriority.MEDIUM,
            dueDate: new Date(now.getTime() + 7 * 86400000),
          },
          {
            tenantId: tenant.id,
            title: "تجديد رخصة المكتب",
            priority: TaskPriority.LOW,
            dueDate: new Date(now.getTime() + 30 * 86400000),
          },
          {
            tenantId: tenant.id,
            caseId: case3.id,
            title: "أرشفة ملف القضية المغلقة",
            priority: TaskPriority.LOW,
            completed: true,
          },
          {
            tenantId: tenant.id,
            caseId: case1.id,
            title: "طلب تأجيل الجلسة",
            priority: TaskPriority.HIGH,
            dueDate: new Date(now.getTime() + 86400000),
          },
        ],
      });
    },
    {
      maxWait: 20000,
      timeout: 120000,
    },
  );

  console.log("✅ Seed complete!");
  console.log("   Email : lawyer@example.com");
  console.log("   Pass  : Lawyer@123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
