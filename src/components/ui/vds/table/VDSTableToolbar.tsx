import type { ReactNode } from "react";

interface VDSTableToolbarProps {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function VDSTableToolbar({
  search,
  filters,
  actions,
  className = "",
}: VDSTableToolbarProps) {
  return (
    <div
      className={`flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between ${className}`}
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {search ? <div className="min-w-0 sm:max-w-sm sm:flex-1">{search}</div> : null}
        {filters ? <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
