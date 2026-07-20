import type { HTMLAttributes, ReactNode } from "react";

type VDSGridColumns = 1 | 2 | 3 | 4;

interface VDSGridProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  columns?: VDSGridColumns;
  compact?: boolean;
}

const columnClasses: Record<VDSGridColumns, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
};

export default function VDSGrid({
  children,
  columns = 2,
  compact = false,
  className = "",
  ...props
}: VDSGridProps) {
  return (
    <div
      className={`grid min-w-0 ${columnClasses[columns]} ${compact ? "gap-3" : "gap-4 xl:gap-5"} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
