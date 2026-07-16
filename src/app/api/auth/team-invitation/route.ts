import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { assertTenantCanCreate } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";
import {
  checkRateLimit,
  hashRateLimitIdentifier,
} from "@/lib/rate-limit";
import { getClientIp } from "@/lib/turnstile";
import { hashTeamInvitationToken } from "@/lib/team-invitations";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";
import { strongPasswordSchema } from "@/lib/validations";

function normalizeToken(value: unknown) {
  const token = String(value ?? "").trim();
  return /^[A-Za-z0-9_-]{40,80}$/.test(token) ? token : null;
}

async function applyInvitationRateLimit(req: NextRequest, token: string) {
  const ip = getClientIp(req) ?? "unknown";
  return checkRateLimit(
    `${ip}:${hashRateLimitIdentifier(token)}`,
    {
      keyPrefix: "team-invitation",
      max: 15,
      windowMs: 15 * 60 * 1000,
    },
  );
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const token = normalizeToken(new URL(req.url).searchParams.get("token"));
    if (!token) return err("الدعوة غير صالحة أو منتهية", 404);

    const limit = await applyInvitationRateLimit(req, token);
    if (!limit.allowed) {
      return err("تم تجاوز عدد المحاولات. حاول لاحقًا.", 429);
    }

    const invitation = await prisma.teamInvitation.findUnique({
      where: { tokenHash: hashTeamInvitationToken(token) },
      select: {
        name: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        tenant: { select: { name: true } },
      },
    });

    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    ) {
      return err("الدعوة غير صالحة أو منتهية", 404);
    }

    return ok({
      name: invitation.name,
      email: invitation.email,
      role: invitation.role,
      tenantName: invitation.tenant.name,
      expiresAt: invitation.expiresAt,
    });
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const body = await req.json().catch(() => ({}));
    const token = normalizeToken(body.token);
    const passwordResult = strongPasswordSchema.safeParse(body.password);

    if (!token) return err("الدعوة غير صالحة أو منتهية", 404);
    if (!passwordResult.success) {
      return err(passwordResult.error.issues[0]?.message || "كلمة المرور غير صالحة", 400);
    }

    const rateLimit = await applyInvitationRateLimit(req, token);
    if (!rateLimit.allowed) {
      return err("تم تجاوز عدد المحاولات. حاول لاحقًا.", 429);
    }

    const tokenHash = hashTeamInvitationToken(token);
    const preview = await prisma.teamInvitation.findUnique({
      where: { tokenHash },
      select: {
        tenantId: true,
        acceptedAt: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    if (
      !preview ||
      preview.acceptedAt ||
      preview.revokedAt ||
      preview.expiresAt <= new Date()
    ) {
      return err("الدعوة غير صالحة أو منتهية", 404);
    }

    const limitCheck = await assertTenantCanCreate(preview.tenantId, "users");
    if (!limitCheck.ok) {
      return err(limitCheck.message, limitCheck.status, {
        code: limitCheck.billing?.canCreate
          ? "PLAN_LIMIT_REACHED"
          : "SUBSCRIPTION_INACTIVE",
      });
    }

    const passwordHash = await bcrypt.hash(passwordResult.data, 12);

    const result = await prisma.$transaction(async (tx) => {
      await lockTenantMutation(tx, preview.tenantId);

      const invitation = await tx.teamInvitation.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          tenantId: true,
          name: true,
          email: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
          tenant: { select: { maxUsers: true } },
        },
      });

      if (
        !invitation ||
        invitation.tenantId !== preview.tenantId ||
        invitation.acceptedAt ||
        invitation.revokedAt ||
        invitation.expiresAt <= new Date()
      ) {
        return { error: "INVALID_INVITATION" as const };
      }

      const [existingUser, activeUsers] = await Promise.all([
        tx.user.findUnique({
          where: { email: invitation.email },
          select: { id: true },
        }),
        tx.user.count({
          where: { tenantId: invitation.tenantId, isActive: true },
        }),
      ]);

      if (existingUser) return { error: "EMAIL_IN_USE" as const };

      const seatLimit = limitCheck.limit;
      if (seatLimit !== null && seatLimit > 0 && activeUsers >= seatLimit) {
        return { error: "SEAT_LIMIT" as const, limit: seatLimit };
      }

      const user = await tx.user.create({
        data: {
          tenantId: invitation.tenantId,
          name: invitation.name,
          email: invitation.email,
          role: invitation.role,
          passwordHash,
          emailVerifiedAt: new Date(),
          isActive: true,
          isSystemAdmin: false,
        },
        select: { id: true, email: true },
      });

      const consumed = await tx.teamInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new Error("TEAM_INVITATION_ALREADY_CONSUMED");
      }

      await tx.activity.create({
        data: {
          tenantId: invitation.tenantId,
          actorId: user.id,
          type: "TEAM_INVITATION_ACCEPTED",
          title: "انضم عضو جديد إلى الفريق",
          message: user.email,
          entityType: "User",
          entityId: user.id,
        },
      });

      return { user };
    });

    if ("error" in result) {
      if (result.error === "EMAIL_IN_USE") {
        return err("البريد الإلكتروني مستخدم مسبقًا", 409);
      }
      if (result.error === "SEAT_LIMIT") {
        return err(`وصل المكتب إلى حد المستخدمين (${result.limit}).`, 409);
      }
      return err("الدعوة غير صالحة أو منتهية", 404);
    }

    return ok({
      message: "تم تفعيل حسابك. يمكنك تسجيل الدخول الآن.",
      email: result.user.email,
    });
  });
}
