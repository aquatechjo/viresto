import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/encryption";
import { createPasswordResetCode } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";
import {
  checkRateLimit,
  hashRateLimitIdentifier,
  RateLimitUnavailableError,
} from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import {
  describeError,
  describeSendResult,
  logEmailOutcome,
} from "@/lib/email-send-log";
import { codeRateLimitMessage, retryAfterSeconds } from "@/lib/retry-after";
import { runAfterResponse } from "@/lib/after-response";

export const runtime = "nodejs";

const GENERIC_MESSAGE =
  "إذا كان البريد الإلكتروني مسجلاً لدينا، سيتم إرسال كود إعادة تعيين كلمة المرور.";

const UNAVAILABLE_MESSAGE = "الخدمة غير متاحة مؤقتاً، حاول مرة أخرى بعد قليل.";

const FORGOT_PASSWORD_IP_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };
const FORGOT_PASSWORD_ACCOUNT_LIMIT = { max: 3, windowMs: 15 * 60 * 1000 };

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin) return true;
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Both limits run before the account lookup, so this answer is the same
// for an address with or without an account.
function rateLimited(resetAt: number, limiter: "ip" | "account") {
  const seconds = retryAfterSeconds(resetAt);

  logEmailOutcome("forgot-password", "rate_limited", {
    limiter,
    retry_after_s: seconds,
  });

  return NextResponse.json(
    {
      success: false,
      code: "RATE_LIMITED",
      message: codeRateLimitMessage(seconds),
      retryAfterSeconds: seconds,
    },
    { status: 429, headers: { "Retry-After": String(seconds) } }
  );
}

async function sendResetCode(email: string) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (!user?.isActive) {
      logEmailOutcome("forgot-password", "no_active_user");
      return;
    }

    const code = await createPasswordResetCode(user.id);

    const result = await sendPasswordResetEmail({
      to: user.email,
      code,
    });

    const sent = describeSendResult(result);
    logEmailOutcome("forgot-password", sent.outcome, sent.fields);
  } catch (error) {
    logEmailOutcome("forgot-password", "error", describeError(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json(
        { success: false, message: "طلب غير صالح" },
        { status: 403 }
      );
    }

    const ip = getClientIp(request) || "unknown";
    const ipLimit = await checkRateLimit(ip, {
      keyPrefix: "forgot-password-ip",
      ...FORGOT_PASSWORD_IP_LIMIT,
    });

    if (!ipLimit.allowed) {
      return rateLimited(ipLimit.resetAt, "ip");
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);

    if (!email) {
      return NextResponse.json(
        { success: false, message: "البريد الإلكتروني مطلوب" },
        { status: 400 }
      );
    }

    const accountLimit = await checkRateLimit(
      hashRateLimitIdentifier(email),
      {
        keyPrefix: "forgot-password-account",
        ...FORGOT_PASSWORD_ACCOUNT_LIMIT,
      }
    );

    if (!accountLimit.allowed) {
      return rateLimited(accountLimit.resetAt, "account");
    }

    // The lookup and the send run after the response, so an address with
    // an account takes no longer to answer than one without.
    await runAfterResponse(() => sendResetCode(email));

    return NextResponse.json({
      success: true,
      message: GENERIC_MESSAGE,
    });
  } catch (error) {
    logEmailOutcome("forgot-password", "error", describeError(error));

    // The limiter store is down (production fails closed). Nothing is sent,
    // and the user is told to retry rather than shown "sent". This happens
    // before any account lookup, so it says nothing about the address.
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json(
        {
          success: false,
          code: "SERVICE_UNAVAILABLE",
          message: UNAVAILABLE_MESSAGE,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: GENERIC_MESSAGE,
    });
  }
}
