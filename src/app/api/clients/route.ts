import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { APP_TIME_ZONE } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { clientSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { requirePermission, getRequestMeta } from "@/lib/api-auth";
import { hasPermission } from "@/lib/permissions";
import { assertTenantCanCreate, recheckCapacityUnderLock } from "@/lib/billing-limits";
import {
  encryptText,
  decryptText,
  normalizeEmail,
  normalizePhone,
  normalizeNationalId,
  hashSearchValue,
  phoneSearchHashes,
} from "@/lib/encryption";
import {
  buildAppointmentAccessWhere,
  buildCaseAccessWhere,
  buildClientAccessWhere,
} from "@/lib/access-control";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";
import { WRITE_TRANSACTION } from "@/lib/transaction-options";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requirePermission(req, "client.read");
    if (auth.error || !auth.user) return auth.error;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    // Matching a full phone, email or national ID tells the caller whose it
    // is, so only roles that can read those fields may search by them.
    const canSearchContact =
      Boolean(q) && hasPermission(auth.user.role, "client.contact.read");
    const normalizedEmail = canSearchContact ? normalizeEmail(q!) : null;
    const normalizedNationalId = canSearchContact ? normalizeNationalId(q!) : null;

    const emailHash = normalizedEmail ? hashSearchValue(normalizedEmail) : null;
    const phoneHashes = canSearchContact ? phoneSearchHashes(q!) : [];
    const nationalIdHash = normalizedNationalId
      ? hashSearchValue(normalizedNationalId)
      : null;
    const publicId = q && /^\d{1,9}$/.test(q) ? Number(q) : null;

    const pageRaw = Number(searchParams.get("page") || 1);
    const limitRaw = Number(searchParams.get("limit") || 10);

    const page = Number.isNaN(pageRaw) ? 1 : Math.max(pageRaw, 1);
    const limit = Number.isNaN(limitRaw)
      ? 10
      : Math.min(Math.max(limitRaw, 1), 50);

    const skip = (page - 1) * limit;

    const archiveParam = searchParams.get("archive");
    const archive =
      archiveParam === "archived" || archiveParam === "all"
        ? archiveParam
        : "active";
    const requestedWhere: Prisma.ClientWhereInput = {
      ...(archive === "active"
        ? { archivedAt: null }
        : archive === "archived"
          ? { archivedAt: { not: null } }
          : {}),

      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive" as const,
                },
              },
              ...(publicId ? [{ publicId }] : []),
              ...(emailHash ? [{ emailHash }] : []),
              ...(phoneHashes.length > 0 ? [{ phoneHash: { in: phoneHashes } }] : []),
              ...(nationalIdHash ? [{ nationalIdHash }] : []),
            ],
          }
        : {}),
    };
    const where = buildClientAccessWhere(auth.user, requestedWhere);

    // The page's figures are office totals: they never follow the archive
    // filter, so the filter cards keep their numbers while switching.
    const summaryWhere = buildClientAccessWhere(auth.user);
    // "New this month" counts from the 1st in Amman, not in the server's zone.
    const monthStart = DateTime.now().setZone(APP_TIME_ZONE).startOf("month").toJSDate();

    const [data, total, summaryTotal, archivedCount, newThisMonth] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          _count: {
            select: {
              cases: {
                where: buildCaseAccessWhere(auth.user),
              },
              appointments: {
                where: buildAppointmentAccessWhere(auth.user),
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),

      prisma.client.count({ where }),
      prisma.client.count({ where: summaryWhere }),
      prisma.client.count({
        where: { AND: [summaryWhere, { archivedAt: { not: null } }] },
      }),
      prisma.client.count({
        where: { AND: [summaryWhere, { createdAt: { gte: monthStart } }] },
      }),
    ]);

    const decryptedData = data.map((client) => {
      const {
        emailHash: _emailHash,
        phoneHash: _phoneHash,
        nationalIdHash: _nationalIdHash,
        createdById: _createdById,
        ...safeClient
      } = client;
      const revealSensitive = hasPermission(auth.user.role, "client.contact.read");

      return {
        ...safeClient,
        email: revealSensitive ? decryptText(client.email) : null,
        phone: revealSensitive ? decryptText(client.phone) : null,
        nationalId: revealSensitive ? decryptText(client.nationalId) : null,
        address: revealSensitive ? decryptText(client.address) : null,
        notes: revealSensitive ? decryptText(client.notes) : null,
      };
    });

    return ok({
      data: decryptedData,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        summary: {
          // "All" on the clients page is every client not archived.
          total: summaryTotal - archivedCount,
          archived: archivedCount,
          newThisMonth,
        },
      },
    });
  });
}

