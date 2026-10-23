"use client";

import { vds } from "@/components/ui/vds";

type DashboardSkeletonProps = {
  isRtl: boolean;
};

function Block({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse border ${className}`}
      style={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: vds.radius.card }}
    />
  );
}

// The same grid as the loaded dashboard (DashboardClient), so nothing
// jumps when the data arrives.
export default function DashboardSkeleton({ isRtl }: DashboardSkeletonProps) {
  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div
        className="h-[132px] animate-pulse rounded-[24px] border lg:h-[106px]"
        style={{
          background:
            "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 58%, var(--sidebar-dark) 100%)",
          borderColor: "rgba(255,255,255,0.12)",
        }}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Block key={index} className="h-[124px] !rounded-[20px]" />
        ))}
      </div>
      <Block className="h-[124px]" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <Block className="h-[490px] xl:col-span-8" />
        <Block className="h-[490px] xl:col-span-4" />
        <Block className="h-[450px] xl:col-span-8" />
        <Block className="h-[450px] xl:col-span-4" />
        <Block className="h-[445px] xl:col-span-6" />
        <Block className="h-[445px] xl:col-span-6" />
        <Block className="h-[520px] xl:col-span-8" />
        <Block className="h-[520px] xl:col-span-4" />
      </div>
    </div>
  );
}
