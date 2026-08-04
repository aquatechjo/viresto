"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import VDSCard from "../VDSCard";
import VDSBulkActions from "./VDSBulkActions";
import VDSPagination from "./VDSPagination";
import VDSTableEmpty from "./VDSTableEmpty";
import VDSTableSkeleton from "./VDSTableSkeleton";
import VDSTableToolbar from "./VDSTableToolbar";
import type {
  VDSDataTableColumn,
  VDSDataTableLabels,
  VDSRowId,
  VDSSortDirection,
} from "./types";

interface VDSDataTableProps<T> {
  rows: T[];
  columns: VDSDataTableColumn<T>[];
  getRowId: (row: T) => VDSRowId;
  loading?: boolean;
  toolbar?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  search?: ReactNode;
  emptyAction?: ReactNode;
  selectable?: boolean;
  selectedIds?: Set<VDSRowId>;
  onSelectionChange?: (ids: Set<VDSRowId>) => void;
  bulkActions?: ReactNode;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  labels?: VDSDataTableLabels;
  isRtl?: boolean;
  onRowClick?: (row: T) => void;
  onRowIntent?: (row: T) => void;
  className?: string;
}

export default function VDSDataTable<T>({
  rows,
  columns,
  getRowId,
  loading = false,
  toolbar,
  filters,
  actions,
  search,
  emptyAction,
  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  bulkActions,
  page = 1,
  totalPages = 1,
  onPageChange,
  labels = {},
  isRtl = false,
  onRowClick,
  onRowIntent,
  className = "",
}: VDSDataTableProps<T>) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<VDSRowId>>(
    new Set(),
  );
  const [sort, setSort] = useState<{
    columnId: string;
    direction: VDSSortDirection;
  } | null>(null);

  const selectedIds = controlledSelectedIds ?? internalSelectedIds;

  const updateSelection = (next: Set<VDSRowId>) => {
    if (!controlledSelectedIds) setInternalSelectedIds(next);
    onSelectionChange?.(next);
  };

  const visibleIds = useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((candidate) => candidate.id === sort.columnId);
    if (!column?.accessor) return rows;

    return [...rows].sort((a, b) => {
      const first = a[column.accessor!];
      const second = b[column.accessor!];
      const compared = String(first ?? "").localeCompare(
        String(second ?? ""),
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        },
      );
      return sort.direction === "asc" ? compared : -compared;
    });
  }, [rows, columns, sort]);

  const toggleAllVisible = () => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    updateSelection(next);
  };

  const toggleRow = (rowId: VDSRowId) => {
    const next = new Set(selectedIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    updateSelection(next);
  };

  const toggleSort = (column: VDSDataTableColumn<T>) => {
    if (!column.sortable) return;
    setSort((current) => {
      if (!current || current.columnId !== column.id) {
        return { columnId: column.id, direction: "asc" };
      }
      return {
        columnId: column.id,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  };

  return (
    <VDSCard padded={false} className={`overflow-hidden ${className}`}>
      {toolbar ??
        (search || filters || actions ? (
          <VDSTableToolbar
            search={search}
            filters={filters}
            actions={actions}
          />
        ) : null)}

      {selectable ? (
        <VDSBulkActions
          count={selectedIds.size}
          label={labels.selectedLabel}
          onClear={() => updateSelection(new Set())}
          clearLabel={labels.clearSelection}
        >
          {bulkActions}
        </VDSBulkActions>
      ) : null}

      {loading ? (
        <VDSTableSkeleton rows={5} columns={Math.max(columns.length, 1)} />
      ) : rows.length === 0 ? (
        <VDSTableEmpty
          title={labels.emptyTitle}
          description={labels.emptyDescription}
          action={emptyAction}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead
              style={{ background: "var(--surface-2, rgba(148,163,184,.08))" }}
            >
              <tr>
                {selectable ? (
                  <th className="w-12 px-4 py-3 text-start">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible rows"
                      className="h-4 w-4 rounded"
                    />
                  </th>
                ) : null}

                {columns.map((column) => {
                  const activeSort = sort?.columnId === column.id;
                  const SortIcon = !activeSort
                    ? ChevronsUpDown
                    : sort.direction === "asc"
                      ? ArrowUp
                      : ArrowDown;

                  return (
                    <th
                      key={column.id}
                      className={[
                        "border-b px-4 py-3 text-xs font-black uppercase tracking-wide",
                        column.align === "center"
                          ? "text-center"
                          : column.align === "end"
                            ? "text-end"
                            : "text-start",
                        column.hideOnMobile ? "hidden md:table-cell" : "",
                      ].join(" ")}
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-3)",
                        width: column.width,
                      }}
                    >
                      <button
                        type="button"
                        disabled={!column.sortable}
                        onClick={() => toggleSort(column)}
                        className="inline-flex items-center gap-1.5 disabled:cursor-default"
                      >
                        <span>{column.header}</span>
                        {column.sortable ? (
                          <SortIcon
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((row) => {
                const rowId = getRowId(row);
                const selected = selectedIds.has(rowId);

                return (
                  <tr
                    key={rowId}
                    onClick={() => onRowClick?.(row)}
                    onPointerEnter={() => onRowIntent?.(row)}
                    className={[
                      "border-b transition-colors last:border-b-0",
                      onRowClick
                        ? "cursor-pointer hover:bg-black/[.025] dark:hover:bg-white/[.035]"
                        : "",
                    ].join(" ")}
                    style={{
                      borderColor: "var(--border)",
                      background: selected ? "rgba(20,184,166,.07)" : undefined,
                    }}
                  >
                    {selectable ? (
                      <td
                        className="w-12 px-4 py-4"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRow(rowId)}
                          aria-label={`Select row ${String(rowId)}`}
                          className="h-4 w-4 rounded"
                        />
                      </td>
                    ) : null}

                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={[
                          "px-4 py-4 text-sm",
                          column.align === "center"
                            ? "text-center"
                            : column.align === "end"
                              ? "text-end"
                              : "text-start",
                          column.hideOnMobile ? "hidden md:table-cell" : "",
                        ].join(" ")}
                        style={{ color: "var(--text)" }}
                      >
                        {column.cell
                          ? column.cell(row)
                          : column.accessor
                            ? String(row[column.accessor] ?? "")
                            : null}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {onPageChange ? (
        <VDSPagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          previousLabel={labels.previousPage}
          nextLabel={labels.nextPage}
          pageLabel={labels.pageLabel}
          isRtl={isRtl}
        />
      ) : null}
    </VDSCard>
  );
}
