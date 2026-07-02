const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const plans = [
  {
    code: "BASIC",
    name: "Basic",
    description: "للمحامي الفردي الذي يحتاج الأساسيات لإدارة مكتبه.",
    currency: "JOD",

    // الأسعار مخزنة بالفلس: 20000 = 20 JOD
    priceMonthly: 20000,
    priceYearly: 240000,

    maxUsers: 1,
    maxClients: 100,
    maxCases: 150,

    // لا نعتمد عدد المستندات كحد حقيقي. الحد الحقيقي صار التخزين.
    // نتركه عاليًا حتى لا يكسر أي كود قديم ما زال يقرأ هذا الحقل.
    maxDocuments: 999999,

    // 2GB = 2048MB
    maxStorageMb: 2048,

    aiEnabled: false,
    sortOrder: 1,
  },
  {
    code: "PRO",
    name: "Pro",
    description: "الخطة الأنسب للمكاتب الصغيرة التي تحتاج فريق وميزات AI.",
    currency: "JOD",

    // سعر الإطلاق: 30 JOD
    // السعر الرسمي 40 JOD موجود في src/config/plans.ts للعرض.
    priceMonthly: 30000,
    priceYearly: 360000,

    maxUsers: 5,
    maxClients: 500,
    maxCases: 1000,
    maxDocuments: 999999,

    // 20GB = 20480MB
    maxStorageMb: 20480,

    aiEnabled: true,
    sortOrder: 2,
  },
  {
    code: "BUSINESS",
    name: "Business",
    description: "للمكاتب المتوسطة والكبيرة التي تحتاج حدود أعلى ودعم أقوى.",
    currency: "JOD",

    // سعر الإطلاق: 60 JOD
    // السعر الرسمي 80 JOD موجود في src/config/plans.ts للعرض.
    priceMonthly: 60000,
    priceYearly: 720000,

    maxUsers: 15,
    maxClients: 2000,
    maxCases: 5000,
    maxDocuments: 999999,

    // 75GB = 76800MB
    maxStorageMb: 76800,

    aiEnabled: true,
    sortOrder: 3,
  },
];

async function main() {
  for (const plan of plans) {
    await prisma.billingPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  console.log("Billing plans seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });