"use client";

import type { ReactNode } from "react";

export interface ResponsiveTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "start" | "center" | "end";
  /** Hide this column in the mobile stacked-card view (its content is redundant there). */
  mobileHidden?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  emptyMessage: ReactNode;
  onRowClick?: (row: T) => void;
  isRtl?: boolean;
  className?: string;
  tableClassName?: string;
}

function alignClass(align?: "start" | "center" | "end") {
  if (align === "center") return "text-center";
  if (align === "end") return "text-end";
  return "text-start";
}

export default function ResponsiveTable<T>({
  columns,
  rows,
  getRowId,
  emptyMessage,
  onRowClick,
  isRtl = false,
  className = "",
  tableClassName = "data-table",
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className={`py-10 text-center text-sm font-bold ${className}`} style={{ color: "var(--text-3)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Mobile: stacked cards, one per row */}
      <div className="divide-y md:hidden" data-vds-view="mobile-cards" style={{ borderColor: "var(--border)" }}>
        {rows.map((row) => {
          const rowId = getRowId(row);
          const visibleColumns = columns.filter((column) => !column.mobileHidden);

          return (
            <div
              key={rowId}
              onClick={() => onRowClick?.(row)}
              className={`space-y-2.5 p-4 ${onRowClick ? "cursor-pointer active:bg-black/[.02] dark:active:bg-white/[.03]" : ""}`}
            >
              {visibleColumns.map((column) => {
                const value = column.cell(row);
                if (value === null || value === undefined) return null;

                return (
                  <div key={column.id} className="flex min-w-0 items-start justify-between gap-3 text-sm">
                    <span
                      className="shrink-0 whitespace-nowrap text-xs font-black uppercase tracking-wide"
                      style={{ color: "var(--text-3)" }}
                    >
                      {column.header}
                    </span>
                    <span className="min-w-0 flex-1 text-end" style={{ color: "var(--text)" }}>
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Desktop: real table */}
      <div className="hidden overflow-x-auto md:block" data-vds-view="desktop-table">
        <table dir={isRtl ? "rtl" : "ltr"} className={tableClassName}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} className={`whitespace-nowrap ${alignClass(column.align)}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const rowId = getRowId(row);

              return (
                <tr
                  key={rowId}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? "clickable" : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.id} className={alignClass(column.align)}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
