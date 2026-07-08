"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Image from "next/image";
import FormField from "@/components/ui/FormField";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

type Locale = "ar" | "en";

type SmallCard = {
  icon: string;
  title: string;
  desc: string;
  delay: number;
};

type Feature = {
  icon: string;
  title: string;
  desc: string;
};

const STORAGE_KEYS = ["locale", "viresto-locale", "preferred-locale"];

const COPY: Record<
  Locale,
  {
    languageButton: string;
    logoAlt: string;
    brandSubtitle: string;
    heroTitleTop: string;
    heroTitleBottom: string;
    heroDescription: string;
    welcomeBadge: string;
    formTitle: string;
    formDescription: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    forgotPassword: string;
    submit: string;
    loadingLabel: string;
    noAccount: string;
    register: string;
    footer: string;
    errors: {
      emailRequired: string;
      passwordRequired: string;
    };
    toast: {
      loginSuccess: string;
      verifyEmail: string;
      genericError: string;
      connectionError: string;
    };
    floatingCards: SmallCard[];
    features: Feature[];
  }
> = {
  ar: {
    languageButton: "English",
    logoAlt: "شعار Viresto",
    brandSubtitle: "نظام إدارة مكاتب المحاماة",
    heroTitleTop: "أدر مكتبك القانوني",
    heroTitleBottom: "بثقة ووضوح",
    heroDescription:
      "منصة واحدة لتنظيم القضايا، الموكلين، المواعيد، المستندات، الفواتير، والتقارير المالية بطريقة احترافية وسريعة.",
    welcomeBadge: "مرحبًا بعودتك",
    formTitle: "تسجيل الدخول",
    formDescription: "أدخل بياناتك للوصول إلى لوحة التحكم وإدارة مكتبك.",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "lawyer@example.com",
    passwordLabel: "كلمة المرور",
    passwordPlaceholder: "••••••••",
    showPassword: "إظهار",
    hidePassword: "إخفاء",
    forgotPassword: "نسيت كلمة المرور؟",
    submit: "دخول",
    loadingLabel: "جارٍ الدخول",
    noAccount: "ليس لديك حساب؟",
    register: "سجّل مكتبك",
    footer: "جميع الحقوق محفوظة.",
    errors: {
      emailRequired: "البريد الإلكتروني مطلوب",
      passwordRequired: "كلمة المرور مطلوبة",
    },
    toast: {
      loginSuccess: "مرحبًا بك في Viresto!",
      verifyEmail: "يرجى تأكيد البريد الإلكتروني أولاً",
      genericError: "حدث خطأ",
      connectionError: "حدث خطأ في الاتصال",
    },
    floatingCards: [
      {
        icon: "⚖️",
        title: "قضية جديدة",
        desc: "تم تحديث حالة القضية",
        delay: 0,
      },
      {
        icon: "🧾",
        title: "فاتورة مدفوعة",
        desc: "تم تسجيل دفعة جديدة",
        delay: 0.7,
      },
      {
        icon: "📅",
        title: "موعد قريب",
        desc: "جلسة غدًا الساعة 10:00",
        delay: 1.2,
      },
    ],
    features: [
      {
        icon: "⚖️",
        title: "إدارة القضايا",
        desc: "تابع القضايا، الحالات، والملاحظات من لوحة واحدة.",
      },
      {
        icon: "👥",
        title: "ملفات الموكلين",
        desc: "سجلات منظمة لكل موكل مع القضايا والمستندات.",
      },
      {
        icon: "🧾",
        title: "الفواتير والتقارير",
        desc: "تحصيل، فواتير، تقارير مالية، ومؤشرات واضحة.",
      },
    ],
  },
  en: {
    languageButton: "العربية",
    logoAlt: "Viresto Logo",
    brandSubtitle: "Legal practice management system",
    heroTitleTop: "Run your legal office",
    heroTitleBottom: "with confidence and clarity",
    heroDescription:
      "One platform to organize cases, clients, appointments, documents, invoices, and financial reports professionally and quickly.",
    welcomeBadge: "Welcome back",
    formTitle: "Login",
    formDescription:
      "Enter your details to access your dashboard and manage your office.",
    emailLabel: "Email address",
    emailPlaceholder: "lawyer@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "••••••••",
    showPassword: "Show",
    hidePassword: "Hide",
    forgotPassword: "Forgot password?",
    submit: "Login",
    loadingLabel: "Logging in",
    noAccount: "Don’t have an account?",
    register: "Register your office",
    footer: "All rights reserved.",
    errors: {
      emailRequired: "Email address is required",
      passwordRequired: "Password is required",
    },
    toast: {
      loginSuccess: "Welcome to Viresto!",
      verifyEmail: "Please verify your email first",
      genericError: "Something went wrong",
      connectionError: "Connection error",
    },
    floatingCards: [
      {
        icon: "⚖️",
        title: "New case",
        desc: "Case status updated",
        delay: 0,
      },
      {
        icon: "🧾",
        title: "Paid invoice",
        desc: "A new payment was recorded",
        delay: 0.7,
      },
      {
        icon: "📅",
        title: "Upcoming appointment",
        desc: "Tomorrow’s hearing at 10:00",
        delay: 1.2,
      },
    ],
    features: [
      {
        icon: "⚖️",
        title: "Case management",
        desc: "Track cases, statuses, and notes from one dashboard.",
      },
      {
        icon: "👥",
        title: "Client files",
        desc: "Organized records for each client with cases and documents.",
      },
      {
        icon: "🧾",
        title: "Invoices and reports",
        desc: "Payments, invoices, financial reports, and clear indicators.",
      },
    ],
  },
};

