"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCooldown } from "@/hooks/useCooldown";
import PasswordInput from "@/components/ui/PasswordInput";
import { codeRateLimitMessage, readRetryAfterSeconds } from "@/lib/retry-after";

// Seconds the resend button stays disabled after a code is sent.
const RESEND_COOLDOWN_SECONDS = 60;

// 0:45, 14:59. Left to right inside the Arabic label.
function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `⁦${minutes}:${rest}⁩`;
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmail = useMemo(() => {
    return searchParams.get("email")?.trim().toLowerCase() || "";
  }, [searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const cooldown = useCooldown();
  const startCooldown = cooldown.start;

  // Arriving from /forgot-password with ?email= means a code was just sent.
  useEffect(() => {
    if (initialEmail) startCooldown(RESEND_COOLDOWN_SECONDS);
  }, [initialEmail, startCooldown]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.replace(/\D/g, "");

    if (!normalizedEmail) {
      toast.error("أدخل البريد الإلكتروني");
      return;
    }

    if (cleanCode.length !== 6) {
      toast.error("رمز التحقق يجب أن يتكون من 6 أرقام");
      return;
    }

    if (password.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("تأكيد كلمة المرور غير مطابق");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          code: cleanCode,
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.success === false) {
        toast.error(data?.message || "تعذر تغيير كلمة المرور");
        return;
      }

      toast.success(data?.message || "تم تغيير كلمة المرور بنجاح");
      router.push("/login");
    } catch {
      toast.error("حدث خطأ أثناء تغيير كلمة المرور");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("أدخل البريد الإلكتروني أولاً");
      return;
    }

    setResending(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      const data = await res.json().catch(() => null);
      const retryAfter = readRetryAfterSeconds(res.status, data);

      if (retryAfter !== null) {
        toast.error(codeRateLimitMessage(retryAfter));
        cooldown.start(retryAfter);
        return;
      }

      if (!res.ok || data?.success === false) {
        toast.error(data?.message || "تعذر إعادة إرسال الكود");
        return;
      }

      toast.success(data?.message || "تم إرسال كود جديد");
      cooldown.start(RESEND_COOLDOWN_SECONDS);
    } catch {
      toast.error("حدث خطأ أثناء إعادة إرسال الكود");
    } finally {
      setResending(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#041819] px-4 py-10 text-white"
    >
      <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-[28px] border border-copper-300/15 bg-white/[0.07] p-6 shadow-2xl shadow-copper-950/30 backdrop-blur-xl sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-copper-300/20 bg-copper-400/10 text-2xl">
              ✅
            </div>

            <h1 className="text-2xl font-black">تغيير كلمة المرور</h1>

            <p className="mt-3 text-sm leading-7 text-copper-50/70">
              أدخل كود التحقق المرسل إلى بريدك الإلكتروني، ثم اختر كلمة مرور
              جديدة.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-copper-50/80">
                البريد الإلكتروني
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right text-white outline-none transition placeholder:text-white/35 focus:border-copper-300/60 focus:ring-4 focus:ring-copper-400/10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-copper-50/80">
                كود التحقق
              </label>

              <input
                inputMode="numeric"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-xl font-black tracking-[0.45em] text-white outline-none transition placeholder:text-white/35 focus:border-copper-300/60 focus:ring-4 focus:ring-copper-400/10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-copper-50/80">
                كلمة المرور الجديدة
              </label>

              <PasswordInput
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8 أحرف على الأقل"
                autoComplete="new-password"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right text-white outline-none transition placeholder:text-white/35 focus:border-copper-300/60 focus:ring-4 focus:ring-copper-400/10"
                tone="copper"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-copper-50/80">
                تأكيد كلمة المرور
              </label>

              <PasswordInput
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="أعد كتابة كلمة المرور"
                autoComplete="new-password"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right text-white outline-none transition placeholder:text-white/35 focus:border-copper-300/60 focus:ring-4 focus:ring-copper-400/10"
                tone="copper"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-copper-400 px-4 py-3 font-black text-[#041819] transition hover:bg-copper-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <button
              type="button"
              onClick={resendCode}
              disabled={resending || cooldown.remaining > 0}
              aria-live="polite"
              className="text-sm font-bold text-copper-200 transition hover:text-copper-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resending
                ? "جاري إعادة الإرسال..."
                : cooldown.remaining > 0
                  ? `إعادة إرسال الكود بعد ${formatCountdown(cooldown.remaining)}`
                  : "إعادة إرسال الكود"}
            </button>

            <Link
              href="/login"
              className="text-sm font-bold text-white/60 transition hover:text-white"
            >
              الرجوع إلى تسجيل الدخول
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}