"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitVerification(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanEmail || cleanCode.length !== 6) {
      setError("يرجى إدخال البريد الإلكتروني ورمز تحقق صحيح");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(
          data?.message || data?.error || "تعذر تأكيد البريد الإلكتروني",
        );
        return;
      }

      const next = data?.data?.next;
      setMessage(data?.data?.message || "تم تأكيد البريد الإلكتروني بنجاح");

      setTimeout(() => {
        if (next === "DASHBOARD") {
          sessionStorage.setItem("viresto_tab_session", "active");
          sessionStorage.setItem("viresto_last_activity", String(Date.now()));

          window.location.href = "/dashboard";
          return;
        }

        sessionStorage.removeItem("viresto_tab_session");
        sessionStorage.removeItem("viresto_last_activity");

        window.location.href = "/login";
      }, 900);
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    const cleanEmail = email.trim().toLowerCase();

    setMessage("");
    setError("");

    if (!cleanEmail) {
      setError("أدخل البريد الإلكتروني أولاً");
      return;
    }

    setResending(true);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(data?.message || data?.error || "تعذر إعادة إرسال الكود");
        return;
      }

      const next = data?.data?.next;
      setMessage(data?.data?.message || "تم إرسال كود تحقق جديد");

      if (next === "LOGIN") {
        setTimeout(() => {
          router.push("/login");
        }, 900);
      }
    } catch {
      setError("حدث خطأ أثناء إعادة إرسال الكود");
    } finally {
      setResending(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#071811] px-4 py-10 text-white"
    >
      <div className="w-full max-w-md rounded-[28px] border border-emerald-400/30 bg-emerald-950/35 p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-black">تأكيد البريد الإلكتروني</h1>
          <p className="mt-2 text-sm font-medium text-emerald-100/65">
            أدخل رمز التحقق المكوّن من 6 أرقام
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={submitVerification} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-bold text-white"
            >
              البريد الإلكتروني
            </label>

            <input
              id="email"
              dir="ltr"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ahmed@law.jo"
              className="w-full rounded-2xl border border-emerald-300/30 bg-transparent px-4 py-4 text-left text-emerald-100 outline-none transition placeholder:text-emerald-300/45 focus:border-emerald-300"
              required
            />
          </div>

          <div>
            <label
              htmlFor="code"
              className="mb-2 block text-sm font-bold text-white"
            >
              رمز التحقق
            </label>

            <input
              id="code"
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
              className="w-full rounded-2xl border border-emerald-300/30 bg-transparent px-4 py-4 text-center text-2xl font-black tracking-[0.35em] text-emerald-100 outline-none transition placeholder:text-emerald-300/35 focus:border-emerald-300"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-2xl bg-emerald-300/25 px-5 py-4 text-sm font-black text-white transition hover:bg-emerald-300/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "جاري التحقق..." : "تأكيد البريد الإلكتروني"}
          </button>
        </form>

        <button
          type="button"
          onClick={resendCode}
          disabled={resending}
          className="mt-4 w-full rounded-2xl border border-emerald-300/25 px-5 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resending ? "جاري إعادة الإرسال..." : "إعادة إرسال الكود"}
        </button>

        <div className="mt-6 text-center text-sm font-semibold text-emerald-100/60">
          لديك حساب؟{" "}
          <Link href="/login" className="text-emerald-200 hover:text-white">
            سجل دخولك
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main
          dir="rtl"
          className="flex min-h-screen items-center justify-center bg-[#071811] px-4 py-10 text-white"
        >
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-950/35 px-6 py-5 text-sm font-bold text-emerald-100">
            جاري تحميل صفحة التحقق...
          </div>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
