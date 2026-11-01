"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Laptop,
  LogOut,
  MapPin,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import PageLoader from "@/components/ui/PageLoader";
import { PageHeader, PageHeaderAction, PageStats } from "@/components/page";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import { parseDevice } from "@/lib/device";

interface SessionItem {
  id: string;
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  city?: string;
  lastActivityAt: string;
  createdAt: string;
  isCurrent: boolean;
}

function getLocation(session: SessionItem) {
  if (session.city && session.country)
    return `${session.city}, ${session.country}`;
  if (session.city) return session.city;
  if (session.country) return session.country;
  return "غير معروف";
}

function getSessionRisk(session: SessionItem) {
  if (!session.ipAddress || session.ipAddress === "Unknown") return "medium";
  if (!session.userAgent) return "medium";
  return "low";
}

function riskLabel(risk: string) {
  if (risk === "high") return "مرتفع";
  if (risk === "medium") return "متوسط";
  return "منخفض";
}

function riskBadge(risk: string) {
  if (risk === "high") return "badge badge-red";
  if (risk === "medium") return "badge badge-amber";
  return "badge badge-green";
}

export default function SessionsClient() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  function confirmToast(message: string) {
    return new Promise<boolean>((resolve) => {
      let settled = false;

      const toastId = toast(message, {
        duration: 10000,
        action: {
          label: "تأكيد",
          onClick: () => {
            if (settled) return;
            settled = true;
            toast.dismiss(toastId);
            resolve(true);
          },
        },
        onDismiss: () => {
          if (settled) return;
          settled = true;
          resolve(false);
        },
        onAutoClose: () => {
          if (settled) return;
          settled = true;
          resolve(false);
        },
      });
    });
  }

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/auth/session/list", {
        cache: "no-store",
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        setSessions(Array.isArray(data.data) ? data.data : []);
      } else {
        setSessions([]);
      }
    } catch (error) {
      console.error("Sessions load failed:", error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  async function revokeOtherSessions() {
    const confirmed = await confirmToast(
      "هل أنت متأكد من إنهاء جميع الجلسات الأخرى؟ سيتم تسجيل خروج كل الأجهزة باستثناء جهازك الحالي.",
    );

    if (!confirmed) return;

    try {
      setActionLoading("others");

      const res = await fetch("/api/auth/session/revoke-others", {
        method: "POST",
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        toast.error(data.message || "تعذر إنهاء الجلسات الأخرى");
        return;
      }

      await load();
      toast.success("تم إنهاء الجلسات الأخرى");
    } catch (error) {
      console.error("Revoke other sessions failed:", error);
      toast.error("حدث خطأ أثناء إنهاء الجلسات الأخرى");
    } finally {
      setActionLoading(null);
    }
  }

  async function revokeSession(sessionId: string) {
    const confirmed = await confirmToast("هل تريد تسجيل الخروج من هذا الجهاز؟");
    if (!confirmed) return;

    try {
      setActionLoading(sessionId);

      const res = await fetch("/api/auth/session/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        toast.error(data.message || "تعذر إنهاء الجلسة");
        return;
      }

      await load();
      toast.success("تم إنهاء الجلسة");
    } catch (error) {
      console.error("Revoke session failed:", error);
      toast.error("حدث خطأ أثناء إنهاء الجلسة");
    } finally {
      setActionLoading(null);
    }
  }

  useEffect(() => {
    load();
  }, []);


  const stats = useMemo(() => {
    const current = sessions.filter((session) => session.isCurrent).length;
    const others = sessions.filter((session) => !session.isCurrent).length;
    const unknownIp = sessions.filter(
      (session) => !session.ipAddress || session.ipAddress === "Unknown",
    ).length;

    const locations = new Set(
      sessions
        .map((session) => getLocation(session))
        .filter((location) => location !== "غير معروف"),
    );

    return {
      total: sessions.length,
      current,
      others,
      unknownIp,
      locations: locations.size,
    };
  }, [sessions]);

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div dir="rtl" className="min-w-0 space-y-4 stagger">
      <PageHeader
        dir="rtl"
        title="الأجهزة والجلسات النشطة"
        description="راقب الأجهزة المتصلة بحسابك، وتحقق من آخر نشاط، وأنهِ أي جلسة غير معروفة لحماية الحساب."
        actions={
          <>
            {/* Ending sessions is destructive, so it is not the gold action. */}
            <PageHeaderAction
              icon={LogOut}
              label={actionLoading === "others" ? "جاري الإنهاء..." : "إنهاء الجلسات الأخرى"}
              onClick={revokeOtherSessions}
              disabled={actionLoading === "others" || stats.others === 0}
            />
            <PageHeaderAction iconOnly icon={RefreshCw} label="تحديث" onClick={load} />
          </>
        }
      />

      <PageStats
        dir="rtl"
        items={[
          { label: "إجمالي الجلسات", value: stats.total, hint: "كل الأجهزة المتصلة", icon: <MonitorSmartphone className="h-4 w-4" />, tone: "teal" },
          { label: "الجلسة الحالية", value: stats.current, hint: "هذا الجهاز", icon: <Laptop className="h-4 w-4" />, tone: "emerald" },
          {
            label: "أجهزة أخرى",
            value: stats.others,
            hint: "جلسات يمكن إنهاؤها",
            icon: <Smartphone className="h-4 w-4" />,
            tone: stats.others > 0 ? "gold" : "slate",
          },
          { label: "مواقع مختلفة", value: stats.locations, hint: "حسب بيانات IP", icon: <MapPin className="h-4 w-4" />, tone: "blue" },
          {
            label: "IP غير معروف",
            value: stats.unknownIp,
            hint: "يحتاج مراجعة",
            hintTone: stats.unknownIp > 0 ? "bad" : "neutral",
            icon: <ShieldAlert className="h-4 w-4" />,
            tone: stats.unknownIp > 0 ? "red" : "slate",
          },
        ]}
      />

      {/* Security Note */}
      {stats.others > 0 && (
        <div
          className="rounded-[24px] border p-4 text-sm font-bold leading-7"
          style={{
            borderColor: "#fbbf24",
            background: "var(--amber-soft)",
            color: "#92400e",
          }}
        >
          يوجد {stats.others} جلسة أخرى نشطة. إذا كنت لا تتعرف على أي جهاز، أنهِ
          الجلسة فورًا وغيّر كلمة المرور.
        </div>
      )}

      {/* Sessions */}
      {sessions.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="💻"
            title="لا توجد جلسات"
            description="لا توجد جلسات نشطة حاليًا."
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div
            className="flex flex-col gap-2 border-b px-5 py-4 md:flex-row md:items-center md:justify-between"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <h2 className="font-black" style={{ color: "var(--text)" }}>
                قائمة الجلسات
              </h2>

              <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
                {sessions.length} جلسة نشطة
              </p>
            </div>

            <span
              className={
                stats.others > 0 ? "badge badge-amber" : "badge badge-green"
              }
            >
              {stats.others > 0 ? "يوجد أجهزة أخرى" : "هذا الجهاز فقط"}
            </span>
          </div>

          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {sessions.map((session) => {
              const risk = getSessionRisk(session);
              const device = parseDevice(session.userAgent);

              return (
                <div
                  key={session.id}
                  className="p-5 transition-all hover:bg-black/[0.02]"
                  style={{
                    background: session.isCurrent
                      ? "var(--green-soft)"
                      : "transparent",
                  }}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl"
                        style={{
                          background: session.isCurrent
                            ? "#fff"
                            : "var(--input-bg)",
                          color: session.isCurrent ? "var(--sidebar)" : "var(--accent-text)",
                        }}
                      >
                        {session.isCurrent ? "🟢" : "🖥️"}
                      </div>

                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className="font-black"
                            style={{ color: "var(--text)" }}
                          >
                            {session.isCurrent ? "الجلسة الحالية" : "جهاز متصل"}
                          </span>

                          {session.isCurrent && (
                            <span className="badge badge-green">Current</span>
                          )}

                          <span className={riskBadge(risk)}>
                            خطورة {riskLabel(risk)}
                          </span>
                        </div>

                        <p
                          className="break-words text-sm font-bold"
                          style={{ color: "var(--text-2)" }}
                        >
                          {device || "جهاز غير معروف"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                          <span
                            className="rounded-full px-3 py-1"
                            style={{
                              background: session.isCurrent
                                ? "#fff"
                                : "var(--input-bg)",
                              color: "var(--text-3)",
                            }}
                          >
                            IP: {session.ipAddress || "Unknown"}
                          </span>

                          <span
                            className="rounded-full px-3 py-1"
                            style={{
                              background: session.isCurrent
                                ? "#fff"
                                : "var(--input-bg)",
                              color: "var(--text-3)",
                            }}
                          >
                            🌍 {getLocation(session)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-[220px] space-y-3 text-sm xl:text-left">
                      <div>
                        <span style={{ color: "var(--text-3)" }}>
                          آخر نشاط:
                        </span>
                        <div
                          className="font-black"
                          style={{ color: "var(--text)" }}
                        >
                          {formatDate(session.lastActivityAt)}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: "var(--text-3)" }}>
                          تسجيل الدخول:
                        </span>
                        <div
                          className="font-black"
                          style={{ color: "var(--text)" }}
                        >
                          {formatDate(session.createdAt)}
                        </div>
                      </div>

                      {!session.isCurrent && (
                        <button
                          type="button"
                          onClick={() => revokeSession(session.id)}
                          disabled={actionLoading === session.id}
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionLoading === session.id
                            ? "جاري الإنهاء..."
                            : "تسجيل الخروج من هذا الجهاز"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
