"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ScaleIn } from "@/components/motion";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  actionLabel?: string;
  href?: string;
}

export default function EmptyState({ icon, title, actionLabel, href }: EmptyStateProps) {
  return (
    <ScaleIn>
      <div
        className="flex min-h-[122px] flex-col items-center justify-center rounded-2xl border border-dashed p-4 text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700 dark:bg-teal-300/10 dark:text-teal-200">
          {icon}
        </div>
        <p className="mt-2.5 text-sm font-bold" style={{ color: "var(--text-2)" }}>
          {title}
        </p>
        {href && actionLabel && (
          <Link
            href={href}
            className="mt-2.5 rounded-xl px-3 py-2 text-xs font-black transition hover:brightness-105"
            style={{ background: "var(--green-soft)", color: "var(--sidebar)" }}
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </ScaleIn>
  );
}
