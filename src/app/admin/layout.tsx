import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import ProfileMenu from "@/components/layout/ProfileMenu";
import SessionGuard from "@/components/security/SessionGuard";
import { requireSystemAdmin } from "@/lib/system-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSystemAdmin();
  } catch {
    redirect("/login");
  }

  return (
    <div
      className="min-h-dvh"
      dir="rtl"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <SessionGuard />

      <header
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--card) 92%, transparent)",
        }}
      >
        <div className="flex min-h-[76px] items-center gap-3 px-4 md:px-8">
          <Link
            href="/admin"
            className="flex min-w-0 shrink-0 items-center gap-3"
            aria-label="العودة إلى لوحة إدارة Viresto"
          >
            <Image
              src="/viresto-logo.png"
              alt="Viresto"
              width={48}
              height={48}
              className="h-12 w-12 rounded-2xl object-cover"
              priority
            />

            <div className="hidden sm:block">
              <p className="text-base font-black">إدارة Viresto</p>
              <p className="text-xs font-bold" style={{ color: "var(--text-3)" }}>
                لوحة الشركة
              </p>
            </div>
          </Link>

          <nav className="mx-auto hidden items-center gap-1 rounded-2xl border p-1 lg:flex" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
            <a href="#overview" className="rounded-xl px-4 py-2 text-sm font-black transition hover:bg-[var(--card)]">
              الملخص
            </a>
            <a href="#payment-settings" className="rounded-xl px-4 py-2 text-sm font-black transition hover:bg-[var(--card)]">
              إعدادات الدفع
            </a>
            <a href="#manual-payments" className="rounded-xl px-4 py-2 text-sm font-black transition hover:bg-[var(--card)]">
              طلبات الدفع
            </a>
            <a href="#offices" className="rounded-xl px-4 py-2 text-sm font-black transition hover:bg-[var(--card)]">
              المكاتب
            </a>
          </nav>

          <div className="mr-auto flex shrink-0 items-center gap-2 lg:mr-0">
            <Link
              href="/dashboard"
              className="hidden h-11 items-center justify-center rounded-2xl border px-4 text-sm font-black transition hover:bg-[var(--input-bg)] md:inline-flex"
              style={{ borderColor: "var(--border)" }}
            >
              العودة للبرنامج
            </Link>

            <ThemeToggle />
            <ProfileMenu />
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto border-t px-4 py-2 lg:hidden" style={{ borderColor: "var(--border)" }}>
          <a href="#overview" className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black" style={{ background: "var(--input-bg)" }}>
            الملخص
          </a>
          <a href="#payment-settings" className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black" style={{ background: "var(--input-bg)" }}>
            إعدادات الدفع
          </a>
          <a href="#manual-payments" className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black" style={{ background: "var(--input-bg)" }}>
            طلبات الدفع
          </a>
          <a href="#offices" className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black" style={{ background: "var(--input-bg)" }}>
            المكاتب
          </a>
          <Link href="/dashboard" className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black" style={{ background: "var(--input-bg)" }}>
            العودة للبرنامج
          </Link>
        </nav>
      </header>

      {children}
    </div>
  );
}
