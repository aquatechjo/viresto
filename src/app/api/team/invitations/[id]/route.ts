import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "إلغاء دعوة فريق",
    );
    if (!writeCheck.ok) return err(writeCheck.message, writeCheck.status);

    const { id } = await params;
    const result = await prisma.$transaction(async (tx) => {
      await lockTenantMutation(tx, auth.user.tenantId);

      const invitation = await tx.teamInvitation.findFirst({
        where: {
          id,
          tenantId: auth.user.tenantId,
          acceptedAt: null,
          revokedAt: null,
        },
        select: { id: true, email: true },
      });

      if (!invitation) return null;

      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() },
      });

      await tx.activity.create({
        data: {
          tenantId: auth.user.tenantId,
          actorId: auth.user.userId,
          type: "TEAM_INVITATION_REVOKED",
          title: "تم إلغاء دعوة فريق",
          message: invitation.email,
          entityType: "TeamInvitation",
          entityId: invitation.id,
        },
      });

      return invitation;
    });

    if (!result) return err("الدعوة غير موجودة أو لم تعد فعالة", 404);

    return ok({ revoked: true, invitationId: result.id });
  });
}
