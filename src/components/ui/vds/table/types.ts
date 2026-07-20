import type { ReactNode } from "react";

export type VDSRowId = string | number;
export type VDSSortDirection = "asc" | "desc";

export interface VDSDataTableColumn<T> {
  id: string;
  header: ReactNode;
  accessor?: keyof T;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "start" | "center" | "end";
  width?: string;
  hideOnMobile?: boolean;
}

export interface VDSDataTableLabels {
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  selectedLabel?: (count: number) => string;
  previousPage?: string;
  nextPage?: string;
  pageLabel?: (page: number, totalPages: number) => string;
  clearSelection?: string;
}
