import type { ReactNode } from "react";
import VDSButton from "../VDSButton";

interface VDSBulkActionsProps {
  count: number;
  label?: (count: number) => string;
  onClear: () => void;
  clearLabel?: string;
  children?: ReactNode;
}

export default function VDSBulkActions({
  count,
  label = (selectedCount) => `${selectedCount} selected`,
  onClear,
  clearLabel = "Clear",
  children,
}: VDSBulkActionsProps) {
  if (count <= 0) return null;

  return (
    <div
      className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      style={{
        borderColor: "var(--border)",
        background: "rgba(20,184,166,.08)",
      }}
    >
      <strong className="text-sm" style={{ color: "var(--text)" }}>
        {label(count)}
      </strong>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <VDSButton variant="ghost" size="sm" onClick={onClear}>
          {clearLabel}
        </VDSButton>
      </div>
    </div>
  );
}
