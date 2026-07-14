import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signToken, buildCookie } from "@/lib/auth";
import { requireAuth, getRequestMeta } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { err } from "@/lib/api-response";
import { verifySameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCodeHash,
} from "@/lib/verification";
import {
  sendEmailChangeCode,
  sendEmailChangeCompletedEmail,
} from "@/lib/email";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REQUEST_OLD_CODE"),
  }),
  z.object({
    action: z.literal("VERIFY_OLD_CODE"),
    requestId: z.string().cuid(),
    code: z.string().regex(/^\d{6}$/),
  }),
  z.object({
    action: z.literal("REQUEST_NEW_CODE"),
    requestId: z.string().cuid(),
    newEmail: z.string().trim().email().max(254),
  }),
  z.object({
    action: z.literal("CONFIRM_NEW_EMAIL"),
    requestId: z.string().cuid(),
    code: z.string().regex(/^\d{6}$/),
  }),
]);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  const hidden = "*".repeat(Math.max(3, localPart.length - visible.length));
  return `${visible}${hidden}@${domain}`;
}

function success(data: Record<string, unknown> = {}) {
  return NextResponse.json({ success: true, data });
}

function codeFailure(reason: "EXPIRED" | "ATTEMPTS" | "INVALID") {
  if (reason === "EXPIRED") {
    return err("انتهت صلاحية الطلب. ابدأ عملية تغيير البريد من جديد.", 410);
  }

  if (reason === "ATTEMPTS") {
    return err("تم تجاوز عدد محاولات التحقق. ابدأ العملية من جديد.", 429);
  }

  return err("رمز التحقق غير صحيح", 400);
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireAuth(req);
    if (auth.error || !auth.user) return auth.error;

    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return err("بيانات طلب تغيير البريد غير صالحة", 400);
    }

    const meta = getRequestMeta(req);
    const isSendAction =
      parsed.data.action === "REQUEST_OLD_CODE" ||
      parsed.data.action === "REQUEST_NEW_CODE";
    const rateLimit = await checkRateLimit(
      `${auth.user.userId}:${meta.ipAddress}:${parsed.data.action}`,
      {
        keyPrefix: "email-change",
        max: isSendAction ? 5 : 15,
        windowMs: 60 * 60 * 1000,
      },
    );

    if (!rateLimit.allowed) {
      return err("طلبات كثيرة. حاول مرة أخرى لاحقًا.", 429);
    }

    const user = await prisma.user.findFirst({
      where: {
        id: auth.user.userId,
        tenantId: auth.user.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        isSystemAdmin: true,
      },
    });

    if (!user) return err("غير مصرح", 401);

    if (parsed.data.action === "REQUEST_OLD_CODE") {
      const code = generateOtpCode();

      const changeRequest = await prisma.$transaction(async (tx) => {
        await tx.emailChangeRequest.updateMany({
          where: {
            userId: user.id,
            completedAt: null,
          },
          data: {
            completedAt: new Date(),
          },
        });

        return tx.emailChangeRequest.create({
          data: {
            userId: user.id,
            currentEmail: normalizeEmail(user.email),
            oldCodeHash: hashOtpCode(code),
            expiresAt: new Date(Date.now() + CODE_TTL_MS),
          },
          select: {
            id: true,
          },
        });
      });

      try {
        await sendEmailChangeCode({
          to: user.email,
          code,
          stage: "OLD",
        });
      } catch (error) {
        await prisma.emailChangeRequest.deleteMany({
          where: {
            id: changeRequest.id,
            userId: user.id,
            completedAt: null,
          },
        });
        console.error("Failed to send old email change code:", error);
        return err("تعذر إرسال رمز التحقق إلى البريد الحالي", 503);
      }

      return success({
        requestId: changeRequest.id,
        sentTo: maskEmail(user.email),
        next: "VERIFY_OLD_CODE",
      });
    }

    const changeRequest = await prisma.emailChangeRequest.findFirst({
      where: {
        id: parsed.data.requestId,
        userId: user.id,
        completedAt: null,
      },
    });

    if (!changeRequest) {
      return err("طلب تغيير البريد غير موجود أو تم استخدامه", 404);
    }

    if (changeRequest.currentEmail !== normalizeEmail(user.email)) {
      return err("تغيرت بيانات الحساب. ابدأ العملية من جديد.", 409);
    }

    if (changeRequest.expiresAt.getTime() <= Date.now()) {
      return codeFailure("EXPIRED");
    }

    if (parsed.data.action === "VERIFY_OLD_CODE") {
      if (changeRequest.oldCodeAttempts >= MAX_CODE_ATTEMPTS) {
        return codeFailure("ATTEMPTS");
      }

      if (!verifyOtpCodeHash(parsed.data.code, changeRequest.oldCodeHash)) {
        await prisma.emailChangeRequest.update({
          where: { id: changeRequest.id },
          data: { oldCodeAttempts: { increment: 1 } },
        });
        return codeFailure("INVALID");
      }

      await prisma.emailChangeRequest.update({
        where: { id: changeRequest.id },
        data: {
          oldVerifiedAt: changeRequest.oldVerifiedAt ?? new Date(),
        },
      });

      return success({ next: "ENTER_NEW_EMAIL" });
    }

    if (!changeRequest.oldVerifiedAt) {
      return err("يجب تأكيد البريد الحالي أولًا", 403);
    }

    if (parsed.data.action === "REQUEST_NEW_CODE") {
      const newEmail = normalizeEmail(parsed.data.newEmail);

      if (newEmail === normalizeEmail(user.email)) {
        return err("البريد الجديد مطابق للبريد الحالي", 400);
      }

      const emailOwner = await prisma.user.findFirst({
        where: {
          email: newEmail,
          id: { not: user.id },
        },
        select: { id: true },
      });

      if (emailOwner) {
        return err("البريد الإلكتروني مستخدم في حساب آخر", 409);
      }

      const code = generateOtpCode();

      await prisma.emailChangeRequest.update({
        where: { id: changeRequest.id },
        data: {
          newEmail,
          newCodeHash: hashOtpCode(code),
          newCodeAttempts: 0,
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
        },
      });

      try {
        await sendEmailChangeCode({
          to: newEmail,
          code,
          stage: "NEW",
        });
      } catch (error) {
        await prisma.emailChangeRequest.updateMany({
          where: {
            id: changeRequest.id,
            userId: user.id,
            completedAt: null,
          },
          data: {
            newEmail: null,
            newCodeHash: null,
            newCodeAttempts: 0,
          },
        });
        console.error("Failed to send new email change code:", error);
        return err("تعذر إرسال رمز التحقق إلى البريد الجديد", 503);
      }

      return success({
        sentTo: maskEmail(newEmail),
        next: "CONFIRM_NEW_EMAIL",
      });
    }

    if (!changeRequest.newEmail || !changeRequest.newCodeHash) {
      return err("أدخل البريد الجديد واطلب رمز التحقق أولًا", 400);
    }

    if (changeRequest.newCodeAttempts >= MAX_CODE_ATTEMPTS) {
      return codeFailure("ATTEMPTS");
    }

    if (!verifyOtpCodeHash(parsed.data.code, changeRequest.newCodeHash)) {
      await prisma.emailChangeRequest.update({
        where: { id: changeRequest.id },
        data: { newCodeAttempts: { increment: 1 } },
      });
      return codeFailure("INVALID");
    }

    const sessionId = auth.user.sessionId;
    if (!sessionId) return err("الجلسة الحالية غير صالحة", 401);

    const oldEmail = normalizeEmail(user.email);
    const newEmail = normalizeEmail(changeRequest.newEmail);
    let updatedUser;

    try {
      updatedUser = await prisma.$transaction(async (tx) => {
        const emailOwner = await tx.user.findFirst({
          where: {
            email: newEmail,
            id: { not: user.id },
          },
          select: { id: true },
        });

        if (emailOwner) throw new Error("EMAIL_ALREADY_USED");

        const consumed = await tx.emailChangeRequest.updateMany({
          where: {
            id: changeRequest.id,
            userId: user.id,
            completedAt: null,
          },
          data: {
            completedAt: new Date(),
          },
        });

        if (consumed.count !== 1) throw new Error("REQUEST_ALREADY_USED");

        const result = await tx.user.update({
          where: { id: user.id },
          data: {
            email: newEmail,
            emailVerifiedAt: new Date(),
          },
          select: {
            id: true,
            tenantId: true,
            name: true,
            email: true,
            role: true,
            isSystemAdmin: true,
          },
        });

        await tx.session.updateMany({
          where: {
            userId: user.id,
            isActive: true,
            id: { not: sessionId },
          },
          data: {
            isActive: false,
          },
        });

        return result;
      });
    } catch (error) {
      if (
        (error instanceof Error && error.message === "EMAIL_ALREADY_USED") ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002")
      ) {
        return err("البريد الإلكتروني مستخدم في حساب آخر", 409);
      }

      if (error instanceof Error && error.message === "REQUEST_ALREADY_USED") {
        return err("تم استخدام طلب تغيير البريد مسبقًا", 409);
      }

      throw error;
    }

    const token = await signToken({
      userId: updatedUser.id,
      tenantId: updatedUser.tenantId,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      sessionId,
      isSystemAdmin: updatedUser.isSystemAdmin,
    });

    await Promise.allSettled([
      logActivity({
        actorId: updatedUser.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        tenantId: updatedUser.tenantId,
        type: "ACCOUNT_EMAIL_CHANGED",
        title: "تم تغيير البريد الإلكتروني للحساب",
        message: `${maskEmail(oldEmail)} → ${maskEmail(newEmail)}`,
        entityType: "USER",
        entityId: updatedUser.id,
      }),
      sendEmailChangeCompletedEmail({
        to: oldEmail,
        accountEmail: newEmail,
        isOldEmail: true,
      }),
      sendEmailChangeCompletedEmail({
        to: newEmail,
        accountEmail: newEmail,
        isOldEmail: false,
      }),
    ]);

    const response = success({
      email: updatedUser.email,
      otherSessionsRevoked: true,
    });
    response.cookies.set(buildCookie(token));
    return response;
  });
}
