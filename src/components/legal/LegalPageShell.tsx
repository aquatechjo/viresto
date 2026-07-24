import Link from "next/link";

export type LegalLocale = "ar" | "en";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

type LegalPageShellProps = {
  locale: LegalLocale;
  pathname: string;
  title: string;
  description: string;
  sections: LegalSection[];
};

const NAVIGATION = {
  ar: {
    home: "الرئيسية",
    privacy: "سياسة الخصوصية",
    terms: "الشروط والأحكام",
    subscription: "الاشتراك والإلغاء والاسترداد",
    language: "English",
    effective: "تاريخ النفاذ: 24 يوليو 2026",
    operator: "Viresto منصة تُشغّلها Aqua Tech — عمّان، الأردن",
    contact: "للاستفسارات القانونية أو طلبات الخصوصية:",
  },
  en: {
    home: "Home",
    privacy: "Privacy Policy",
    terms: "Terms & Conditions",
    subscription: "Subscription, Cancellation & Refunds",
    language: "العربية",
    effective: "Effective date: July 24, 2026",
    operator: "Viresto is operated by Aqua Tech — Amman, Jordan",
    contact: "For legal questions or privacy requests:",
  },
} as const;

export default function LegalPageShell({
  locale,
  pathname,
  title,
  description,
  sections,
}: LegalPageShellProps) {
  const isArabic = locale === "ar";
  const copy = NAVIGATION[locale];
  const query = `?lang=${locale}`;
  const alternateLocale = isArabic ? "en" : "ar";

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-950 text-slate-100"
    >
      <header className="border-b border-white/10 bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <Link href={`/${query}`} className="text-2xl font-black text-white">
            Viresto
          </Link>

          <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
            <Link
              href={`/${query}`}
              className="rounded-xl px-3 py-2 text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              {copy.home}
            </Link>
            <Link
              href={`${pathname}?lang=${alternateLocale}`}
              className="rounded-xl border border-copper-400/30 px-4 py-2 text-copper-300 transition hover:bg-copper-400/10"
            >
              {copy.language}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-16">
        <nav className="h-fit rounded-3xl border border-white/10 bg-white/5 p-4 lg:sticky lg:top-6">
          <div className="grid gap-2 text-sm font-bold">
            <LegalNavLink
              href={`/privacy${query}`}
              active={pathname === "/privacy"}
            >
              {copy.privacy}
            </LegalNavLink>
            <LegalNavLink href={`/terms${query}`} active={pathname === "/terms"}>
              {copy.terms}
            </LegalNavLink>
            <LegalNavLink
              href={`/subscription-policy${query}`}
              active={pathname === "/subscription-policy"}
            >
              {copy.subscription}
            </LegalNavLink>
          </div>
        </nav>

        <article className="min-w-0 rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 sm:p-10">
          <div className="border-b border-white/10 pb-8">
            <p className="text-sm font-bold text-copper-300">
              {copy.effective}
            </p>
            <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
              {title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
              {description}
            </p>
          </div>

          <div className="mt-8 space-y-10">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-black text-copper-200">
                  {section.heading}
                </h2>

                {section.paragraphs?.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mt-4 text-sm leading-8 text-slate-300 sm:text-base"
                  >
                    {paragraph}
                  </p>
                ))}

                {section.bullets?.length ? (
                  <ul className="mt-4 list-disc space-y-3 ps-6 text-sm leading-7 text-slate-300 sm:text-base">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <footer className="mt-12 border-t border-white/10 pt-8 text-sm leading-7 text-slate-400">
            <p>{copy.operator}</p>
            <p className="mt-2">
              {copy.contact}{" "}
              <a
                dir="ltr"
                href="mailto:info.aquatech.jo@gmail.com"
                className="font-bold text-copper-300 hover:underline"
              >
                info.aquatech.jo@gmail.com
              </a>
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}

function LegalNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "rounded-2xl px-4 py-3 transition",
        active
          ? "bg-copper-400/15 text-copper-200 ring-1 ring-copper-400/30"
          : "text-slate-300 hover:bg-white/5 hover:text-white",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
