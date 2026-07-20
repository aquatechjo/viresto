"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import VDSButton from "../VDSButton";

interface VDSPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  previousLabel?: string;
  nextLabel?: string;
  pageLabel?: (page: number, totalPages: number) => string;
  isRtl?: boolean;
}

export default function VDSPagination({
  page,
  totalPages,
  onPageChange,
  previousLabel = "Previous",
  nextLabel = "Next",
  pageLabel = (current, total) => `Page ${current} of ${total}`,
  isRtl = false,
}: VDSPaginationProps) {
  if (totalPages <= 1) return null;

  const PreviousIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div
      className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: "var(--border)" }}
    >
      <span className="text-sm font-semibold" style={{ color: "var(--text-3)" }}>
        {pageLabel(page, totalPages)}
      </span>

      <div className="flex items-center gap-2">
        <VDSButton
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          leadingIcon={<PreviousIcon className="h-4 w-4" />}
        >
          {previousLabel}
        </VDSButton>

        <VDSButton
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          trailingIcon={<NextIcon className="h-4 w-4" />}
        >
          {nextLabel}
        </VDSButton>
      </div>
    </div>
  );
}
