import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { apiHandler } from "@/lib/api-handler";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import {
  assertTenantCanCreate,
  assertTenantCanUseStorage,
} from "@/lib/billing-limits";

const allowedTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const meta = getRequestMeta(req);

    const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
    const KEY = process.env.CLOUDINARY_API_KEY;
    const SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!CLOUD || !KEY || !SECRET) {
      return err("رفع الملفات غير مُهيأ", 503);
    }

    const form = await req.formData();

    const file = form.get("file") as File | null;
    let clientId = form.get("clientId") as string | null;
    const caseId = form.get("caseId") as string | null;
    const notesRaw = form.get("notes");
    const tagsRaw = form.get("tags");

    const notes = typeof notesRaw === "string" ? notesRaw : null;
    const tagsValue = typeof tagsRaw === "string" ? tagsRaw : null;

    if (!file) return err("لم يتم إرسال ملف", 400);

    if (!allowedTypes.includes(file.type as any)) {
      return err(
        "نوع الملف غير مسموح. الرجاء رفع PDF أو صورة أو ملف Word فقط.",
        400,
      );
    }

    if (file.name.length > 180) {
      return err("اسم الملف طويل جدًا", 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return err("حجم الملف يتجاوز 10 ميجابايت", 400);
    }

    let tags: string[] = [];

    if (tagsValue) {
      try {
        const parsed = JSON.parse(tagsValue);
        tags = Array.isArray(parsed)
          ? parsed
              .map(String)
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 10)
              .map((t) => t.slice(0, 50))
          : [];
      } catch {
        return err("صيغة التصنيفات غير صحيحة", 400);
      }
    }

    if (clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          tenantId: auth.user.tenantId,
        },
        select: {
          id: true,
          archivedAt: true,
        },
      });

      if (!client) {
        return err("الموكل غير موجود أو لا يتبع لهذا المكتب", 404);
      }

      if (client.archivedAt) {
        return err("لا يمكن رفع مستند لموكل مؤرشف", 400);
      }
    }

    if (caseId) {
      const caseRecord = await prisma.case.findFirst({
        where: {
          id: caseId,
          tenantId: auth.user.tenantId,
          ...(clientId ? { clientId } : {}),
        },
        select: {
          id: true,
          clientId: true,
          client: {
            select: {
              id: true,
              archivedAt: true,
            },
          },
        },
      });

      if (!caseRecord) {
        return err("القضية غير موجودة أو لا تتبع لهذا المكتب", 404);
      }

      if (caseRecord.client?.archivedAt) {
        return err("لا يمكن رفع مستند لقضية موكلها مؤرشف", 400);
      }

      if (!clientId) clientId = caseRecord.clientId;
    }

    const documentsLimitCheck = await assertTenantCanCreate(
      auth.user.tenantId,
      "documents",
    );

    if (!documentsLimitCheck.ok) {
      return err(
        documentsLimitCheck.message,
        documentsLimitCheck.billing.canCreate ? 400 : 402,
        {
          code: documentsLimitCheck.billing.canCreate
            ? "PLAN_LIMIT_REACHED"
            : "SUBSCRIPTION_INACTIVE",
          resource: "documents",
          used: documentsLimitCheck.used,
          limit: documentsLimitCheck.limit,
          plan: documentsLimitCheck.billing.plan,
          subscriptionStatus: documentsLimitCheck.billing.subscriptionStatus,
        },
      );
    }

    const storageLimitCheck = await assertTenantCanUseStorage(
      auth.user.tenantId,
      file.size,
    );

    if (!storageLimitCheck.ok) {
      return err(
        storageLimitCheck.message,
        storageLimitCheck.billing.canCreate ? 400 : 402,
        {
          code: storageLimitCheck.billing.canCreate
            ? "STORAGE_LIMIT_REACHED"
            : "SUBSCRIPTION_INACTIVE",
          resource: "storage",
          usedBytes: storageLimitCheck.usedBytes,
          incomingBytes: storageLimitCheck.incomingBytes,
          limitBytes: storageLimitCheck.limitBytes,
          plan: storageLimitCheck.billing.plan,
          subscriptionStatus: storageLimitCheck.billing.subscriptionStatus,
        },
      );
    }

    const ts = Math.floor(Date.now() / 1000);
    const folder = `Viresto/${auth.user.tenantId}`;
    const uploadType = "authenticated";

    const str = `folder=${folder}&timestamp=${ts}&type=${uploadType}${SECRET}`;

    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(str),
    );

    const sig = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("api_key", KEY);
    fd.append("timestamp", String(ts));
    fd.append("signature", sig);
    fd.append("folder", folder);
    fd.append("type", uploadType);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`,
      {
        method: "POST",
        body: fd,
      },
    );

    const d = await res.json();

    if (!res.ok) {
      return err(d.error?.message ?? "فشل رفع الملف", 500);
    }

    const doc = await prisma.document.create({
      data: {
        tenantId: auth.user.tenantId,
        clientId: clientId || null,
        caseId: caseId || null,
        fileName: file.name,
        fileType: file.type,
        fileUrl: d.secure_url,
        fileSize: file.size,
        publicId: d.public_id,
        notes: notes?.trim().slice(0, 1000) || null,
        tags,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
          },
        },
        case: {
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
        },
      },
    });

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: "DOCUMENT_UPLOADED",
      title: "تم رفع مستند",
      message: file.name,
      entityType: caseId ? "CASE" : "DOCUMENT",
      entityId: caseId || doc.id,
    });

    return ok({
      document: {
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        notes: doc.notes,
        tags: doc.tags,
        createdAt: doc.createdAt,
        clientId: doc.clientId,
        caseId: doc.caseId,
        client: doc.client,
        case: doc.case,
      },
    });
  });
}
