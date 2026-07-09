const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    throw new Error("Usage: node scripts/find-tenant-by-user-email.js user@email.com");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      emailVerifiedAt: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      },
    },
  });

  console.dir(user, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
