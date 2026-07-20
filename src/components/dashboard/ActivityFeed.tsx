"use client";

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
import { VDSBadge, VDSCard, VDSIcon, VDSSectionHeader, VDSTimeline, VDSTimelineItem, type VDSTone } from "@/components/ui/vds";

export interface ActivityViewItem {
  id: string;
  icon: string;
  color: string;
  title: string;
  message?: string;
  createdAtLabel: string;
  createdAtFullLabel: string;
  href?: string;
  isSecurity?: boolean;
}

interface ActivityFeedProps {
  activities: ActivityViewItem[];
  isRtl: boolean;
  labels: {
    title: string;
    subtitle: string;
    viewAll: string;
    empty: string;
    security: string;
  };
}

const ICON_MAP = {
  "👤": UserRound,
  "⚖️": BriefcaseBusiness,
  "📅": CalendarDays,
  "💰": CircleDollarSign,
  "📄": FileText,
  "👥": Users,
  "✨": Sparkles,
  "📝": FileText,
  "📖": FileText,
} as const;

function resolveActivityIcon(activity: ActivityViewItem) {
  if (activity.isSecurity) return ShieldAlert;
  if (/login|دخول/i.test(activity.title)) return LogIn;
  return ICON_MAP[activity.icon as keyof typeof ICON_MAP] ?? Activity;
}

function resolveTone(activity: ActivityViewItem): VDSTone {
  if (activity.isSecurity) return "red";
  if (activity.icon === "⚖️") return "teal";
  if (["📄", "📝", "📖"].includes(activity.icon)) return "cyan";
  if (activity.icon === "💰") return "gold";
  if (activity.icon === "✨") return "purple";
  if (activity.icon === "👥" || activity.icon === "👤") return "blue";
  return "slate";
}

export default function ActivityFeed({ activities, isRtl, labels }: ActivityFeedProps) {
  return (
    <VDSCard className="overflow-hidden">
      <VDSSectionHeader
        title={labels.title}
        subtitle={labels.subtitle}
        href="/dashboard/activity"
        linkLabel={labels.viewAll}
        isRtl={isRtl}
        icon={<Activity className="h-4 w-4" />}
        tone="purple"
      />

      {activities.length === 0 ? (
        <div className="flex min-h-[132px] items-center justify-center rounded-[20px] border border-dashed p-5 text-center" style={{ borderColor: "var(--border)" }}>
          <div>
            <VDSIcon tone="purple" size="md"><Activity className="h-5 w-5" /></VDSIcon>
            <p className="mt-3 text-sm font-black" style={{ color: "var(--text-2)" }}>{labels.empty}</p>
          </div>
        </div>
      ) : (
        <VDSTimeline>
          {activities.map((activity, index) => {
            const Icon = resolveActivityIcon(activity);
            const tone = resolveTone(activity);
            return (
              <VDSTimelineItem key={activity.id} isLast={index === activities.length - 1}>
                <Link
                  href={activity.href ?? "/dashboard/activity"}
                  className="group relative flex min-w-0 items-start gap-3 overflow-hidden rounded-[20px] border p-3.5 transition duration-200 hover:-translate-y-0.5"
                  style={{
                    borderColor: activity.isSecurity ? "rgba(239,68,68,.24)" : "var(--border)",
                    background: activity.isSecurity ? "rgba(239,68,68,.04)" : "var(--card)",
                  }}
                >
                  <span className="absolute inset-y-3 w-1 rounded-full opacity-80" style={{ insetInlineStart: 0, background: activity.isSecurity ? "#dc2626" : "var(--sidebar)" }} />
                  <VDSIcon tone={tone} size="lg"><Icon className="h-5 w-5" /></VDSIcon>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="line-clamp-2 text-sm font-black" style={{ color: "var(--text)" }}>{activity.title}</p>
                          {activity.isSecurity && <VDSBadge tone="red"><ShieldAlert className="h-3 w-3" />{labels.security}</VDSBadge>}
                        </div>
                      </div>
                      <time dateTime={activity.createdAtFullLabel} title={activity.createdAtFullLabel} className="shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold" style={{ color: "var(--text-3)", background: "var(--green-soft)" }}>
                        {activity.createdAtLabel}
                      </time>
                    </div>
                    {activity.message && <p className="mt-1.5 line-clamp-2 text-xs leading-5" style={{ color: "var(--text-3)" }}>{activity.message}</p>}
                  </div>
                </Link>
              </VDSTimelineItem>
            );
          })}
        </VDSTimeline>
      )}
    </VDSCard>
  );
}
