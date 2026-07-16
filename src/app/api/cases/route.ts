import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySameOrigin } from "@/lib/csrf";
import { caseSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api-response";
import { logActivity } from "@/lib/activity";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { assertTenantCanCreate } from "@/lib/billing-limits";
import { buildCaseAccessWhere } from "@/lib/access-control";

const allowedStatuses = ["OPEN", "IN_PROGRESS", "CLOSED", "ARCHIVED"] as const;

const caseUserSelect = {
  id: true,
  name: true,
  role: true,
  isActive: true,
} as const;

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const sp = new URL(req.url).searchParams;

    const status = sp.get("status");
    const clientId = sp.get("clientId");
    const q = sp.get("q")?.trim();
    const includeArchivedClients = sp.get("includeArchivedClients") === "true";
    const sort = sp.get("sort") === "updated" ? "updated" : "created";

    const pageRaw = Number(sp.get("page") || 1);
    const limitRaw = Number(sp.get("limit") || 10);

    const page = Number.isNaN(pageRaw) ? 1 : Math.max(pageRaw, 1);
    const limit = Number.isNaN(limitRaw)
      ? 10
      : Math.min(Math.max(limitRaw, 1), 50);

    const skip = (page - 1) * limit;

    if (status && !allowedStatuses.includes(status as any)) {
      return err("حالة القضية غير صالحة", 400);
    }

    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: {
          id: clientId,
          tenantId: auth.user.tenantId,
        },
        select: {
          id: true,
        },
      });

      if (!clientExists) {
        return err("الموكل غير موجود داخل هذا المكتب", 404);
      }
    }

    const requestedWhere: Prisma.CaseWhereInput = {
      ...(includeArchivedClients
        ? {}
        : {
            client: {
              archivedAt: null,
            },
          }),

      ...(status ? { status: status as any } : {}),
      ...(clientId ? { clientId } : {}),

      ...(q
        ? {
            OR: [
              {
                title: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                caseNumber: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                court: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                judgeName: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                plaintiffName: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                defendantName: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                client: {
                  name: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
              {
                leadLawyer: {
                  name: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    };

    const where = buildCaseAccessWhere(auth.user, requestedWhere);

    const [data, total] = await Promise.all([
      prisma.case.findMany({
        where,
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
          payments: {
            select: {
              amount: true,
              status: true,
            },
          },
          _count: {
            select: {
              appointments: true,
              documents: true,
              tasks: true,
            },
          },
        },
        orderBy:
          sort === "updated"
            ? [{ updatedAt: "desc" }, { createdAt: "desc" }]
            : [{ createdAt: "desc" }],
        skip,
        take: limit,
      }),

      prisma.case.count({ where }),
    ]);

    return ok({
      data,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);
    if (auth.error || !auth.user) return auth.error;

    const limitCheck = await assertTenantCanCreate(auth.user.tenantId, "cases");

    if (!limitCheck.ok) {
      const isPlanLimit = limitCheck.billing?.canCreate === true;

      return err(limitCheck.message, isPlanLimit ? 400 : 402, {
        code: isPlanLimit ? "PLAN_LIMIT_REACHED" : "SUBSCRIPTION_INACTIVE",
        resource: "cases",
        billing: limitCheck.billing ?? null,
      });
    }

    const meta = getRequestMeta(req);
    const body = await req.json().catch(() => ({}));
    const parsed = caseSchema.safeParse(body);

    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }

    const client = await prisma.client.findFirst({
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

    if (!client) {
      return err("الموكل غير موجود", 404);
    }

    if (client.archivedAt) {
      return err("لا يمكن إنشاء قضية جديدة لموكل مؤرشف", 400);
    }

    if (parsed.data.caseNumber) {
      const exists = await prisma.case.findFirst({
        where: {
          tenantId: auth.user.tenantId,
          caseNumber: parsed.data.caseNumber,
        },
        select: {
          id: true,
        },
      });

      if (exists) {
        return err("رقم القضية مستخدم مسبقًا", 409);
      }
    }

    const leadLawyerId =
      parsed.data.leadLawyerId || auth.user.userId;

    const leadLawyer = await prisma.user.findFirst({
      where: {
        id: leadLawyerId,
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

    const requestedMemberIds = new Set(parsed.data.memberIds || []);

    // The lawyer who creates a case must retain access even when another
    // lawyer is selected as the lead.
    if (
      auth.user.role === "LAWYER" &&
      leadLawyerId !== auth.user.userId
    ) {
      requestedMemberIds.add(auth.user.userId);
    }

    const memberIds = Array.from(requestedMemberIds).filter(
      (memberId) => memberId !== leadLawyerId,
    );

    if (memberIds.length > 0) {
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

    const newCase = await prisma.$transaction(async (tx) => {
      return tx.case.create({
        data: {
          tenantId: auth.user!.tenantId,
          ...caseData,
          leadLawyerId,
          ...(memberIds.length > 0
            ? {
                members: {
                  create: memberIds.map((userId) => ({
                    tenantId: auth.user!.tenantId,
                    userId,
                  })),
                },
              }
            : {}),
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

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: "CASE_CREATED",
      title: "تم إنشاء قضية جديدة",
      message: newCase.title,
      entityType: "CASE",
      entityId: newCase.id,
    });

    return ok(newCase, 201);
  });
}