const ambientIcons = [
  { icon: "⚖️", left: "7%", top: "14%", delay: 0 },
  { icon: "📜", left: "18%", top: "44%", delay: 0.4 },
  { icon: "🧾", left: "10%", top: "76%", delay: 0.8 },
  { icon: "📅", left: "48%", top: "82%", delay: 1.2 },
  { icon: "🔐", left: "72%", top: "24%", delay: 1.6 },
  { icon: "💼", left: "88%", top: "72%", delay: 2 },
  { icon: "📁", left: "38%", top: "22%", delay: 2.4 },
  { icon: "✍️", left: "62%", top: "58%", delay: 2.8 },

  { icon: "🏛️", left: "30%", top: "12%", delay: 3.2 },
  { icon: "📌", left: "4%", top: "38%", delay: 3.6 },
  { icon: "🕒", left: "24%", top: "68%", delay: 4 },
  { icon: "📊", left: "36%", top: "64%", delay: 4.4 },
  { icon: "🖋️", left: "54%", top: "16%", delay: 4.8 },
  { icon: "📎", left: "58%", top: "74%", delay: 5.2 },
  { icon: "✅", left: "80%", top: "46%", delay: 5.6 },
  { icon: "🗂️", left: "92%", top: "34%", delay: 6 },
  { icon: "🔎", left: "68%", top: "84%", delay: 6.4 },
  { icon: "📑", left: "44%", top: "42%", delay: 6.8 },
];

function getUrlLocale(): Locale | null {
  if (typeof window === "undefined") return null;

  const lang = new URLSearchParams(window.location.search).get("lang");
  return lang === "ar" || lang === "en" ? lang : null;
}

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "ar";

  const urlLocale = getUrlLocale();
  if (urlLocale) return urlLocale;

  for (const key of STORAGE_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value === "ar" || value === "en") return value;
  }

  return document.documentElement.lang === "en" ? "en" : "ar";
}

