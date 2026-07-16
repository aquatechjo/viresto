"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LanguageToggle from "@/components/LanguageToggle";
import { useLocale } from "@/lib/useLocale";

type Invitation = {
  name: string;
  email: string;
  role: "ADMIN" | "LAWYER" | "STAFF";
  tenantName: string;
  expiresAt: string;
};

const COPY = {
  ar: {
    title: "الانضمام إلى فريق المكتب",
    loading: "جاري التحقق من الدعوة...",
    invalid: "الدعوة غير صالحة أو انتهت صلاحيتها.",
    invited: (name: string, tenant: string) =>
      `مرحبًا ${name}، تمت دعوتك للانضمام إلى ${tenant}.`,
    password: "اختر كلمة مرور",
    confirm: "تأكيد كلمة المرور",
    hint: "8 أحرف على الأقل، وتتضمن حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا خاصًا.",
    mismatch: "تأكيد كلمة المرور غير مطابق.",
    submit: "تفعيل الحساب",
    saving: "جاري تفعيل الحساب...",
    done: "تم تفعيل حسابك. سيتم نقلك إلى تسجيل الدخول.",
    login: "العودة إلى تسجيل الدخول",
  },
  en: {
    title: "Join the office team",
    loading: "Checking your invitation...",
    invalid: "This invitation is invalid or has expired.",
    invited: (name: string, tenant: string) =>
      `Hi ${name}, you were invited to join ${tenant}.`,
    password: "Choose a password",
    confirm: "Confirm password",
    hint: "Use at least 8 characters with upper and lower case letters, a number, and a symbol.",
    mismatch: "Password confirmation does not match.",
    submit: "Activate account",
    saving: "Activating account...",
    done: "Your account is active. Redirecting you to sign in.",
    login: "Back to sign in",
  },
} as const;

function JoinTeamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);
  const { locale } = useLocale();
  const copy = COPY[locale === "en" ? "en" : "ar"];
  const isRtl = locale !== "en";

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation() {
      if (!token) {
        setError(copy.invalid);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/auth/team-invitation?token=${encodeURIComponent(token)}`,
        );
        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (!response.ok || !data.success) {
          setError(data.message || copy.invalid);
          return;
        }

        setInvitation(data.data);
      } catch {
        if (!cancelled) setError(copy.invalid);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInvitation();
    return () => {
      cancelled = true;
    };
  }, [copy.invalid, token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError(copy.mismatch);
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/auth/team-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setError(data.message || copy.invalid);
        return;
      }

      setMessage(data.data?.message || copy.done);
      setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(invitation?.email || "")}`);
      }, 1200);
    } catch {
      setError(copy.invalid);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className="relative flex min-h-screen items-center justify-center bg-[#041819] px-4 py-10 text-white"
    >
      <div className="absolute top-5 end-5">
        <LanguageToggle />
      </div>

      <section className="w-full max-w-md rounded-[28px] border border-copper-400/25 bg-[#0b292a]/90 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-copper-400/15 text-2xl">👥</div>
          <h1 className="text-2xl font-black">{copy.title}</h1>
          {invitation && (
            <p className="mt-3 text-sm leading-7 text-copper-100/70">
              {copy.invited(invitation.name, invitation.tenantName)}
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-center text-sm font-bold text-copper-100/70">{copy.loading}</p>
        ) : error && !invitation ? (
          <div className="space-y-5 text-center">
            <div className="rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">{error}</div>
            <Link href="/login" className="inline-flex text-sm font-black text-copper-200 hover:text-white">{copy.login}</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {message && (
              <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">{message}</div>
            )}
            {error && (
              <div className="rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">{error}</div>
            )}

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-bold">{copy.password}</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-copper-300/60"
                required
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-bold">{copy.confirm}</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-copper-300/60"
                required
              />
            </div>

            <p className="text-xs leading-6 text-copper-100/60">{copy.hint}</p>

            <button
              type="submit"
              disabled={saving || Boolean(message)}
              className="w-full rounded-2xl bg-copper-400 px-4 py-3 font-black text-[#041819] transition hover:bg-copper-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? copy.saving : copy.submit}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function JoinTeamPage() {
  return (
    <Suspense fallback={null}>
      <JoinTeamContent />
    </Suspense>
  );
}
