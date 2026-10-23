"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  FileText,
  LogIn,
  ShieldAlert,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { VDSBadge, vds, type VDSTone } from "@/components/ui/vds";
import type { Locale } from "@/lib/i18n";
import type { DashboardActivity } from "@/lib/dashboard/types";
import DashboardCard, { CompactEmpty } from "./DashboardCard";
import { SECURITY_ACTIVITY_TYPES, getActivityText, normalizeActivityType } from "./activity-text";
import type { DashboardText } from "./dashboard-text";
import { formatRelative } from "./format";

type Style = { icon: ComponentType<{ className?: string }>; tone: VDSTone };

function activityStyle(type: string): Style {
  if (SECURITY_ACTIVITY_TYPES.has(type)) return { icon: ShieldAlert, tone: "red" };
  if (type === "LOGIN_SUCCESS") return { icon: LogIn, tone: "slate" };
  if (type.startsWith("CASE_")) return { icon: BriefcaseBusiness, tone: "teal" };
  if (type.startsWith("CLIENT_")) return { icon: UserRound, tone: "blue" };
  if (type.startsWith("APPOINTMENT_")) return { icon: CalendarDays, tone: "gold" };
  if (type.startsWith("PAYMENT_") || type.startsWith("INVOICE_")) return { icon: CircleDollarSign, tone: "emerald" };
  if (type.startsWith("DOCUMENT_")) return { icon: FileText, tone: "cyan" };
  if (type.startsWith("USER_")) return { icon: Users, tone: "blue" };
  if (type.startsWith("AI_")) return { icon: Sparkles, tone: "purple" };
  return { icon: Activity, tone: "slate" };
}

interface ActivityFeedProps {
  activities: DashboardActivity[];
  locale: Locale;
  isRtl: boolean;
  nowIso: string;
  t: DashboardText;
}

export default function ActivityFeed({ activities, locale, isRtl, nowIso, t }: ActivityFeedProps) {
  return (
    <DashboardCard
      title={t.activity}
      icon={<Activity className="h-4 w-4" />}
      tone="purple"
      isRtl={isRtl}
      href="/dashboard/activity"
      linkLabel={t.viewAll}
    >
      {activities.length === 0 ? (
        <CompactEmpty icon={<Activity className="h-6 w-6" />} title={t.activityEmpty} />
      ) : (
        <ul className="min-w-0 divide-y" style={{ borderColor: "var(--border)" }}>
          {activities.map((activity) => {
            const type = normalizeActivityType(activity);
            const text = getActivityText(activity, locale);
            const style = activityStyle(type);
            const tone = vds.tone[style.tone];
            const Icon = style.icon;
            const isSecurity = SECURITY_ACTIVITY_TYPES.has(type);

            return (
              <li key={activity.id} className="flex min-h-[48px] min-w-0 items-center gap-3 py-1.5" style={{ borderColor: "var(--border)" }}>
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                  style={{ color: tone.fg, background: tone.soft, borderColor: tone.border }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2">
                    <bdi className="truncate text-[13px] font-bold" style={{ color: "var(--text)" }}>{text.title}</bdi>
                    {isSecurity && <VDSBadge tone="red" className="shrink-0">{t.security}</VDSBadge>}
                  </p>
                  {text.message && (
                    <p className="truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                      <bdi>{text.message}</bdi>
                    </p>
                  )}
                </div>
                <Link
                  href="/dashboard/activity"
                  className="shrink-0 text-[11px] font-semibold hover:underline"
                  style={{ color: "var(--text-3)" }}
                >
                  <time dateTime={activity.createdAt}>
                    <bdi>{formatRelative(activity.createdAt, nowIso, locale)}</bdi>
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