export default function LoginPage() {
  const router = useRouter();
  const publicRegisterEnabled =
    process.env.NEXT_PUBLIC_REGISTER_ENABLED !== "false";

  const [locale, setLocale] = useState<Locale>("ar");
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const copy = COPY[locale];
  const isArabic = locale === "ar";
  const textAlignClass = isArabic ? "text-right" : "text-left";
  const inputTextAlign = isArabic ? "right" : "left";
  const inputTextClass = isArabic ? "!text-right" : "!text-left";
  const forgotPasswordHref = `/forgot-password?lang=${locale}`;
  const registerHref = `/register?lang=${locale}`;

  useEffect(() => {
    setLocale(getStoredLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isArabic ? "rtl" : "ltr";

    for (const key of STORAGE_KEYS) {
      window.localStorage.setItem(key, locale);
    }
  }, [isArabic, locale]);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      const hasTabSession =
        typeof window !== "undefined" &&
        sessionStorage.getItem("viresto_tab_session") === "active";

      const res = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      if (cancelled) return;

      if (res.ok && hasTabSession) {
        router.replace("/dashboard");
        return;
      }

      if (res.ok && !hasTabSession) {
        await fetch("/api/auth/logout", {
          method: "POST",
        }).catch(() => null);
      }
    }

    checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function toggleLocale() {
    setLocale((previous) => (previous === "ar" ? "en" : "ar"));
    setErrors({});
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const err: Record<string, string> = {};

    if (!form.email) err.email = copy.errors.emailRequired;
    if (!form.password) err.password = copy.errors.passwordRequired;

    if (Object.keys(err).length) {
      setErrors(err);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (data.success) {
        sessionStorage.setItem("viresto_tab_session", "active");
        sessionStorage.setItem("viresto_last_activity", String(Date.now()));

        toast.success(copy.toast.loginSuccess);

        window.location.href = "/dashboard";

        return;
      }
      const code = data?.details?.code || data?.data?.code || data?.code;

      const next = data?.details?.next || data?.data?.next || data?.next;

      const verifyEmail =
        data?.details?.email || data?.data?.email || data?.email || form.email;

      if (code === "EMAIL_NOT_VERIFIED" || next === "EMAIL_VERIFICATION") {
        toast.error(copy.toast.verifyEmail);
        router.push(`/verify-email?email=${encodeURIComponent(verifyEmail)}`);
        return;
      }

      toast.error(
        locale === "ar" && typeof data?.message === "string"
          ? data.message
          : copy.toast.genericError,
      );
    } catch {
      toast.error(copy.toast.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        background:
          "radial-gradient(circle at 15% 20%, rgba(245,200,66,.18), transparent 28%), radial-gradient(circle at 85% 15%, rgba(255,255,255,.12), transparent 26%), linear-gradient(135deg, #10261f 0%, #1f4639 48%, #071713 100%)",
      }}
    >
      <button
        type="button"
        onClick={toggleLocale}
        aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}
        title={isArabic ? "Switch to English" : "التبديل إلى العربية"}
        className={`absolute top-5 z-50 inline-flex items-center rounded-full border border-white/15 bg-white/10 p-1 shadow-2xl backdrop-blur-xl transition hover:bg-white/15 ${
          isArabic ? "left-5" : "right-5"
        }`}
      >
        <span dir="ltr" className="flex items-center gap-1">
          <span
            className={`rounded-full px-3 py-1 text-xs font-black transition ${
              isArabic ? "bg-white text-[#17352b] shadow-sm" : "text-white/70"
            }`}
          >
            AR
          </span>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black transition ${
              !isArabic ? "bg-white text-[#17352b] shadow-sm" : "text-white/70"
            }`}
          >
            EN
          </span>
        </span>
      </button>

      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -right-24 top-20 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "rgba(245, 200, 66, 0.18)" }}
          animate={{
            x: [0, -40, 20, 0],
            y: [0, 30, -20, 0],
            scale: [1, 1.12, 0.96, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.div
          className="absolute bottom-10 left-10 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "rgba(255,255,255,0.10)" }}
          animate={{
            x: [0, 35, -20, 0],
            y: [0, -35, 20, 0],
            scale: [1, 0.92, 1.08, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        {ambientIcons.map((item, index) => (
          <motion.div
            key={`${item.icon}-${index}`}
            className="pointer-events-none absolute hidden h-12 w-12 items-center justify-center rounded-2xl text-2xl backdrop-blur-xl lg:flex"
            style={{
              left: item.left,
              top: item.top,
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
              boxShadow: "0 18px 45px rgba(0,0,0,.12)",
              zIndex: 2,
            }}
            initial={{
              opacity: 0,
              scale: 0.7,
              rotate: -10,
            }}
            animate={{
              opacity: [0.25, 0.6, 0.25],
              y: [0, -18, 0],
              x: [0, index % 2 === 0 ? 10 : -10, 0],
              rotate: [-4, 6, -4],
              scale: [1, 1.08, 1],
            }}
            transition={{
              duration: 5 + index * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: item.delay,
            }}
          >
            {item.icon}
          </motion.div>
        ))}
      </div>

      <div className="relative z-20 grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_.95fr]">
        {/* Brand / motion side */}
        <section className="relative isolate hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
          <motion.div
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center gap-3">
              <div
                className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-3xl bg-white p-2"
                style={{
                  boxShadow: "0 18px 50px rgba(0,0,0,.18)",
                }}
              >
                <Image
                  src="/logo.png"
                  alt={copy.logoAlt}
                  width={44}
                  height={44}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>

              <div>
                <p className="text-3xl font-black text-white">Viresto</p>
                <p className="mt-1 text-sm font-semibold text-white/55">
                  {copy.brandSubtitle}
                </p>
              </div>
            </div>
          </motion.div>
          <div className="relative flex flex-1 items-center">
            <motion.div
              initial={{ opacity: 0, x: isArabic ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className={`relative z-20 ${isArabic ? "max-w-xl" : "max-w-[680px]"}`}
            >
              <h1
                className={`font-black text-white ${isArabic ? "text-5xl leading-[1.18]" : "text-[42px] leading-[1.12] xl:text-5xl"}`}
              >
                {copy.heroTitleTop}
                <br />
                {copy.heroTitleBottom}
              </h1>

              <p
                className={`mt-5 text-base font-semibold leading-8 text-white/70 ${isArabic ? "max-w-lg" : "max-w-[620px]"}`}
              >
                {copy.heroDescription}
              </p>

              <div
                className={`mt-8 grid gap-3 ${isArabic ? "max-w-[440px]" : "max-w-[460px]"}`}
              >
                {copy.features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 + index * 0.12 }}
                    className={`flex max-w-full items-start gap-3 rounded-[24px] border px-4 py-3 backdrop-blur-xl ${textAlignClass}`}
                    style={{
                      background: "rgba(255,255,255,.10)",
                      borderColor: "rgba(255,255,255,.16)",
                    }}
                  >
                    <span className="text-xl">{feature.icon}</span>

                    <div>
                      <p className="text-sm font-black text-white">
                        {feature.title}
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-white/55">
                        {feature.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {copy.floatingCards.map((card, index) => (
              <motion.div
                key={card.title}
                className={`absolute hidden w-44 rounded-[24px] border px-3 py-3 shadow-2xl backdrop-blur-xl 2xl:block ${textAlignClass}`}
                style={{
                  background: "rgba(255,255,255,.12)",
                  borderColor: "rgba(255,255,255,.16)",
                  ...(isArabic
                    ? {
                        left: index === 0 ? "-2%" : index === 1 ? "2%" : "-4%",
                      }
                    : {
                        right: index === 0 ? "-2%" : index === 1 ? "2%" : "-4%",
                      }),
                  top: index === 0 ? "34%" : index === 1 ? "58%" : "80%",
                  zIndex: 8,
                }}
                initial={{ opacity: 0, y: 25, scale: 0.96 }}
                animate={{
                  opacity: 1,
                  y: [0, -12, 0],
                  scale: [1, 1.02, 1],
                }}
                transition={{
                  opacity: { duration: 0.6, delay: 0.45 + card.delay },
                  y: {
                    duration: 4 + index,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: card.delay,
                  },
                  scale: {
                    duration: 4 + index,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: card.delay,
                  },
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{card.icon}</span>

                  <div>
                    <p className="text-xs font-black leading-5 text-white">
                      {card.title}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-white/55">
                      {card.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-xs font-semibold text-white/35"
          >
            © {new Date().getFullYear()} Viresto. {copy.footer}
          </motion.p>
        </section>

        {/* Login side */}
        <section className="flex items-center justify-center p-5 pt-20 sm:p-8 sm:pt-20 lg:pt-8">
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="w-full max-w-[460px]"
          >
            {/* Mobile logo */}
            <div className="mb-8 text-center lg:hidden">
              <motion.div
                initial={{ rotate: -8, scale: 0.9 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-white p-2"
              >
                <Image
                  src="/logo.png"
                  alt={copy.logoAlt}
                  width={52}
                  height={52}
                  className="h-full w-full object-contain"
                  priority
                />
              </motion.div>

              <p className="text-3xl font-black text-white">Viresto</p>
              <p className="mt-1 text-sm font-semibold text-white/55">
                {copy.brandSubtitle}
              </p>
            </div>

            <div
              className="relative overflow-hidden rounded-[32px] border p-1 shadow-2xl backdrop-blur-2xl"
              style={{
                background: "rgba(255,255,255,.14)",
                borderColor: "rgba(255,255,255,.22)",
              }}
            >
              <div
                className="absolute -right-12 -top-12 h-32 w-32 rounded-full blur-2xl"
                style={{ background: "rgba(245,200,66,.24)" }}
              />

              <div
                dir={isArabic ? "rtl" : "ltr"}
                className={`relative rounded-[28px] bg-white/90 p-6 text-slate-900 shadow-inner sm:p-7 dark:bg-[#10291d]/95 dark:text-emerald-50 ${textAlignClass}`}
              >
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <div className="mb-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-[#1f4d35] dark:text-emerald-50">
                    {copy.welcomeBadge}
                  </div>

                  <h2 className="text-2xl font-black text-slate-900 dark:text-emerald-50">
                    {copy.formTitle}
                  </h2>

                  <p className="mt-2 text-sm font-medium text-slate-600 dark:text-emerald-100/75">
                    {copy.formDescription}
                  </p>
                </motion.div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <FormField
                      label={copy.emailLabel}
                      required
                      error={errors.email}
                    >
                      <input
                        type="email"
                        value={form.email}
                        dir="ltr"
                        autoComplete="email"
                        onChange={(event) => {
                          setForm((previous) => ({
                            ...previous,
                            email: event.target.value,
                          }));
                          setErrors((previous) => ({
                            ...previous,
                            email: "",
                          }));
                        }}
                        className={`input ${inputTextClass}`}
                        style={{ direction: "ltr", textAlign: inputTextAlign }}
                        placeholder={copy.emailPlaceholder}
                      />
                    </FormField>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    <FormField
                      label={copy.passwordLabel}
                      required
                      error={errors.password}
                    >
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          dir="ltr"
                          autoComplete="current-password"
                          onChange={(event) => {
                            setForm((previous) => ({
                              ...previous,
                              password: event.target.value,
                            }));
                            setErrors((previous) => ({
                              ...previous,
                              password: "",
                            }));
                          }}
                          className={`input ${inputTextClass} ${
                            isArabic ? "!pl-14" : "!pr-14"
                          }`}
                          style={{
                            direction: "ltr",
                            textAlign: inputTextAlign,
                          }}
                          placeholder={copy.passwordPlaceholder}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((previous) => !previous)
                          }
                          aria-label={
                            showPassword ? copy.hidePassword : copy.showPassword
                          }
                          title={
                            showPassword ? copy.hidePassword : copy.showPassword
                          }
                          className={`absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#17352b] transition hover:bg-white hover:scale-105 dark:bg-white/90 dark:text-[#17352b] ${
                            isArabic ? "left-3" : "right-3"
                          }`}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" aria-hidden="true" />
                          ) : (
                            <Eye className="h-5 w-5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </FormField>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className={`flex ${isArabic ? "justify-end" : "justify-start"}`}
                  >
                    <Link
                      href={forgotPasswordHref}
                      className="text-sm font-black text-[#1f4639] transition hover:underline dark:text-emerald-300"
                    >
                      {copy.forgotPassword}
                    </Link>
                  </motion.div>

                  <motion.button
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    whileHover={{ scale: loading ? 1 : 1.015 }}
                    whileTap={{ scale: loading ? 1 : 0.985 }}
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full py-3 text-base"
                    style={{
                      boxShadow: "0 18px 35px rgba(31,70,57,.28)",
                    }}
                    aria-label={loading ? copy.loadingLabel : copy.submit}
                  >
                    {loading ? (
                      <span className="spinner spinner-sm" />
                    ) : (
                      copy.submit
                    )}
                  </motion.button>
                </form>

                {publicRegisterEnabled && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55 }}
                    className="mt-5"
                  >
                    <Link
                      href={registerHref}
                      prefetch={false}
                      className="block w-full rounded-2xl px-3 py-2 text-center text-sm font-semibold text-slate-600 transition hover:bg-emerald-500/10 dark:text-emerald-100/75"
                    >
                      {copy.noAccount}{" "}
                      <span className="font-black text-[#1f4639] underline-offset-4 hover:underline dark:text-emerald-300">
                        {copy.register}
                      </span>
                    </Link>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
