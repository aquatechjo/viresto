"use client";

import { cn } from "@/lib/utils";

type SkeletonCardProps = { className?: string; lines?: number };

export function SkeletonCard({ className, lines = 3 }: SkeletonCardProps) {
  return (
    <div className={cn("card overflow-hidden p-5", className)} aria-hidden="true">
      <div className="h-5 w-2/5 animate-pulse rounded-lg bg-[var(--surface-3)]" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className="h-3 animate-pulse rounded-full bg-[var(--surface-3)]"
            style={{ width: `${Math.max(42, 92 - index * 14)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