/** 400 PLAN_LIMIT_REACHED while the subscription allows creating, else 402. */
function clientLimitError(check: {
  message: string;
  billing?: { canCreate?: boolean } | null;
}) {
  const isPlanLimit = check.billing?.canCreate === true;
  return err(check.message, isPlanLimit ? 400 : 402, {
    code: isPlanLimit ? "PLAN_LIMIT_REACHED" : "SUBSCRIPTION_INACTIVE",
    resource: "clients",
    billing: check.billing ?? null,
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requirePermission(req, "client.create");
    if (auth.error || !auth.user) return auth.error;

    const meta = getRequestMeta(req);
    const body = await req.json().catch(() => ({}));
    const parsed = clientSchema.safeParse(body);

    if (!parsed.success) {
      return err(
        // Shown as is in the form: the messages alone, no field paths.
        parsed.error.issues.map((i) => i.message).join(" | "),
        400,
        parsed.error.flatten(),
      );
    }

    const normalizedEmail = normalizeEmail(parsed.data.email);
    const normalizedPhone = normalizePhone(parsed.data.phone);
    const normalizedNationalId = normalizeNationalId(parsed.data.nationalId);

    // The normalized values are what is stored, so the ciphertext and the
    // search hash always describe the same string.
    const secureData = {
      ...parsed.data,
      email: encryptText(normalizedEmail ?? parsed.data.email),
      phone: encryptText(normalizedPhone ?? parsed.data.phone),
      nationalId: encryptText(normalizedNationalId ?? parsed.data.nationalId),
      address: encryptText(parsed.data.address),
      notes: encryptText(parsed.data.notes),
      emailHash: normalizedEmail ? hashSearchValue(normalizedEmail) : null,
      phoneHash: normalizedPhone ? hashSearchValue(normalizedPhone) : null,
      nationalIdHash: normalizedNationalId
        ? hashSearchValue(normalizedNationalId)
        : null,
    };

    const duplicateConditions = [
      // Legacy hashes too, until the backfill has run (phoneSearchHashes).
      ...(secureData.phoneHash
        ? [{ phoneHash: { in: phoneSearchHashes(normalizedPhone) } }]
        : []),
      ...(secureData.nationalIdHash
        ? [{ nationalIdHash: secureData.nationalIdHash }]
        : []),
      ...(secureData.emailHash ? [{ emailHash: secureData.emailHash }] : []),
    ];

    // Billing state read once, outside the transaction; only the count, which
    // concurrent creates race on, is redone under the tenant lock.
    const limitCheck = await assertTenantCanCreate(auth.user.tenantId, "clients");
    if (!limitCheck.ok) return clientLimitError(limitCheck);
    const clientLimit = "limit" in limitCheck ? limitCheck.limit ?? null : null;

    const createResult = await prisma.$transaction(async (tx) => {
      await lockTenantMutation(tx, auth.user.tenantId);

      const capacity = await recheckCapacityUnderLock(
        auth.user.tenantId,
        "clients",
        clientLimit,
        tx,
      );

      if (!capacity.ok) {
        return { error: "LIMIT" as const, capacity };
      }

      const duplicateClient =
        duplicateConditions.length > 0
          ? await tx.client.findFirst({
              where: {
                tenantId: auth.user.tenantId,
                OR: duplicateConditions,
              },
              select: {
                id: true,
                publicId: true,
                name: true,
                archivedAt: true,
              },
            })
          : null;

      if (duplicateClient) {
        return { error: "DUPLICATE" as const, duplicateClient };
      }

      const client = await tx.client.create({
        data: {
          tenantId: auth.user.tenantId,
          createdById: auth.user.userId,
          ...secureData,
        },
      });

      await tx.activity.create({
        data: {
          actorId: auth.user.userId,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          tenantId: auth.user.tenantId,
          type: "CLIENT_CREATED",
          title: "تم إضافة موكل جديد",
          message: client.name,
          entityType: "CLIENT",
          entityId: client.id,
        },
      });

      return { client };
    }, WRITE_TRANSACTION);

    if ("error" in createResult) {
      if (createResult.error === "LIMIT") {
        return clientLimitError({
          ...createResult.capacity,
          billing: limitCheck.billing ?? null,
        });
      }

      const { duplicateClient } = createResult;
      if (!duplicateClient) throw new Error("client create: unexpected transaction result");
      // Whether this user may see the existing record: a read, after the commit.
      const duplicateIsVisible =
        (await prisma.client.count({
          where: buildClientAccessWhere(auth.user, { id: duplicateClient.id }),
        })) > 0;

      return err(
        duplicateIsVisible
          ? duplicateClient.archivedAt
            ? "يوجد موكل مؤرشف بنفس البيانات. يمكنك استعادته بدل إنشاء موكل جديد."
            : "يوجد موكل بنفس البيانات داخل المكتب."
          : "هذه البيانات مستخدمة داخل المكتب. تواصل مع مدير المكتب إذا احتجت الوصول للسجل.",
        409,
        {
          code: "CLIENT_DUPLICATE",
          ...(duplicateIsVisible
            ? {
                clientId: duplicateClient.id,
                clientPublicId: duplicateClient.publicId,
                archived: !!duplicateClient.archivedAt,
              }
            : {}),
        },
      );
    }

    const client = createResult.client;

    const {
      emailHash: _emailHash,
      phoneHash: _phoneHash,
      nationalIdHash: _nationalIdHash,
      createdById: _createdById,
      ...safeClient
    } = client;

    return ok(
      {
        ...safeClient,
        email: decryptText(client.email),
        phone: decryptText(client.phone),
        nationalId: decryptText(client.nationalId),
        address: decryptText(client.address),
        notes: decryptText(client.notes),
      },
      201,
    );
  });
}
