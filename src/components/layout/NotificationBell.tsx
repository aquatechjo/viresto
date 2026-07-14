"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useLocale } from "@/lib/useLocale";

type NotificationItem = {
  id: string;
  type: string;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_ICON: Record<string, string> = {
  INFO: "ℹ️",
  SUCCESS: "✅",
  WARNING: "⚠️",
  ERROR: "⛔",
  BILLING: "💳",
  APPOINTMENT: "📅",
  CASE: "⚖️",
  DOCUMENT: "📄",
  INVOICE: "🧾",
  PAYMENT: "💰",
  TASK: "✅",
  SYSTEM: "🔔",
};

function formatDate(value: string, locale: "ar" | "en") {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-US", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const { locale, isRtl } = useLocale();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const ref = useRef<HTMLDivElement>(null);

  const copy = isRtl
    ? {
        title: "التنبيهات",
        empty: "لا توجد تنبيهات حاليًا",
        markAll: "تعليم الكل كمقروء",
        loading: "جاري تحميل التنبيهات...",
        unread: "غير مقروء",
        error: "تعذر تحميل التنبيهات",
      }
    : {
        title: "Notifications",
        empty: "No notifications yet",
        markAll: "Mark all as read",
        loading: "Loading notifications...",
        unread: "Unread",
        error: "Could not load notifications",
      };

  const loadNotifications = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
      });

      const json = await response.json();

      if (json?.success) {
        setNotifications(
          Array.isArray(json.data?.notifications)
            ? json.data.notifications
            : [],
        );
        setUnreadCount(Number(json.data?.unreadCount ?? 0));
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const interval = window.setInterval(() => {
      loadNotifications();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAllAsRead() {
    if (unreadCount === 0) return;

    const readAt = new Date().toISOString();

    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? readAt,
      })),
    );
    setUnreadCount(0);

    try {
      await fetch("/api/notifications/read-all", {
        method: "PATCH",
      });
    } catch {
      loadNotifications();
    }
  }

  async function openNotification(notification: NotificationItem) {
    if (!notification.readAt) {
      const readAt = new Date().toISOString();

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, readAt } : item,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await fetch(`/api/notifications/${notification.id}/read`, {
          method: "PATCH",
        });
      } catch {
        loadNotifications();
      }
    }

    if (notification.href) {
      router.push(notification.href);
      setOpen(false);
    }
  }

  return (
    <div
      ref={ref}
      className="relative overflow-visible"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <button
        type="button"
        aria-label={copy.title}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) loadNotifications();
        }}
        className="
    relative flex h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-2xl
    border border-amber-400/35 bg-amber-400/10 text-amber-400 shadow-sm
    transition-all hover:border-amber-400/70 hover:bg-amber-400/15 hover:text-amber-300
    dark:border-amber-400/35 dark:bg-amber-400/10 dark:text-amber-300
    dark:hover:border-amber-300/70 dark:hover:bg-amber-400/15
  "
      >
        <Bell className="h-4 w-4 text-amber-400" />

        {unreadCount > 0 && (
          <span
            className="
              absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center
              rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white
              ring-2 ring-white dark:ring-[#082526]
            "
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="
            absolute top-full z-[90] mt-2 w-[calc(100vw-1rem)] max-w-[360px]
            overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl
            dark:border-[#0f3d3e] dark:bg-[#0b292a]
            sm:w-96
          "
          style={{ insetInlineEnd: 0 }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#0f3d3e]">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900 dark:text-emerald-50">
                {copy.title}
              </p>

              {unreadCount > 0 && (
                <p className="mt-0.5 text-xs font-bold text-slate-500 dark:text-emerald-200/80">
                  {unreadCount} {copy.unread}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="
                inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200
                px-3 py-1.5 text-xs font-black text-slate-700 transition
                hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed
                disabled:opacity-45 dark:border-emerald-700/60 dark:text-emerald-100
                dark:hover:border-emerald-500
              "
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {copy.markAll}
            </button>
          </div>

          <div className="max-h-[64vh] overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm font-bold text-slate-500 dark:text-emerald-100/75">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.loading}
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm font-bold text-slate-500 dark:text-emerald-100/75">
                {copy.empty}
              </p>
            )}

            {notifications.map((notification) => {
              const unread = !notification.readAt;
              const title =
                locale === "ar" ? notification.titleAr : notification.titleEn;
              const message =
                locale === "ar"
                  ? notification.messageAr
                  : notification.messageEn;

              return (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className="
                    flex w-full min-w-0 gap-3 border-b border-slate-100 px-4 py-3 text-start
                    transition hover:bg-slate-50 dark:border-[#0f3d3e]/70 dark:hover:bg-[#123f40]
                  "
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm dark:bg-[#082c2d]">
                    {TYPE_ICON[notification.type] ?? "🔔"}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-black text-slate-900 dark:text-emerald-50">
                        {title}
                      </span>

                      {unread && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      )}
                    </span>

                    <span className="mt-1 line-clamp-2 block text-xs font-bold leading-5 text-slate-500 dark:text-emerald-100/75">
                      {message}
                    </span>

                    <span className="mt-2 block text-[11px] font-bold text-slate-400 dark:text-emerald-200/60">
                      {formatDate(notification.createdAt, locale)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
