import assert from "node:assert/strict";
import test from "node:test";
import {
  REPORT_EXPORT_LIMIT,
  REPORT_PREVIEW_LIMIT,
  REPORT_SUMMARY_SCAN_LIMIT,
  exceedsReportLimit,
  getReportDetailQueryLimit,
} from "../../src/lib/report-limits";

test("report previews stay small and exports fetch only one overflow row", () => {
  assert.equal(getReportDetailQueryLimit("preview"), REPORT_PREVIEW_LIMIT);
  assert.equal(getReportDetailQueryLimit("all"), REPORT_EXPORT_LIMIT + 1);
});

test("report limits allow the boundary and reject the first excess row", () => {
  assert.equal(exceedsReportLimit(REPORT_EXPORT_LIMIT, REPORT_EXPORT_LIMIT), false);
  assert.equal(
    exceedsReportLimit(REPORT_EXPORT_LIMIT + 1, REPORT_EXPORT_LIMIT),
    true,
  );
  assert.equal(
    exceedsReportLimit(REPORT_SUMMARY_SCAN_LIMIT + 1, REPORT_SUMMARY_SCAN_LIMIT),
    true,
  );
});
