import type { Prisma } from "@prisma/client";
import type { UserRole } from "@/lib/permissions";

export type AccessControlUser = {
  userId: string;
  tenantId: string;
  role: UserRole;
};

function assignedCaseScope(user: AccessControlUser): Prisma.CaseWhereInput {
  return {
    tenantId: user.tenantId,
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

function accessibleClientScope(
  user: AccessControlUser,
): Prisma.ClientWhereInput {
  const assignedCase = assignedCaseScope(user);

  if (user.role === "LAWYER") {
    return {
      OR: [
        { cases: { some: assignedCase } },
        // A newly created client has no case yet. Lawyers must be able to
        // complete the intake flow and create the first case.
        { cases: { none: {} } },
      ],
    };
  }

  return {
    cases: {
      some: assignedCase,
    },
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

export function buildClientAccessWhere(
  user: AccessControlUser,
  requestedWhere: Prisma.ClientWhereInput = {},
): Prisma.ClientWhereInput {
  const accessWhere =
    user.role === "ADMIN" ? {} : accessibleClientScope(user);

  return {
    AND: [
      { tenantId: user.tenantId },
      accessWhere,
      requestedWhere,
    ],
  };
}

export function buildClientIdentifierAccessWhere(
  identifier: string,
  user: AccessControlUser,
): Prisma.ClientWhereInput {
  const publicId = Number(identifier);
  const hasPublicId = Number.isSafeInteger(publicId) && publicId > 0;

  return buildClientAccessWhere(user, {
    OR: hasPublicId
      ? [{ id: identifier }, { publicId }]
      : [{ id: identifier }],
  });
}

export function buildDocumentAccessWhere(
  user: AccessControlUser,
  requestedWhere: Prisma.DocumentWhereInput = {},
): Prisma.DocumentWhereInput {
  const accessWhere: Prisma.DocumentWhereInput =
    user.role === "ADMIN"
      ? {}
      : {
          case: {
            is: buildCaseAccessWhere(user),
          },
        };

  return {
    AND: [
      { tenantId: user.tenantId },
      accessWhere,
      requestedWhere,
    ],
  };
}

export function buildInvoiceAccessWhere(
  user: AccessControlUser,
  requestedWhere: Prisma.InvoiceWhereInput = {},
): Prisma.InvoiceWhereInput {
  const accessWhere: Prisma.InvoiceWhereInput =
    user.role === "ADMIN"
      ? {}
      : user.role === "STAFF"
        ? { id: { in: [] } }
        : {
            OR: [
              { case: { is: buildCaseAccessWhere(user) } },
              {
                caseId: null,
                client: { is: buildClientAccessWhere(user) },
              },
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

export function buildInvoiceIdentifierAccessWhere(
  identifier: string,
  user: AccessControlUser,
): Prisma.InvoiceWhereInput {
  const publicId = Number(identifier);
  const hasPublicId = Number.isSafeInteger(publicId) && publicId > 0;

  return buildInvoiceAccessWhere(user, {
    OR: hasPublicId
      ? [{ id: identifier }, { publicId }]
      : [{ id: identifier }],
  });
}

export function buildPaymentAccessWhere(
  user: AccessControlUser,
  requestedWhere: Prisma.PaymentWhereInput = {},
): Prisma.PaymentWhereInput {
  const accessWhere: Prisma.PaymentWhereInput =
    user.role === "ADMIN"
      ? {}
      : user.role === "STAFF"
        ? { id: { in: [] } }
        : {
            OR: [
              { case: { is: buildCaseAccessWhere(user) } },
              {
                caseId: null,
                client: { is: buildClientAccessWhere(user) },
              },
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
