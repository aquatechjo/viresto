import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { caseSchema } from "@/lib/validations";
import { ok, err, notFound } from "@/lib/api-response";
import { logActivity } from "@/lib/activity";
import { apiHandler } from "@/lib/api-handler";
import { decryptText } from "@/lib/encryption";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";

type Params = { params: Promise<{ id: string }> };

const caseUserSelect = {
  id: true,
  name: true,
  role: true,
  isActive: true,
} as const;

function safeDecrypt(value?: string | null) {
  if (!value) return null;

  try {
    return decryptText(value);
  } catch {
    return value;
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const { id } = await params;
    const tenantId = auth.user.tenantId;

    const c = await prisma.case.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            nationalId: true,
            address: true,
            archivedAt: true,
          },
        },
        leadLawyer: {
          select: caseUserSelect,
        },
        members: {
          include: {
            user: {
              select: caseUserSelect,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        payments: {
          where: { tenantId },
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
                total: true,
              },
            },
          },
          orderBy: { paidAt: "desc" },
        },
        appointments: {
          where: { tenantId },
          orderBy: { startTime: "asc" },
        },
        documents: {
          where: { tenantId },
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            notes: true,
            tags: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        tasks: {
          where: { tenantId },
          include: {
            assignedTo: {
              select: caseUserSelect,
            },
            createdBy: {
              select: caseUserSelect,
            },
          },
          orderBy: [
            { completed: "asc" },
            { dueDate: "asc" },
            { createdAt: "desc" },
          ],
        },
        invoices: {
          where: { tenantId },
          include: {
            payments: {
              select: {
                id: true,
                status: true,
                amount: true,
                method: true,
                paidAt: true,
                reference: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
            items: {
              select: {
                id: true,
                description: true,
                quantity: true,
                unitPrice: true,
                total: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!c) {
      return notFound("القضية غير موجودة");
    }

    const paymentIds = c.payments.map((p) => p.id);
    const appointmentIds = c.appointments.map((a) => a.id);
    const documentIds = c.documents.map((d) => d.id);
    const taskIds = c.tasks.map((t) => t.id);
    const invoiceIds = c.invoices.map((i) => i.id);

    const activityFilters = [
      { entityType: "CASE", entityId: c.id },
      ...(paymentIds.length
        ? [{ entityType: "PAYMENT", entityId: { in: paymentIds } }]
        : []),
      ...(appointmentIds.length
        ? [{ entityType: "APPOINTMENT", entityId: { in: appointmentIds } }]
        : []),
      ...(documentIds.length
        ? [{ entityType: "DOCUMENT", entityId: { in: documentIds } }]
        : []),
      ...(taskIds.length
        ? [{ entityType: "TASK", entityId: { in: taskIds } }]
        : []),
      ...(invoiceIds.length
        ? [{ entityType: "INVOICE", entityId: { in: invoiceIds } }]
        : []),
    ];

    const activities = await prisma.activity.findMany({
      where: {
        tenantId,
        OR: activityFilters,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return ok({
      ...c,
      client: {
        ...c.client,
        email: safeDecrypt(c.client.email),
        phone: safeDecrypt(c.client.phone),
        nationalId: safeDecrypt(c.client.nationalId),
        address: safeDecrypt(c.client.address),
      },
      activities,
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تعديل قضية",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);
    const { id } = await params;

    const exists = await prisma.case.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        clientId: true,
        leadLawyerId: true,
        client: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
          },
        },
      },
    });

    if (!exists) {
      return notFound("القضية غير موجودة");
    }

    if (exists.client?.archivedAt) {
      return err("لا يمكن تعديل قضية مرتبطة بموكل مؤرشف", 400);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = caseSchema.partial().safeParse(body);

    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }

    if (Object.keys(parsed.data).length === 0) {
      return err("لا توجد بيانات للتعديل", 400);
    }

    if (parsed.data.clientId) {
      const clientExists = await prisma.client.findFirst({
        where: {
          id: parsed.data.clientId,
          tenantId: auth.user.tenantId,
        },
        select: {
          id: true,
          name: true,
          archivedAt: true,
        },
      });

      if (!clientExists) {
        return err("لا يمكن ربط القضية بموكل لا يتبع هذا المكتب", 403);
      }

      if (clientExists.archivedAt) {
        return err("لا يمكن ربط القضية بموكل مؤرشف", 400);
      }
    }

    if (parsed.data.caseNumber) {
      const duplicate = await prisma.case.findFirst({
        where: {
          tenantId: auth.user.tenantId,
          caseNumber: parsed.data.caseNumber,
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return err("رقم القضية مستخدم مسبقًا", 409);
      }
    }

    const nextLeadLawyerId =
      parsed.data.leadLawyerId !== undefined
        ? parsed.data.leadLawyerId
        : exists.leadLawyerId;

    if (!nextLeadLawyerId) {
      return err("يجب تحديد المحامي المسؤول عن القضية", 400);
    }

    const leadLawyer = await prisma.user.findFirst({
      where: {
        id: nextLeadLawyerId,
        tenantId: auth.user.tenantId,
        isActive: true,
        role: {
          in: ["ADMIN", "LAWYER"],
        },
      },
      select: caseUserSelect,
    });

    if (!leadLawyer) {
      return err("المحامي المسؤول غير موجود أو لا يملك صلاحية محامٍ", 400);
    }

    const memberIds =
      parsed.data.memberIds !== undefined
        ? Array.from(new Set(parsed.data.memberIds)).filter(
            (memberId) => memberId !== nextLeadLawyerId,
          )
        : undefined;

    if (memberIds && memberIds.length > 0) {
      const validMembers = await prisma.user.count({
        where: {
          tenantId: auth.user.tenantId,
          isActive: true,
          id: {
            in: memberIds,
          },
        },
      });

      if (validMembers !== memberIds.length) {
        return err("أحد أعضاء القضية غير موجود أو حسابه معطل", 400);
      }
    }

    const {
      memberIds: _memberIds,
      leadLawyerId: _leadLawyerId,
      ...caseData
    } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      if (memberIds !== undefined) {
        await tx.caseMember.deleteMany({
          where: {
            caseId: exists.id,
            tenantId: auth.user!.tenantId,
          },
        });

        if (memberIds.length > 0) {
          await tx.caseMember.createMany({
            data: memberIds.map((userId) => ({
              tenantId: auth.user!.tenantId,
              caseId: exists.id,
              userId,
            })),
          });
        }
      } else {
        await tx.caseMember.deleteMany({
          where: {
            caseId: exists.id,
            tenantId: auth.user!.tenantId,
            userId: nextLeadLawyerId,
          },
        });
      }

      return tx.case.update({
        where: {
          id: exists.id,
        },
        data: {
          ...caseData,
          leadLawyerId: nextLeadLawyerId,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              archivedAt: true,
            },
          },
          leadLawyer: {
            select: caseUserSelect,
          },
          members: {
            include: {
              user: {
                select: caseUserSelect,
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });
    });

    const statusChanged =
      parsed.data.status !== undefined && parsed.data.status !== exists.status;

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: statusChanged ? "CASE_STATUS_CHANGED" : "CASE_UPDATED",
      title: statusChanged ? "تم تغيير حالة القضية" : "تم تعديل قضية",
      message: statusChanged
        ? `${exists.status} → ${updated.status}`
        : updated.title,
      entityType: "CASE",
      entityId: updated.id,
    });

    return ok(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "حذف قضية",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);
    const { id } = await params;

    const exists = await prisma.case.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        title: true,
        client: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
          },
        },
      },
    });

    if (!exists) {
      return notFound("القضية غير موجودة");
    }

    if (exists.client?.archivedAt) {
      return err("لا يمكن حذف قضية مرتبطة بموكل مؤرشف", 400);
    }

    const [
      paymentsCount,
      appointmentsCount,
      documentsCount,
      tasksCount,
      invoicesCount,
    ] = await prisma.$transaction([
      prisma.payment.count({
        where: {
          tenantId: auth.user.tenantId,
          caseId: exists.id,
        },
      }),
      prisma.appointment.count({
        where: {
          tenantId: auth.user.tenantId,
          caseId: exists.id,
        },
      }),
      prisma.document.count({
        where: {
          tenantId: auth.user.tenantId,
          caseId: exists.id,
        },
      }),
      prisma.task.count({
        where: {
          tenantId: auth.user.tenantId,
          caseId: exists.id,
        },
      }),
      prisma.invoice.count({
        where: {
          tenantId: auth.user.tenantId,
          caseId: exists.id,
        },
      }),
    ]);

    const relatedTotal =
      paymentsCount +
      appointmentsCount +
      documentsCount +
      tasksCount +
      invoicesCount;

    if (relatedTotal > 0) {
      return err(
        "لا يمكن حذف القضية لأنها تحتوي على عناصر مرتبطة. احذف أو انقل المواعيد والمهام والمستندات والدفعات والفواتير أولًا.",
        409,
        {
          payments: paymentsCount,
          appointments: appointmentsCount,
          documents: documentsCount,
          tasks: tasksCount,
          invoices: invoicesCount,
        },
      );
    }

    const deleted = await prisma.case.deleteMany({
      where: {
        id: exists.id,
        tenantId: auth.user.tenantId,
      },
    });

    if (deleted.count === 0) {
      return notFound("القضية غير موجودة");
    }

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: "CASE_DELETED",
      title: "تم حذف قضية",
      message: exists.title,
      entityType: "CASE",
      entityId: exists.id,
    });

    return ok({ deleted: true });
  });
}
