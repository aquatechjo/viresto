import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import MonthlyRevenueBars from "../../src/components/reports/MonthlyRevenueBars";
import { MIN_REVENUE_BAR_PERCENT, revenueBarHeightPercent } from "../../src/lib/report-finance";

// The finance page's monthly revenue chart drew no bars: each bar had a
// percentage height inside an auto-height column, which computes to 0.

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

test("bar height: busiest month 100, others in proportion, empty months the minimum", () => {
  assert.equal(revenueBarHeightPercent(400, 400), 100);
  assert.equal(revenueBarHeightPercent(200, 400), 50);
  assert.equal(revenueBarHeightPercent(1, 400), MIN_REVENUE_BAR_PERCENT);
  assert.equal(revenueBarHeightPercent(0, 400), MIN_REVENUE_BAR_PERCENT);
  assert.equal(revenueBarHeightPercent(0, 0), MIN_REVENUE_BAR_PERCENT);
  assert.equal(revenueBarHeightPercent(Number.NaN, 400), MIN_REVENUE_BAR_PERCENT);
  assert.equal(revenueBarHeightPercent(900, 400), 100);
});

test("chart structure: every bar is absolutely positioned in a full-height area", () => {
  const items = MONTHS.map((_, month) => ({ month, revenue: month === 2 ? 400 : month === 3 ? 200 : 0 }));
  const html = renderToStaticMarkup(<MonthlyRevenueBars items={items} monthNames={MONTHS} highlightMonth={2} />);

  // The columns fill the chart's height and the bar area grows inside them,
  // so a percentage height has a definite box to resolve against.
  assert.equal((html.match(/class="flex h-full flex-1 flex-col items-center gap-2"/g) ?? []).length, 12);
  assert.equal((html.match(/class="relative w-full min-h-0 flex-1" data-revenue-bar-area="true"/g) ?? []).length, 12);
  const bars = [...html.matchAll(/class="absolute inset-x-0 bottom-0 rounded-t-xl" data-revenue-bar="true" style="height:(\d+)%/g)].map((m) => Number(m[1]));
  assert.equal(bars.length, 12);
  assert.equal(bars[2], 100);
  assert.equal(bars[3], 50);
  assert.equal(bars[0], MIN_REVENUE_BAR_PERCENT);
  assert.match(html, /title="مارس: 400 د\.أ"/);
});
