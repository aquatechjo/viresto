import { NextRequest } from "next/server";
import { NotificationType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";
import { verifySameOrigin } from "@/lib/csrf";
import { logActivity } from "@/lib/log-activity";
import { createNotification } from "@/lib/notifications";
import { sendOfficeDeletionRequestEmail } from "@/lib/email";
import { COMPANY_CONTACT } from "@/config/contact";

// AUDIT_REPORT.md M4: the office ADMIN asks for the office to be deleted.
// Nothing is deleted here: the request is logged on the office and every
// system admin gets a notification and an email, then follows
// docs/data-requests.md. Reachable while the office is locked.

const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

const bodySchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }
    const reason = parsed.data.reason || null;
    const { tenantId, userId } = auth.user;

    // One notification per office per day, however often the button is pressed.
    const recent = await prisma.activity.findFirst({
      where: {
        tenantId,
        type: "OFFICE_DELETION_REQUESTED",
        createdAt: { gte: new Date(Date.now() - REPEAT_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recent) return ok({ requested: true, alreadyRequested: true });

    const [office, requester, systemAdmins] = await Promise.all([
      prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      prisma.user.findMany({
        where: { isSystemAdmin: true, isActive: true },
        select: { id: true, tenantId: true, email: true },
      }),
    ]);

    await logActivity({
      req,
      tenantId,
      actorId: userId,
      type: "OFFICE_DELETION_REQUESTED",
      title: "طلب حذف المكتب",
      message: reason ? `${requester.email}: ${reason}` : requester.email,
      entityType: "TENANT",
      entityId: tenantId,
    });

    const href = `/admin?q=${encodeURIComponent(office.slug)}`;
    const reasonAr = reason ? ` السبب: ${reason}` : "";
    const reasonEn = reason ? ` Reason: ${reason}` : "";

    await Promise.all(
      systemAdmins.map((admin) =>
        createNotification({
          tenantId: admin.tenantId,
          userId: admin.id,
          type: NotificationType.SYSTEM,
          titleAr: "طلب حذف مكتب",
          titleEn: "Office deletion request",
          messageAr: `طلب ${requester.name} (${requester.email}) حذف المكتب "${office.name}".${reasonAr}`,
          messageEn: `${requester.name} (${requester.email}) asked to delete the office "${office.name}".${reasonEn}`,
          href,
        }),
      ),
    );

    const recipients = systemAdmins.length
      ? systemAdmins.map((admin) => admin.email)
      : [COMPANY_CONTACT.supportEmail];

    try {
      await sendOfficeDeletionRequestEmail({
        to: recipients,
        officeName: office.name,
        officeSlug: office.slug,
        tenantId,
        requestedByName: requester.name,
        requestedByEmail: requester.email,
        reason,
      });
    } catch (error) {
      // The request is already logged and notified in-app; do not fail it.
      console.error(`[data-request] deletion_email_failed tenant=${tenantId}`, error);
    }

    return ok({ requested: true, alreadyRequested: false });
  });
}
