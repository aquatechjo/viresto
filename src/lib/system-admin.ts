import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireSystemAdmin() {
  const session = await getSession();

  if (!session?.userId || !session?.tenantId) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      tenantId: session.tenantId,
      isActive: true,
      isSystemAdmin: true,
      ...(session.sessionId
        ? {
            sessions: {
              some: {
                id: session.sessionId,
                isActive: true,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isSystemAdmin: true,
    },
  });

  if (!user) {
    throw new Error("Forbidden");
  }

  return user;
}
