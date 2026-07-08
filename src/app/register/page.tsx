"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Turnstile } from "@marsidev/react-turnstile";
import FormField from "@/components/ui/FormField";

type Locale = "ar" | "en";

const LOCALE_KEYS = ["locale", "viresto-locale", "preferred-locale"];

const COPY = {
  ar: {
    toggle: "English",
    brand: "Viresto",
    subtitle: "أنشئ مكتبك القانوني الآن",
    title: "تسجيل مكتب جديد",

    officeName: "اسم المكتب القانوني",
    officeNamePlaceholder: "مكتب المنصوري للمحاماة",
    fullName: "اسمك الكامل",
    fullNamePlaceholder: "أحمد المنصوري",
    email: "البريد الإلكتروني",
    emailPlaceholder: "ahmed@law.jo",
    phone: "رقم الهاتف",
    phonePlaceholder: "07XXXXXXXX",
    password: "كلمة المرور",
    passwordPlaceholder: "مثال: Viresto@123",
    passwordHelp:
      "يجب أن تحتوي كلمة المرور على حرف كبير، حرف صغير، رقم، ورمز خاص.",

    show: "إظهار",
    hide: "إخفاء",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",

    securityNotReady: "إعدادات التحقق الأمني غير مكتملة",
    securityRequired: "يرجى إكمال التحقق الأمني أولًا",
    securityDisabled: "التحقق الأمني غير مفعّل",

    createOffice: "إنشاء المكتب",
    creating: "جاري الإنشاء...",
    success: "تم إنشاء المكتب. يرجى تأكيد البريد الإلكتروني.",
    createError: "تعذر إنشاء الحساب",
    connectionError: "حدث خطأ في الاتصال",

    alreadyHaveAccount: "لديك حساب؟",
    login: "سجّل دخولك",

    disabledTitle: "التسجيل غير متاح حاليًا",
    disabledDescription:
      "إنشاء الحسابات الجديدة يتم حاليًا من خلال إدارة Viresto فقط.",
    backToLogin: "العودة إلى تسجيل الدخول",
  },

  en: {
    toggle: "العربية",
    brand: "Viresto",
    subtitle: "Create your legal office now",
    title: "Register a new office",

    officeName: "Legal office name",
    officeNamePlaceholder: "Al Mansouri Law Office",
    fullName: "Full name",
    fullNamePlaceholder: "Ahmad Al Mansouri",
    email: "Email address",
    emailPlaceholder: "ahmed@law.jo",
    phone: "Phone number",
    phonePlaceholder: "07XXXXXXXX",
    password: "Password",
    passwordPlaceholder: "Example: Viresto@123",
    passwordHelp:
      "Your password must include an uppercase letter, a lowercase letter, a number, and a special character.",

    show: "Show",
    hide: "Hide",
    showPassword: "Show password",
    hidePassword: "Hide password",

    securityNotReady: "Security verification settings are incomplete",
    securityRequired: "Please complete the security verification first",
    securityDisabled: "Security verification is not enabled",

    createOffice: "Create office",
    creating: "Creating...",
    success: "Your office has been created. Please verify your email address.",
    createError: "Unable to create the account",
    connectionError: "A connection error occurred",

    alreadyHaveAccount: "Already have an account?",
    login: "Login",

    disabledTitle: "Registration is currently unavailable",
    disabledDescription:
      "New account creation is currently available through Viresto administration only.",
    backToLogin: "Back to login",
  },
} as const;

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "ar";

  const params = new URLSearchParams(window.location.search);
  const langParam = params.get("lang");

  if (langParam === "ar" || langParam === "en") {
    return langParam;
  }

  for (const key of LOCALE_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value === "ar" || value === "en") return value;
  }

  return "ar";
}

