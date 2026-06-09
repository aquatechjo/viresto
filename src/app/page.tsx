"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Locale = "ar" | "en";

type Feature = {
  icon: string;
  title: string;
  description: string;
};

type Plan = {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

type Faq = {
  question: string;
  answer: string;
};

const COPY: Record<
  Locale,
  {
    nav: {
      features: string;
      pricing: string;
      getStarted: string;
      login: string;
      launch: string;
      language: string;
    };
    hero: {
      badge: string;
      titleTop: string;
      titleAccent: string;
      titleBottom: string;
      description: string;
      primary: string;
      secondary: string;
      tags: string[];
    };
    preview: {
      dashboard: string;
      revenue: string;
      cases: string;
      clients: string;
      assistant: string;
      live: string;
      message: string;
      today: string;
      appointments: string;
      documents: string;
      uploadedFiles: string;
    };
    features: {
      eyebrow: string;
      title: string;
      description: string;
      items: Feature[];
    };
    pricing: {
      eyebrow: string;
      title: string;
      description: string;
      perMonth: string;
      action: string;
      plans: Plan[];
    };
    faq: {
      eyebrow: string;
      title: string;
      items: Faq[];
    };
    cta: {
      eyebrow: string;
      title: string;
      description: string;
      action: string;
    };
    footer: string;
  }
> = {
  en: {
    nav: {
      features: "Features",
      pricing: "Pricing",
      getStarted: "Get Started",
      login: "Login",
      launch: "Launch",
      language: "العربية",
    },
    hero: {
      badge: "Everything your legal office needs in one place",
      titleTop: "Run your legal office",
      titleAccent: "with confidence and clarity.",
      titleBottom: "",
      description:
        "One platform to organize cases, clients, appointments, documents, invoices, and financial reports professionally and quickly.",
      primary: "Start Now",
      secondary: "Explore Features",
      tags: [
        "Case management",
        "Client organization",
        "Payment tracking",
        "Smart reports",
      ],
    },
    preview: {
      dashboard: "Viresto Dashboard",
      revenue: "Revenue",
      cases: "Cases",
      clients: "Clients",
      assistant: "AI Assistant",
      live: "Live",
      message:
        "Upcoming court session for Ahmed Ali is scheduled tomorrow at 10:30 AM.",
      today: "Today",
      appointments: "8 appointments",
      documents: "Documents",
      uploadedFiles: "36 uploaded files",
    },
    features: {
      eyebrow: "FEATURES",
      title: "Everything Your Law Firm Needs",
      description:
        "Manage your legal operations, documents, appointments, analytics, and AI workflows from one centralized workspace.",
      items: [
        {
          icon: "⚖️",
          title: "Case Management",
          description:
            "Organize cases, statuses, fees, related clients, and legal activity in one place.",
        },
        {
          icon: "📄",
          title: "Document System",
          description:
            "Upload, classify, preview, and connect documents to clients and cases securely.",
        },
        {
          icon: "📅",
          title: "Appointments",
          description:
            "Track sessions, meetings, deadlines, and calendar updates across the office.",
        },
        {
          icon: "🤖",
          title: "AI Legal Assistant",
          description:
            "Summarize documents and speed up repetitive legal workflows with AI support.",
        },
        {
          icon: "📊",
          title: "Revenue Analytics",
          description:
            "Monitor payments, invoices, outstanding balances, and office performance.",
        },
        {
          icon: "🔔",
          title: "Live Notifications",
          description:
            "Stay updated with important activity, tasks, sessions, and operational alerts.",
        },
      ],
    },
    pricing: {
      eyebrow: "PRICING",
      title: "Simple Plans for Modern Law Firms",
      description: "Start small and scale as your legal operations grow.",
      perMonth: "/mo",
      action: "Get Started",
      plans: [
        {
          name: "Starter",
          price: "$19",
          description: "For solo lawyers",
          features: [
            "Case management",
            "Client management",
            "Document uploads",
            "Analytics dashboard",
          ],
        },
        {
          name: "Pro",
          price: "$49",
          description: "For growing law firms",
          highlighted: true,
          features: [
            "Case management",
            "Client management",
            "Document uploads",
            "Analytics dashboard",
            "AI Legal Assistant",
          ],
        },
        {
          name: "Enterprise",
          price: "Custom",
          description: "For larger legal teams",
          features: [
            "Case management",
            "Client management",
            "Document uploads",
            "Analytics dashboard",
            "AI Legal Assistant",
            "Advanced permissions",
          ],
        },
      ],
    },
    faq: {
      eyebrow: "FAQ",
      title: "Frequently Asked Questions",
      items: [
        {
          question: "Is Viresto suitable for solo lawyers?",
          answer:
            "Yes, Viresto is built for solo lawyers, small offices, and growing law firms.",
        },
        {
          question: "Can I manage clients and cases?",
          answer:
            "Yes, you can manage clients, cases, documents, payments, appointments, and tasks.",
        },
        {
          question: "Does Viresto support AI features?",
          answer:
            "Yes, Pro and Enterprise plans include an AI Legal Assistant for summaries and insights.",
        },
        {
          question: "Can larger firms use Viresto?",
          answer:
            "Yes, Enterprise is designed for larger teams with advanced permissions and scalability.",
        },
      ],
    },
    cta: {
      eyebrow: "GET STARTED",
      title: "Ready to modernize your law firm?",
      description:
        "Start managing cases, clients, documents, and legal workflows from one secure platform.",
      action: "Start Now",
    },
    footer: "© 2026 Viresto. All rights reserved.",
  },
  ar: {
    nav: {
      features: "المميزات",
      pricing: "الأسعار",
      getStarted: "ابدأ الآن",
      login: "تسجيل الدخول",
      launch: "تشغيل النظام",
      language: "English",
    },
    hero: {
      badge: "كل أدوات مكتبك القانوني في مكان واحد",
      titleTop: "أدر مكتبك القانوني",
      titleAccent: "بثقة ووضوح.",
      titleBottom: "",
      description:
        "منصة واحدة لتنظيم القضايا، الموكلين، المواعيد، المستندات، الفواتير والتقارير المالية بطريقة احترافية وسريعة.",
      primary: "ابدأ الآن",
      secondary: "استكشف المميزات",
      tags: [
        "إدارة القضايا",
        "تنظيم الموكلين",
        "متابعة المدفوعات",
        "تقارير ذكية",
      ],
    },
    preview: {
      dashboard: "لوحة Viresto",
      revenue: "الإيرادات",
      cases: "القضايا",
      clients: "الموكلون",
      assistant: "المساعد الذكي",
      live: "مباشر",
      message: "جلسة محكمة قادمة للموكل أحمد علي غدًا الساعة 10:30 صباحًا.",
      today: "اليوم",
      appointments: "8 مواعيد",
      documents: "المستندات",
      uploadedFiles: "36 ملفًا مرفوعًا",
    },
    features: {
      eyebrow: "المميزات",
      title: "كل ما يحتاجه مكتب المحاماة",
      description:
        "أدر العمليات القانونية والمستندات والمواعيد والتحليلات وسير العمل الذكي من مساحة عمل مركزية واحدة.",
      items: [
        {
          icon: "⚖️",
          title: "إدارة القضايا",
          description:
            "تنظيم القضايا والحالات والأتعاب والموكلين المرتبطين والنشاطات القانونية من مكان واحد.",
        },
        {
          icon: "📄",
          title: "نظام المستندات",
          description:
            "رفع المستندات وتصنيفها ومعاينتها وربطها بالموكلين والقضايا بشكل آمن.",
        },
        {
          icon: "📅",
          title: "المواعيد",
          description:
            "متابعة الجلسات والاجتماعات والمواعيد النهائية وتحديثات التقويم داخل المكتب.",
        },
        {
          icon: "🤖",
          title: "المساعد القانوني الذكي",
          description:
            "تلخيص المستندات وتسريع الأعمال القانونية المتكررة بمساعدة الذكاء الاصطناعي.",
        },
        {
          icon: "📊",
          title: "التحليلات المالية",
          description:
            "متابعة المدفوعات والفواتير والأرصدة المتبقية وأداء المكتب بشكل واضح.",
        },
        {
          icon: "🔔",
          title: "تنبيهات مباشرة",
          description:
            "ابقَ على اطلاع بالنشاطات المهمة والمهام والجلسات والتنبيهات التشغيلية.",
        },
      ],
    },
    pricing: {
      eyebrow: "الأسعار",
      title: "خطط بسيطة لمكاتب محاماة حديثة",
      description: "ابدأ بخطة مناسبة وتوسع مع نمو عملياتك القانونية.",
      perMonth: "/شهريًا",
      action: "ابدأ الآن",
      plans: [
        {
          name: "Starter",
          price: "$19",
          description: "للمحامين الأفراد",
          features: [
            "إدارة القضايا",
            "إدارة الموكلين",
            "رفع المستندات",
            "لوحة تحليلات",
          ],
        },
        {
          name: "Pro",
          price: "$49",
          description: "للمكاتب النامية",
          highlighted: true,
          features: [
            "إدارة القضايا",
            "إدارة الموكلين",
            "رفع المستندات",
            "لوحة تحليلات",
            "مساعد قانوني ذكي",
          ],
        },
        {
          name: "Enterprise",
          price: "حسب الطلب",
          description: "للفرق القانونية الكبيرة",
          features: [
            "إدارة القضايا",
            "إدارة الموكلين",
            "رفع المستندات",
            "لوحة تحليلات",
            "مساعد قانوني ذكي",
            "صلاحيات متقدمة",
          ],
        },
      ],
    },
    faq: {
      eyebrow: "الأسئلة الشائعة",
      title: "أسئلة يتكرر طرحها",
      items: [
        {
          question: "هل يناسب Viresto المحامين الأفراد؟",
          answer:
            "نعم، صُمم Viresto للمحامين الأفراد والمكاتب الصغيرة ومكاتب المحاماة النامية.",
        },
        {
          question: "هل يمكنني إدارة الموكلين والقضايا؟",
          answer:
            "نعم، يمكنك إدارة الموكلين والقضايا والمستندات والمدفوعات والمواعيد والمهام.",
        },
        {
          question: "هل يدعم Viresto مزايا الذكاء الاصطناعي؟",
          answer:
            "نعم، تتضمن خطط Pro وEnterprise مساعدًا قانونيًا ذكيًا للتلخيص والتحليلات.",
        },
        {
          question: "هل يمكن للمكاتب الكبيرة استخدام Viresto؟",
          answer:
            "نعم، صُممت خطة Enterprise للفرق الأكبر مع صلاحيات متقدمة وقابلية توسع.",
        },
      ],
    },
    cta: {
      eyebrow: "ابدأ الآن",
      title: "جاهز لتحديث طريقة عمل مكتبك؟",
      description:
        "ابدأ بإدارة القضايا والموكلين والمستندات وسير العمل القانوني من منصة آمنة واحدة.",
      action: "ابدأ الآن",
    },
    footer: "© 2026 Viresto. جميع الحقوق محفوظة.",
  },
};

const STORAGE_KEYS = ["locale", "viresto-locale", "preferred-locale"];

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";

  for (const key of STORAGE_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value === "ar" || value === "en") return value;
  }

  return document.documentElement.lang === "ar" ? "ar" : "en";
}

