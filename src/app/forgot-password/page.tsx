"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Locale = "ar" | "en";

const LOCALE_KEYS = ["locale", "viresto-locale", "preferred-locale"];

const COPY = {
  ar: {
    toggle: "English",
    title: "نسيت كلمة المرور؟",
    description:
      "أدخل البريد الإلكتروني المسجل في حسابك وسنرسل لك كود لإعادة تعيين كلمة المرور.",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "example@email.com",
    submit: "إرسال كود التحقق",
    submitting: "جاري الإرسال...",
    backToLogin: "الرجوع إلى تسجيل الدخول",
    missingEmail: "أدخل البريد الإلكتروني",
    success:
      "إذا كان البريد الإلكتروني مسجلاً لدينا، سيتم إرسال كود إعادة تعيين كلمة المرور.",
    error: "تعذر إرسال كود إعادة التعيين",
    networkError: "حدث خطأ أثناء إرسال كود إعادة التعيين",
  },
  en: {
    toggle: "العربية",
    title: "Forgot password?",
    description:
      "Enter the email address registered to your account and we will send you a code to reset your password.",
    emailLabel: "Email address",
    emailPlaceholder: "example@email.com",
    submit: "Send verification code",
    submitting: "Sending...",
    backToLogin: "Back to login",
    missingEmail: "Enter your email address",
    success:
      "If this email is registered with us, a password reset code will be sent.",
    error: "Unable to send the reset code",
    networkError: "An error occurred while sending the reset code",
  },
} satisfies Record<Locale, Record<string, string>>;

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "ar";

  for (const key of LOCALE_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value === "ar" || value === "en") return value;
  }

  return "ar";
}

function saveLocale(locale: Locale) {
  for (const key of LOCALE_KEYS) {
    window.localStorage.setItem(key, locale);
  }

  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [locale, setLocale] = useState<Locale>("ar");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const isRtl = locale === "ar";
  const copy = useMemo(() => COPY[locale], [locale]);

  useEffect(() => {
    const storedLocale = getInitialLocale();
    setLocale(storedLocale);
    saveLocale(storedLocale);
  }, []);

  function toggleLocale() {
    const nextLocale: Locale = locale === "ar" ? "en" : "ar";
    setLocale(nextLocale);
    saveLocale(nextLocale);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error(copy.missingEmail);
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
        toast.error(copy.error);
        return;
      }

      toast.success(copy.success);

      router.push(
        `/reset-password?email=${encodeURIComponent(normalizedEmail)}`,
      );
    } catch {
      toast.error(copy.networkError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className="relative min-h-screen overflow-hidden bg-[#06170f] px-4 py-10 text-white"
    >
      <button
        type="button"
        onClick={toggleLocale}
        className={[
          "absolute top-5 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-emerald-50 shadow-lg shadow-black/10 backdrop-blur-md transition hover:bg-white/15",
          isRtl ? "left-5" : "right-5",
        ].join(" ")}
      >
        {copy.toggle}
      </button>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_30%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-md items-center justify-center">
        <section
          className={[
            "w-full rounded-[28px] border border-emerald-300/15 bg-white/[0.07] p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl sm:p-8",
            isRtl ? "text-right" : "text-left",
          ].join(" ")}
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-2xl">
              🔐
            </div>

            <h1 className="text-2xl font-black">{copy.title}</h1>

            <p className="mt-3 text-sm leading-7 text-emerald-50/70">
              {copy.description}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-bold text-emerald-50/80"
              >
                {copy.emailLabel}
              </label>

              <input
                id="email"
                dir="ltr"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={copy.emailPlaceholder}
                autoComplete="email"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-white outline-none transition placeholder:text-white/35 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-400/10"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-black text-[#06170f] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? copy.submitting : copy.submit}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href={`/login?lang=${locale}`}
              className="text-sm font-bold text-emerald-200 transition hover:text-emerald-100"
            >
              {copy.backToLogin}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
