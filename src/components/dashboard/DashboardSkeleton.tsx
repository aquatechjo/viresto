"use client";

import { SkeletonCard } from "@/components/motion/SkeletonCard";

type DashboardSkeletonProps = {
  isRtl: boolean;
};

export default function DashboardSkeleton({ isRtl }: DashboardSkeletonProps) {
  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-5"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div
        className="min-h-[170px] animate-pulse rounded-[24px] border p-5"
        style={{
          background:
            "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 58%, var(--sidebar-dark) 100%)",
          borderColor: "rgba(255,255,255,0.12)",
        }}
      >
        <div className="h-6 w-32 rounded-full bg-white/15" />
        <div className="mt-5 h-8 w-2/5 rounded-xl bg-white/15" />
        <div className="mt-3 h-4 w-3/5 rounded-full bg-white/10" />
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-11 rounded-2xl border border-white/10 bg-white/10"
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} lines={2} />
        ))}
      </div>

      <SkeletonCard lines={2} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
        <div className="space-y-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}