function VirestoLogo() {
  return (
    <span className="flex items-center gap-3" aria-label="Viresto">
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-emerald-300/25 bg-white/[0.07] p-2 shadow-[0_14px_34px_rgba(16,185,129,0.18),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl">
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(52,211,153,0.30),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.12),rgba(16,185,129,0.08))]" />
        <img
          src="/logo.png"
          alt="Viresto logo"
          className="relative z-10 h-full w-full object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.30)]"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      </span>

      <span className="text-2xl font-black tracking-tight text-white">
        Viresto
      </span>
    </span>
  );
}

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>("en");
  const copy = COPY[locale];
  const isArabic = locale === "ar";

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

  const nextLocale = useMemo<Locale>(
    () => (isArabic ? "en" : "ar"),
    [isArabic],
  );

  function changeLanguage() {
    setLocale(nextLocale);
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen overflow-x-hidden bg-[#07110d] text-white"
    >
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#07110d]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center">
            <VirestoLogo />
          </Link>

          <div className="hidden items-center gap-8 text-sm font-semibold text-white/60 md:flex">
            <a href="#features" className="transition hover:text-white">
              {copy.nav.features}
            </a>

            <a href="#pricing" className="transition hover:text-white">
              {copy.nav.pricing}
            </a>

            <a href="#cta" className="transition hover:text-white">
              {copy.nav.getStarted}
            </a>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={changeLanguage}
              className="hidden h-12 w-16 items-center justify-center rounded-2xl border border-emerald-400/35 bg-white/[0.03] text-sm font-black uppercase tracking-wide text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-emerald-300/60 hover:bg-emerald-500/10 hover:text-white sm:flex"
              aria-label={copy.nav.language}
              title={copy.nav.language}
            >
              {isArabic ? "AR" : "EN"}
            </button>

            <Link
              href="/login"
              className="hidden h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 font-semibold transition hover:bg-white/10 sm:flex"
            >
              {copy.nav.login}
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative px-5 pb-10 pt-28 sm:px-6 lg:pb-12 lg:pt-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,.18),transparent_42%)]" />
        <div className="pointer-events-none absolute left-[-12rem] top-36 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-[-10rem] top-28 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
          <div
            className={
              isArabic
                ? "max-w-2xl text-right lg:[direction:rtl]"
                : "max-w-2xl text-left lg:[direction:ltr]"
            }
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 shadow-lg shadow-black/10">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {copy.hero.badge}
            </div>

            <h1 className="max-w-2xl text-3xl font-black leading-[1.1] tracking-tight text-balance sm:text-4xl sm:leading-[1.08] lg:text-5xl lg:leading-[1.06] xl:text-[3.35rem] xl:leading-[1.04]">
              <span className="block">{copy.hero.titleTop}</span>
              <span className="block text-emerald-400">
                {copy.hero.titleAccent}
              </span>
              {copy.hero.titleBottom ? (
                <span className="block">{copy.hero.titleBottom}</span>
              ) : null}
            </h1>

            <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-white/70">
              {copy.hero.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="flex h-14 items-center justify-center rounded-2xl bg-emerald-500 px-7 font-bold text-black transition-all hover:bg-emerald-400"
              >
                {copy.hero.primary}
              </Link>

              <a
                href="#features"
                className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-7 font-semibold transition-all hover:bg-white/10"
              >
                {copy.hero.secondary}
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-white/55 sm:gap-4">
              {copy.hero.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="relative w-full">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-emerald-500/10 blur-3xl" />

            <div className="relative rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>

                <span className="text-xs font-semibold text-white/40">
                  {copy.preview.dashboard}
                </span>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <p className="text-xs text-white/60">
                      {copy.preview.revenue}
                    </p>
                    <p className="mt-2 text-2xl font-black">$24.5K</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/60">
                      {copy.preview.cases}
                    </p>
                    <p className="mt-2 text-2xl font-black">128</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/60">
                      {copy.preview.clients}
                    </p>
                    <p className="mt-2 text-2xl font-black">54</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-white/55">
                      {copy.preview.assistant}
                    </p>

                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                      {copy.preview.live}
                    </span>
                  </div>

                  <div className="rounded-xl bg-white/5 p-4 text-sm leading-7 text-white/80">
                    {copy.preview.message}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/50">
                      {copy.preview.today}
                    </p>
                    <p className="mt-2 font-bold">
                      {copy.preview.appointments}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/50">
                      {copy.preview.documents}
                    </p>
                    <p className="mt-2 font-bold">
                      {copy.preview.uploadedFiles}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="mx-auto max-w-7xl px-5 pt-12 pb-20 sm:px-6"
      >
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <p className="text-sm font-bold text-emerald-400">
            {copy.features.eyebrow}
          </p>

          <h2 className="mt-4 text-4xl font-black">{copy.features.title}</h2>

          <p className="mx-auto mt-5 max-w-2xl leading-8 text-white/60">
            {copy.features.description}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {copy.features.items.map((feature) => (
            <div
              key={feature.title}
              className="rounded-[2rem] border border-white/10 bg-white/5 p-7 transition-all hover:bg-white/[0.07]"
            >
              <div className="mb-5 text-4xl">{feature.icon}</div>
              <h3 className="text-xl font-bold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/60">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
        <div className="mb-14 text-center">
          <p className="text-sm font-bold text-emerald-400">
            {copy.pricing.eyebrow}
          </p>

          <h2 className="mt-4 text-4xl font-black">{copy.pricing.title}</h2>

          <p className="mx-auto mt-5 max-w-2xl leading-8 text-white/60">
            {copy.pricing.description}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {copy.pricing.plans.map((plan) => (
            <div
              key={plan.name}
              className={[
                "flex min-h-[430px] flex-col rounded-[2rem] border p-8 transition-all hover:bg-white/[0.07]",
                plan.highlighted
                  ? "border-emerald-400/30 bg-emerald-500/10 shadow-2xl shadow-emerald-950/30"
                  : "border-white/10 bg-white/5",
              ].join(" ")}
            >
              <h3 className="text-2xl font-black">{plan.name}</h3>
              <p className="mt-2 text-white/60">{plan.description}</p>

              <p className="mt-8 text-4xl font-black">
                {plan.price}
                {plan.price !== "Custom" && plan.price !== "حسب الطلب" && (
                  <span className="text-base font-medium text-white/40">
                    {" "}
                    {copy.pricing.perMonth}
                  </span>
                )}
              </p>

              <ul className="mt-8 space-y-3 text-sm text-white/70">
                {plan.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>

              <Link
                href="/dashboard"
                className="mt-auto flex h-12 items-center justify-center rounded-2xl bg-emerald-500 font-bold text-black transition hover:bg-emerald-400"
              >
                {copy.pricing.action}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <p className="text-sm font-bold text-emerald-400">
            {copy.faq.eyebrow}
          </p>

          <h2 className="mt-4 text-4xl font-black">{copy.faq.title}</h2>
        </div>

        <div className="space-y-4">
          {copy.faq.items.map((item) => (
            <div
              key={item.question}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <h3 className="text-lg font-black">{item.question}</h3>
              <p className="mt-3 leading-7 text-white/60">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="cta" className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
        <div className="rounded-[2.5rem] border border-emerald-400/20 bg-emerald-500/10 p-10 text-center md:p-16">
          <p className="font-bold text-emerald-400">{copy.cta.eyebrow}</p>

          <h2 className="mt-5 text-4xl font-black md:text-5xl">
            {copy.cta.title}
          </h2>

          <p className="mx-auto mt-6 max-w-2xl leading-8 text-white/60">
            {copy.cta.description}
          </p>

          <Link
            href="/dashboard"
            className="mt-8 inline-flex h-14 items-center justify-center rounded-2xl bg-emerald-500 px-8 font-bold text-black transition hover:bg-emerald-400"
          >
            {copy.cta.action}
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 sm:px-6 md:flex-row">
          <p className="text-xl font-black">Viresto</p>

          <p className="text-sm text-white/50">{copy.footer}</p>
        </div>
      </footer>
    </main>
  );
}
