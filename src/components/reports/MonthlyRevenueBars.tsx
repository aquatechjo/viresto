import { formatJOD } from "@/lib/money";
import { revenueBarHeightPercent } from "@/lib/report-finance";

/**
 * The monthly revenue bar chart of the finance reports page.
 *
 * Each column is the chart's full height and each bar is positioned
 * absolutely at the bottom of its own area, so its percentage height
 * resolves against a real height. (Before 2026-11-13 the bar sat in an
 * auto-height column, where a percentage height computes to 0, and the
 * chart drew no bars at all.)
 */
export default function MonthlyRevenueBars({
  items,
  monthNames,
  highlightMonth,
}: {
  items: { month: number; revenue: number }[];
  /** 12 names, January first. */
  monthNames: readonly string[];
  /** 0-11: drawn fully opaque, the others lighter. */
  highlightMonth: number;
}) {
  const maxRevenue = Math.max(...items.map((item) => item.revenue), 1);

  return (
    <div className="flex h-44 gap-2" data-revenue-chart>
      {items.map((item) => (
        <div key={item.month} className="flex h-full flex-1 flex-col items-center gap-2">
          <div className="relative w-full min-h-0 flex-1" data-revenue-bar-area>
            <div
              title={`${monthNames[item.month]}: ${formatJOD(item.revenue)}`}
              className="absolute inset-x-0 bottom-0 rounded-t-xl"
              data-revenue-bar
              style={{
                height: `${revenueBarHeightPercent(item.revenue, maxRevenue)}%`,
                background: "var(--accent-fill)",
                opacity: item.month === highlightMonth ? 1 : 0.55,
              }}
            />
          </div>

          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
            {monthNames[item.month].slice(0, 3)}
          </span>
        </div>
      ))}
    </div>
  );
}
