import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { logActivity } from "@/lib/activity";
import { verifySameOrigin } from "@/lib/csrf";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { assertTenantCanCreate } from "@/lib/billing-limits";
import {
  encryptText,
  decryptText,
  normalizeEmail,
  normalizePhone,
  hashSearchValue,
} from "@/lib/encryption";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    const normalizedEmail = q ? normalizeEmail(q) : null;
    const normalizedPhone = q ? normalizePhone(q) : null;

    const emailHash = normalizedEmail ? hashSearchValue(normalizedEmail) : null;
    const phoneHash = normalizedPhone ? hashSearchValue(normalizedPhone) : null;
    const nationalIdHash = q ? hashSearchValue(q.trim()) : null;

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
    const where = {
      tenantId: auth.user.tenantId,

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
              ...(emailHash ? [{ emailHash }] : []),
              ...(phoneHash ? [{ phoneHash }] : []),
              ...(nationalIdHash ? [{ nationalIdHash }] : []),
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          _count: { select: { cases: true, appointments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),

      prisma.client.count({ where }),
    ]);

    const decryptedData = data.map((client) => ({
      ...client,
      email: decryptText(client.email),
      phone: decryptText(client.phone),
      nationalId: decryptText(client.nationalId),
      address: decryptText(client.address),
      notes: decryptText(client.notes),
    }));

    return ok({
      data: decryptedData,
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

    const limitCheck = await assertTenantCanCreate(
      auth.user.tenantId,
      "clients",
    );

    if (!limitCheck.ok) {
      const isPlanLimit = limitCheck.billing?.canCreate === true;

      return err(limitCheck.message, isPlanLimit ? 400 : 402, {
        code: isPlanLimit ? "PLAN_LIMIT_REACHED" : "SUBSCRIPTION_INACTIVE",
        resource: "clients",
        billing: limitCheck.billing ?? null,
      });
    }

    const meta = getRequestMeta(req);
    const body = await req.json().catch(() => ({}));
    const parsed = clientSchema.safeParse(body);

    if (!parsed.success) {
      return err(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" | "),
        400,
      );
    }

    const normalizedEmail = normalizeEmail(parsed.data.email);
    const normalizedPhone = normalizePhone(parsed.data.phone);
    const normalizedNationalId = parsed.data.nationalId?.trim() || null;

    const secureData = {
      ...parsed.data,
      email: encryptText(parsed.data.email),
      phone: encryptText(parsed.data.phone),
      nationalId: encryptText(parsed.data.nationalId),
      address: encryptText(parsed.data.address),
      notes: encryptText(parsed.data.notes),
      emailHash: normalizedEmail ? hashSearchValue(normalizedEmail) : null,
      phoneHash: normalizedPhone ? hashSearchValue(normalizedPhone) : null,
      nationalIdHash: normalizedNationalId
        ? hashSearchValue(normalizedNationalId)
        : null,
    };

    const duplicateConditions = [
      ...(secureData.phoneHash ? [{ phoneHash: secureData.phoneHash }] : []),
      ...(secureData.nationalIdHash
        ? [{ nationalIdHash: secureData.nationalIdHash }]
        : []),
      ...(secureData.emailHash ? [{ emailHash: secureData.emailHash }] : []),
    ];

    const duplicateClient =
      duplicateConditions.length > 0
        ? await prisma.client.findFirst({
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
      return err(
        duplicateClient.archivedAt
          ? "يوجد موكل مؤرشف بنفس البيانات. يمكنك استعادته بدل إنشاء موكل جديد."
          : "يوجد موكل بنفس البيانات داخل المكتب.",
        409,
        {
          code: "CLIENT_DUPLICATE",
          clientId: duplicateClient.id,
          clientPublicId: duplicateClient.publicId,
          archived: !!duplicateClient.archivedAt,
        },
      );
    }

    const client = await prisma.client.create({
      data: {
        tenantId: auth.user.tenantId,
        ...secureData,
      },
    });

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: "CLIENT_CREATED",
      title: "تم إضافة موكل جديد",
      message: client.name,
      entityType: "CLIENT",
      entityId: client.id,
    });

    return ok(
      {
        ...client,
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