import crypto from "crypto";
import { prisma } from "@/lib/prisma";

type VerificationType = "EMAIL";
function getVerificationSecret() {
  const secret = process.env.VERIFICATION_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("Missing VERIFICATION_SECRET or JWT_SECRET");
  }

  return secret;
}

export function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOtpCode(code: string) {
  return crypto
    .createHmac("sha256", getVerificationSecret())
    .update(code)
    .digest("hex");
}

export function verifyOtpCodeHash(code: string, expectedHash: string) {
  const actualHash = hashOtpCode(code);
  const actualBuffer = Buffer.from(actualHash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function createVerificationCode({
  userId,
  type,
  expiresInMinutes = 10,
}: {
  userId: string;
  type: VerificationType;
  expiresInMinutes?: number;
}) {
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);

  await prisma.verificationCode.updateMany({
    where: {
      userId,
      type,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  await prisma.verificationCode.create({
    data: {
      userId,
      type,
      codeHash,
      expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
    },
  });

  return code;
}

export async function verifyCode({
  userId,
  type,
  code,
}: {
  userId: string;
  type: VerificationType;
  code: string;
}) {
  const codeHash = hashOtpCode(code);

  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      userId,
      type,
      usedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!verificationCode) {
    return {
      ok: false,
      reason: "NOT_FOUND" as const,
    };
  }

  if (verificationCode.expiresAt < new Date()) {
    return {
      ok: false,
      reason: "EXPIRED" as const,
    };
  }

  if (verificationCode.attempts >= 5) {
    return {
      ok: false,
      reason: "TOO_MANY_ATTEMPTS" as const,
    };
  }

  if (verificationCode.codeHash !== codeHash) {
    await prisma.verificationCode.update({
      where: {
        id: verificationCode.id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    return {
      ok: false,
      reason: "INVALID" as const,
    };
  }

  const consumed = await prisma.verificationCode.updateMany({
    where: {
      id: verificationCode.id,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  if (consumed.count !== 1) {
    return {
      ok: false,
      reason: "NOT_FOUND" as const,
    };
  }

  return {
    ok: true,
    reason: "APPROVED" as const,
  };
}
