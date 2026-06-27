const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = "alnazertalaalnazer@gmail.com";

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      emailVerifiedAt: true,
      tenant: {
        select: {
          name: true,
          status: true
        }
      }
    }
  });

  console.dir(user, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
