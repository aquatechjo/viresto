"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyWhatsappContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitVerification(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/auth/verify-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        setError(data?.message || data?.error || "تعذر تأكيد رقم الواتساب");
        return;
      }

      const next = data?.data?.next;
      setMessage(data?.data?.message || "تم تأكيد رقم الواتساب بنجاح");

      setTimeout(() => {
        if (next === "LOGIN") {
          router.push("/login");
          return;
        }

        router.push("/dashboard");
      }, 900);
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#071811] px-4 py-10 text-white"
    >
      <div className="w-full max-w-md rounded-[28px] border border-emerald-400/30 bg-emerald-950/35 p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-black">تأكيد رقم الواتساب</h1>
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
            <label htmlFor="email" className="mb-2 block text-sm font-bold text-white">
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
            <label htmlFor="code" className="mb-2 block text-sm font-bold text-white">
              رمز الواتساب
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
            {loading ? "جاري التحقق..." : "تأكيد رقم الواتساب"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm font-semibold text-emerald-100/60">
          رجوع إلى{" "}
          <Link href="/login" className="text-emerald-200 hover:text-white">
            تسجيل الدخول
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function VerifyWhatsappPage() {
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
      <VerifyWhatsappContent />
    </Suspense>
  );
}
