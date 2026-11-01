"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";
import { X } from "lucide-react";
import { vds } from "@/components/ui/vds";

// The filter card under a page's figures. Controls are as tall as the
// header buttons (h-9); the clear button appears only while a filter is on.

const CONTROL =
  "h-9 rounded-xl border text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/40";

interface FilterBarProps {
  children: ReactNode;
  dir: "rtl" | "ltr";
  /** True while any filter differs from its default. */
  active?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  /** Extra rows under the controls, e.g. chips. */
  footer?: ReactNode;
  className?: string;
}

export default function FilterBar({
  children,
  dir,
  active = false,
  onClear,
  clearLabel,
  footer,
  className = "",
}: FilterBarProps) {
  return (
    <div
      dir={dir}
      className={`min-w-0 border p-3 ${className}`}
      style={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: vds.radius.surface }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {children}
        {active && onClear && clearLabel && (
          <button
            type="button"
            onClick={onClear}
            className={`${CONTROL} inline-flex shrink-0 items-center gap-1.5 px-3`}
            style={{ background: "var(--card-2)", borderColor: "var(--border)", color: "var(--text-2)" }}
          >
            <X className="h-3.5 w-3.5" />
            {clearLabel}
          </button>
        )}
      </div>
      {footer && <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">{footer}</div>}
    </div>
  );
}

export function FilterSelect({
  className = "",
  dir,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { dir: "rtl" | "ltr" }) {
  return (
    <select
      dir={dir}
      {...props}
      className={`${CONTROL} w-full min-w-0 cursor-pointer px-3 text-start sm:w-auto sm:min-w-[170px] sm:max-w-[260px] ${className}`}
      style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text)" }}
    >
      {children}
    </select>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${CONTROL} inline-flex shrink-0 items-center gap-1.5 px-3`}
      style={
        active
          ? { background: "rgba(184,115,51,0.16)", borderColor: "rgba(184,115,51,0.4)", color: "var(--text)" }
          : { background: "var(--card-2)", borderColor: "var(--border)", color: "var(--text-2)" }
      }
    >
      {children}
    </button>
  );
}
