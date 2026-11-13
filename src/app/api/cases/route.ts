import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySameOrigin } from "@/lib/csrf";
import { caseSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api-response";
import { requirePermission, getRequestMeta } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { assertTenantCanCreate, recheckCapacityUnderLock } from "@/lib/billing-limits";
import {
  buildCaseAccessWhere,
  buildClientAccessWhere,
} from "@/lib/access-control";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";
import { WRITE_TRANSACTION } from "@/lib/transaction-options";
import { caseMembersForCreate } from "@/lib/case-team";
import { rolesWithPermission } from "@/lib/permissions";

const allowedStatuses = ["OPEN", "IN_PROGRESS", "CLOSED", "ARCHIVED"] as const;

const caseUserSelect = {
  id: true,
  name: true,
  role: true,
  isActive: true,
} as const;

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requirePermission(req, "case.read");
    if (auth.error || !auth.user) return auth.error;

    const sp = new URL(req.url).searchParams;

    const status = sp.get("status");
    const clientId = sp.get("clientId");
    const q = sp.get("q")?.trim();
    const includeArchivedClients = sp.get("includeArchivedClients") === "true";
    const archivedClientOnly = sp.get("archivedClientOnly") === "true";
    // The cases page's "All": everything not archived, i.e. not ARCHIVED and
    // not a case of an archived client (those only show on their own cards).
    const excludeArchived = sp.get("excludeArchived") === "true";
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
        where: buildClientAccessWhere(auth.user, { id: clientId }),
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
      ...(archivedClientOnly
        ? { client: { archivedAt: { not: null } } }
        : {}),

      ...(status
        ? { status: status as any }
        : excludeArchived
          ? { status: { not: "ARCHIVED" as const } }
          : {}),
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

    // Figures with fixed meanings, whatever the request filters: status
    // counts cover cases of non-archived clients (as the status cards list
    // them), "archived" is every ARCHIVED case, and the money covers every
    // case in the user's access, as before.
    const summaryWhere = buildCaseAccessWhere(auth.user);
    const currentClientWhere = buildCaseAccessWhere(auth.user, {
      client: { archivedAt: null },
    });

    const [data, total, statusCounts, feeAggregate, paidAggregate, archivedClientCount, archivedCount] =
      await Promise.all([
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
      prisma.case.groupBy({
        by: ["status"],
        where: currentClientWhere,
        _count: { _all: true },
      }),
      prisma.case.aggregate({
        where: summaryWhere,
        _sum: { feeAgreed: true },
      }),
      prisma.payment.aggregate({
        where: { status: "PAID", case: summaryWhere },
        _sum: { amount: true },
      }),
      prisma.case.count({
        where: buildCaseAccessWhere(auth.user, {
          client: { archivedAt: { not: null } },
        }),
      }),
      prisma.case.count({
        where: buildCaseAccessWhere(auth.user, { status: "ARCHIVED" }),
      }),
    ]);

    const counts: Record<string, number> = Object.fromEntries(
      statusCounts.map((item) => [item.status, item._count._all]),
    );
    // "All" on the cases page: not ARCHIVED and the client not archived.
    const allCount = (counts.OPEN || 0) + (counts.IN_PROGRESS || 0) + (counts.CLOSED || 0);
    const totalFees = Number(feeAggregate._sum.feeAgreed || 0);
    const totalPaid = Number(paidAggregate._sum.amount || 0);

    return ok({
      data,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        summary: {
          counts,
          allCount,
          archivedCount,
          archivedClientCount,
          totalFees,
          totalPaid,
          totalRemaining: Math.max(0, totalFees - totalPaid),
        },
      },
    });
  });
}

/** 400 PLAN_LIMIT_REACHED while the subscription allows creating, else 402. */
function limitError(check: {
  message: string;
  billing?: { canCreate?: boolean } | null;
}) {
  const isPlanLimit = check.billing?.canCreate === true;
  return err(check.message, isPlanLimit ? 400 : 402, {
    code: isPlanLimit ? "PLAN_LIMIT_REACHED" : "SUBSCRIPTION_INACTIVE",
    resource: "cases",
    billing: check.billing ?? null,
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requirePermission(req, "case.create");
    if (auth.error || !auth.user) return auth.error;

    const meta = getRequestMeta(req);
    const body = await req.json().catch(() => ({}));
    const parsed = caseSchema.safeParse(body);

    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }

    const client = await prisma.client.findFirst({
      where: buildClientAccessWhere(auth.user, { id: parsed.data.clientId }),
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
          in: rolesWithPermission("case.lead"),
        },
      },
      select: caseUserSelect,
    });

    if (!leadLawyer) {
      return err("المحامي المسؤول غير موجود أو لا يملك صلاحية محامٍ", 400);
    }

    // A lawyer who creates a case stays on it, as a member when another
    // lawyer leads it.
    const memberIds = caseMembersForCreate({
      actor: auth.user,
      leadLawyerId,
      memberIds: parsed.data.memberIds,
    });

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

    // Billing state (office active, subscription, plan limit): read once,
    // outside the transaction. Only the count, which two concurrent creates
    // race on, is redone under the tenant lock below.
    const limitCheck = await assertTenantCanCreate(auth.user.tenantId, "cases");
    if (!limitCheck.ok) return limitError(limitCheck);
    const caseLimit = "limit" in limitCheck ? limitCheck.limit ?? null : null;

    // Only what must be atomic runs in the transaction: the lock, the
    // capacity recount, the case-number check (no unique index on it), and
    // the writes. The client, lead lawyer and members were checked above and
    // the foreign keys still guarantee they exist. Explicit timeouts: the 5s
    // default expired on a slow database link (P2028, 2026-11-13).
    const createResult = await prisma.$transaction(
      async (tx) => {
        await lockTenantMutation(tx, auth.user.tenantId);

        const capacity = await recheckCapacityUnderLock(
          auth.user.tenantId,
          "cases",
          caseLimit,
          tx,
        );
        if (!capacity.ok) return { error: "LIMIT" as const, capacity };

        if (parsed.data.caseNumber) {
          const duplicateCase = await tx.case.findFirst({
            where: {
              tenantId: auth.user.tenantId,
              caseNumber: parsed.data.caseNumber,
            },
            select: { id: true },
          });
          if (duplicateCase) return { error: "CASE_NUMBER" as const };
        }

        const created = await tx.case.create({
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
          select: { id: true, title: true },
        });

        await tx.activity.create({
          data: {
            actorId: auth.user.userId,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            tenantId: auth.user.tenantId,
            type: "CASE_CREATED",
            title: "تم إنشاء قضية جديدة",
            message: created.title,
            entityType: "CASE",
            entityId: created.id,
          },
        });

        return { created };
      },
      WRITE_TRANSACTION,
    );

    if ("error" in createResult) {
      if (createResult.error === "LIMIT") {
        return limitError({
          ...createResult.capacity,
          billing: limitCheck.billing ?? null,
        });
      }
      return err("رقم القضية مستخدم مسبقًا", 409);
    }

    // The response shape, read after the commit (not inside the lock).
    const newCase = await prisma.case.findUniqueOrThrow({
      where: { id: createResult.created.id },
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

    return ok(newCase, 201);
  });
}
