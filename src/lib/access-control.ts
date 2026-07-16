import type { Prisma } from "@prisma/client";
import type { UserRole } from "@/lib/permissions";

export type AccessControlUser = {
  userId: string;
  tenantId: string;
  role: UserRole;
};

function assignedCaseScope(user: AccessControlUser): Prisma.CaseWhereInput {
  return {
    OR: [
      { leadLawyerId: user.userId },
      {
        members: {
          some: {
            tenantId: user.tenantId,
            userId: user.userId,
          },
        },
      },
      {
        tasks: {
          some: {
            tenantId: user.tenantId,
            assignedToId: user.userId,
          },
        },
      },
      {
        appointments: {
          some: {
            tenantId: user.tenantId,
            assignedToId: user.userId,
          },
        },
      },
    ],
  };
}

export function buildCaseAccessWhere(
  user: AccessControlUser,
  requestedWhere: Prisma.CaseWhereInput = {},
): Prisma.CaseWhereInput {
  const accessWhere =
    user.role === "ADMIN" ? {} : assignedCaseScope(user);

  return {
    AND: [
      { tenantId: user.tenantId },
      accessWhere,
      requestedWhere,
    ],
  };
}

export function buildCaseIdentifierAccessWhere(
  identifier: string,
  user: AccessControlUser,
): Prisma.CaseWhereInput {
  const publicId = Number(identifier);
  const hasPublicId = Number.isSafeInteger(publicId) && publicId > 0;

  return buildCaseAccessWhere(user, {
    OR: hasPublicId
      ? [{ id: identifier }, { publicId }]
      : [{ id: identifier }],
  });
}

export function buildTaskAccessWhere(
  user: AccessControlUser,
  requestedWhere: Prisma.TaskWhereInput = {},
): Prisma.TaskWhereInput {
  const accessWhere: Prisma.TaskWhereInput =
    user.role === "ADMIN"
      ? {}
      : {
          OR: [
            { assignedToId: user.userId },
            { createdById: user.userId },
            { case: { is: buildCaseAccessWhere(user) } },
          ],
        };

  return {
    AND: [
      { tenantId: user.tenantId },
      accessWhere,
      requestedWhere,
    ],
  };
}

export function buildAppointmentAccessWhere(
  user: AccessControlUser,
  requestedWhere: Prisma.AppointmentWhereInput = {},
): Prisma.AppointmentWhereInput {
  const accessWhere: Prisma.AppointmentWhereInput =
    user.role === "ADMIN"
      ? {}
      : {
          OR: [
            { assignedToId: user.userId },
            { createdById: user.userId },
            { case: { is: buildCaseAccessWhere(user) } },
          ],
        };

  return {
    AND: [
      { tenantId: user.tenantId },
      accessWhere,
      requestedWhere,
    ],
  };
}
