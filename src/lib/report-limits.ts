export type ReportDetailMode = "preview" | "all";

export const REPORT_PREVIEW_LIMIT = 100;
export const REPORT_EXPORT_LIMIT = 5_000;
export const REPORT_SUMMARY_SCAN_LIMIT = 25_000;

export function getReportDetailQueryLimit(mode: ReportDetailMode) {
  const limit =
    mode === "all" ? REPORT_EXPORT_LIMIT : REPORT_PREVIEW_LIMIT;

  // Fetch one extra record so callers can detect overflow without loading the
  // complete result set into application memory.
  return mode === "all" ? limit + 1 : limit;
}

export function exceedsReportLimit(recordCount: number, limit: number) {
  return Number.isFinite(recordCount) && recordCount > limit;
}