function saveLocale(locale: Locale) {
  if (typeof window === "undefined") return;

  for (const key of LOCALE_KEYS) {
    window.localStorage.setItem(key, locale);
  }

  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

export default function RegisterPage() {
  const router = useRouter();

  const publicRegisterEnabled =
    process.env.NEXT_PUBLIC_REGISTER_ENABLED === "true";

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const [locale, setLocale] = useState<Locale>("ar");

  const [form, setForm] = useState({
    tenantName: "",
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);

  const isRtl = locale === "ar";
  const copy = useMemo(() => COPY[locale], [locale]);
  const loginHref = `/login?lang=${locale}`;
  const verifyLangQuery = `lang=${locale}`;

  useEffect(() => {
    const initialLocale = getInitialLocale();
    setLocale(initialLocale);
    saveLocale(initialLocale);
  }, []);

  function toggleLocale() {
    const nextLocale: Locale = locale === "ar" ? "en" : "ar";
    setLocale(nextLocale);
    saveLocale(nextLocale);

    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLocale);
    window.history.replaceState(null, "", url.toString());
  }

  function resetTurnstile() {
    setTurnstileToken("");
    setTurnstileKey((current) => current + 1);
  }

  function update(key: keyof typeof form) {
    return (event: ChangeEvent<HTMLInputElement>) =>
      setForm((previous) => ({ ...previous, [key]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!turnstileSiteKey) {
      toast.error(copy.securityNotReady);
      return;
    }

    if (!turnstileToken) {
      toast.error(copy.securityRequired);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          turnstileToken,
        }),
      });

      const data = await res.json().catch(() => null);

      if (data?.success) {
        toast.success(copy.success);

        const verifyEmail = data?.data?.email || form.email;

        router.push(
          `/verify-email?email=${encodeURIComponent(
            verifyEmail,
          )}&${verifyLangQuery}`,
        );

        return;
      }

      resetTurnstile();
      toast.error(copy.createError);
    } catch {
      resetTurnstile();
      toast.error(copy.connectionError);
    } finally {
      setLoading(false);
    }
  }

  if (!publicRegisterEnabled) {
    return (
      <main
        dir={isRtl ? "rtl" : "ltr"}
        className="relative flex min-h-screen items-center justify-center p-6"
        style={{ background: "var(--bg)" }}
      >
        <button
          type="button"
          onClick={toggleLocale}
          aria-label={isRtl ? "Switch to English" : "التبديل إلى العربية"}
          title={isRtl ? "Switch to English" : "التبديل إلى العربية"}
          className={[
            "absolute top-5 z-50 inline-flex items-center rounded-full border border-white/15 bg-white/10 p-1 shadow-2xl backdrop-blur-xl transition hover:bg-white/15",
            isRtl ? "left-5" : "right-5",
          ].join(" ")}
        >
          <span dir="ltr" className="flex items-center gap-1">
            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-black transition",
                isRtl ? "bg-white text-[#17352b] shadow-sm" : "text-white/70",
              ].join(" ")}
            >
              AR
            </span>

            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-black transition",
                !isRtl ? "bg-white text-[#17352b] shadow-sm" : "text-white/70",
              ].join(" ")}
            >
              EN
            </span>
          </span>
        </button>

        <div className="card w-full max-w-sm p-7 text-center">
          <h1
            className="mb-3 text-xl font-black"
            style={{ color: "var(--text)" }}
          >
            {copy.disabledTitle}
          </h1>

          <p className="text-sm leading-7" style={{ color: "var(--text-3)" }}>
            {copy.disabledDescription}
          </p>

          <Link href={loginHref} className="btn btn-primary mt-6 w-full">
            {copy.backToLogin}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className="relative flex min-h-screen items-center justify-center p-6"
      style={{ background: "var(--bg)" }}
    >
      <button
        type="button"
        onClick={toggleLocale}
        aria-label={isRtl ? "Switch to English" : "التبديل إلى العربية"}
        title={isRtl ? "Switch to English" : "التبديل إلى العربية"}
        className={[
          "absolute top-5 z-50 inline-flex items-center rounded-full border border-white/15 bg-white/10 p-1 shadow-2xl backdrop-blur-xl transition hover:bg-white/15",
          isRtl ? "left-5" : "right-5",
        ].join(" ")}
      >
        <span dir="ltr" className="flex items-center gap-1">
          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-black transition",
              isRtl ? "bg-white text-[#17352b] shadow-sm" : "text-white/70",
            ].join(" ")}
          >
            AR
          </span>

          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-black transition",
              !isRtl ? "bg-white text-[#17352b] shadow-sm" : "text-white/70",
            ].join(" ")}
          >
            EN
          </span>
        </span>
      </button>

      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-3xl font-black tracking-tight text-emerald-300 drop-shadow-[0_0_22px_rgba(52,211,153,0.25)]">
            {copy.brand}
          </p>

          <p className="mt-1 text-sm font-semibold text-emerald-50/75">
            {copy.subtitle}
          </p>
        </div>

        <div className="card p-7">
          <h1
            className={[
              "mb-5 text-xl font-black",
              isRtl ? "text-right" : "text-left",
            ].join(" ")}
            style={{ color: "var(--text)" }}
          >
            {copy.title}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label={copy.officeName} required>
              <input
                name="organization"
                autoComplete="organization"
                value={form.tenantName}
                onChange={update("tenantName")}
                className="input"
                style={{
                  textAlign: isRtl ? "right" : "left",
                  direction: isRtl ? "rtl" : "ltr",
                }}
                placeholder={copy.officeNamePlaceholder}
              />
            </FormField>

            <FormField label={copy.fullName} required>
              <input
                name="name"
                autoComplete="name"
                value={form.name}
                onChange={update("name")}
                className="input"
                style={{
                  textAlign: isRtl ? "right" : "left",
                  direction: isRtl ? "rtl" : "ltr",
                }}
                placeholder={copy.fullNamePlaceholder}
              />
            </FormField>

            <FormField label={copy.email} required>
              <input
                dir="ltr"
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={update("email")}
                className="input"
                style={{
                  textAlign: "left",
                  direction: "ltr",
                }}
                placeholder={copy.emailPlaceholder}
              />
            </FormField>

            <FormField label={copy.phone} required>
              <input
                dir="ltr"
                type="tel"
                name="phone"
                autoComplete="tel"
                inputMode="tel"
                value={form.phone}
                onChange={update("phone")}
                className="input"
                style={{
                  textAlign: "left",
                  direction: "ltr",
                }}
                placeholder={copy.phonePlaceholder}
              />
            </FormField>

            <FormField label={copy.password} required>
              <div className="relative">
                <input
                  dir="ltr"
                  type={showPassword ? "text" : "password"}
                  name="new-password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={update("password")}
                  className="input"
                  style={{
                    textAlign: "left",
                    direction: "ltr",
                    paddingRight: isRtl ? undefined : "5.5rem",
                    paddingLeft: isRtl ? "5.5rem" : undefined,
                  }}
                  placeholder={copy.passwordPlaceholder}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className={[
                    "absolute top-1/2 z-10 -translate-y-1/2 rounded-xl bg-white/10 px-2.5 py-1 text-xs font-bold transition hover:bg-white/15",
                    isRtl ? "left-3" : "right-3",
                  ].join(" ")}
                  style={{ color: "var(--text)" }}
                  aria-label={
                    showPassword ? copy.hidePassword : copy.showPassword
                  }
                >
                  {showPassword ? copy.hide : copy.show}
                </button>
              </div>

              <p
                className={[
                  "mt-2 text-xs leading-6",
                  isRtl ? "text-right" : "text-left",
                ].join(" ")}
                style={{ color: "var(--text-3)" }}
              >
                {copy.passwordHelp}
              </p>
            </FormField>

            <div className="mx-auto flex w-fit justify-center rounded-2xl p-2">
              {turnstileSiteKey ? (
                <Turnstile
                  key={turnstileKey}
                  siteKey={turnstileSiteKey}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={resetTurnstile}
                  onError={resetTurnstile}
                  options={{
                    theme: "dark",
                    language: locale,
                  }}
                />
              ) : (
                <p
                  className="text-center text-xs font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  {copy.securityDisabled}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !turnstileToken}
              className="btn btn-primary mt-1 w-full py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="spinner spinner-sm" />
              ) : (
                copy.createOffice
              )}
            </button>
          </form>

          <p
            className="mt-4 text-center text-sm"
            style={{ color: "var(--text-3)" }}
          >
            {copy.alreadyHaveAccount}{" "}
            <Link
              href={loginHref}
              className="font-black text-emerald-300 transition hover:text-emerald-200 hover:underline"
            >
              {copy.login}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
