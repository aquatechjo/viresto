import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const PASSWORD_RESET_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function getPasswordResetSecret() {
  const secret = process.env.PASSWORD_RESET_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("Missing or weak PASSWORD_RESET_SECRET");
  }

  return secret;
}

export function generatePasswordResetCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashPasswordResetCode({
  userId,
  code,
}: {
  userId: string;
  code: string;
}) {
  return crypto
    .createHmac("sha256", getPasswordResetSecret())
    .update(`${userId}:${code.trim()}`)
    .digest("hex");
}

export async function createPasswordResetCode(userId: string) {
  const code = generatePasswordResetCode();

  await prisma.passwordResetCode.updateMany({
    where: {
      userId,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  await prisma.passwordResetCode.create({
    data: {
      userId,
      codeHash: hashPasswordResetCode({ userId, code }),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });

  return code;
}

export async function verifyPasswordResetCode({
  userId,
  code,
}: {
  userId: string;
  code: string;
}): Promise<
  | { ok: true; codeId: string }
  | { ok: false; message: string }
> {
  const resetCode = await prisma.passwordResetCode.findFirst({
    where: {
      userId,
      usedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!resetCode) {
    return { ok: false, message: "رمز التحقق غير صحيح أو منتهي" };
  }

  if (resetCode.expiresAt < new Date()) {
    await prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: { usedAt: new Date() },
    });

    return { ok: false, message: "انتهت صلاحية رمز التحقق" };
  }

  if (resetCode.attempts >= MAX_ATTEMPTS) {
    await prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: { usedAt: new Date() },
    });

    return { ok: false, message: "تم تجاوز عدد المحاولات المسموح" };
  }

  const expectedHash = hashPasswordResetCode({ userId, code });

  if (resetCode.codeHash !== expectedHash) {
    await prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    return { ok: false, message: "رمز التحقق غير صحيح" };
  }

  return { ok: true, codeId: resetCode.id };
}