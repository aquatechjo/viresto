"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const GENERIC_MESSAGE =
  "إذا كان البريد الإلكتروني مسجلاً لدينا، سيتم إرسال كود إعادة تعيين كلمة المرور.";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("أدخل البريد الإلكتروني");
      return;
    }

    setLoading(true);

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

      if (!res.ok || data?.success === false) {
        toast.error(data?.message || "تعذر إرسال كود إعادة التعيين");
        return;
      }

      toast.success(data?.message || GENERIC_MESSAGE);

      router.push(`/reset-password?email=${encodeURIComponent(normalizedEmail)}`);
    } catch {
      toast.error("حدث خطأ أثناء إرسال كود إعادة التعيين");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#06170f] px-4 py-10 text-white"
    >
      <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-[28px] border border-emerald-300/15 bg-white/[0.07] p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-2xl">
              🔐
            </div>

            <h1 className="text-2xl font-black">نسيت كلمة المرور؟</h1>

            <p className="mt-3 text-sm leading-7 text-emerald-50/70">
              أدخل البريد الإلكتروني المسجل في حسابك وسنرسل لك كود لإعادة
              تعيين كلمة المرور.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-emerald-50/80">
                البريد الإلكتروني
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right text-white outline-none transition placeholder:text-white/35 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-400/10"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-black text-[#06170f] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "جاري الإرسال..." : "إرسال كود التحقق"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-bold text-emerald-200 transition hover:text-emerald-100"
            >
              الرجوع إلى تسجيل الدخول
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}