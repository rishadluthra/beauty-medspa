"use client";

/**
 * Analytics Dashboard line chart showing total revenue per time period
 * (e.g. per month). Data comes from GET /analytics/revenue-over-time via
 * `api.getRevenueOverTime`, which returns `revenue_cents` (integer cents,
 * per the app-wide money convention) — converted to dollars here for
 * charting/display.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { estimateAxisWidth, formatPeriodTick, periodAxisInterval } from "@/lib/chartAxis";
import { BRAND } from "@/lib/chartColors";

/** Fetches and renders revenue-over-time as a line chart, in dollars. */
export function RevenueChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "revenue-over-time"],
    queryFn: api.getRevenueOverTime,
  });

  // Tracks the chart's actual rendered width (see `periodAxisInterval`) so the x-axis
  // shows as many "Mon 'YY" ticks as will really fit -- a mobile-width chart needs far
  // fewer than a desktop one, not a fixed count. Depends on `data`, not `[]`: this
  // component returns early (a plain "Loading…" <p>, no ref'd div at all) while
  // `isLoading` is true, so an empty-deps effect would run its one and only time
  // against a `containerRef.current` that's still null -- the observer would never
  // attach, and `chartWidth` would silently stay 0 forever (confirmed live: every
  // render logged `chartWidth: 0`, forcing the narrowest possible tick count even on a
  // full-width desktop chart). Re-running once `data` actually arrives -- the same
  // render that finally includes the ref'd div -- lets the ref attach for real.
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => setChartWidth(entries[0].contentRect.width));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [data]);

  if (isLoading) return <p className="text-brand-bg/70">Loading revenue trend…</p>;
  if (!data || data.length === 0) return <p className="text-brand-bg/70">No revenue data yet.</p>;

  // Convert integer cents (backend convention) to dollars for display.
  const chartData = data.map((point) => ({ period: point.period, revenue: point.revenue_cents / 100 }));

  // Recharts auto-generates "nice" round tick values ABOVE the actual data
  // max (e.g. a real max of $438,000 gets a $600,000 top tick) -- but that
  // rounding-up essentially never adds an extra digit, so estimating from
  // the real max value's formatted length is still an accurate proxy for
  // the widest tick label Recharts will actually render.
  const maxRevenue = Math.max(...chartData.map((point) => point.revenue));
  const yAxisWidth = estimateAxisWidth([`$${Math.round(maxRevenue).toLocaleString()}`]);

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <h2 className="mb-4 font-medium text-brand-dark">Revenue Over Time</h2>
      <div ref={containerRef}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              tickMargin={8}
              tickFormatter={formatPeriodTick}
              interval={periodAxisInterval(chartData.length, chartWidth)}
            />
            {/*
              `(v) => ... (v as number)` rather than `(v: number) => ...` is
              deliberate, not a typo: Recharts' TS types for tickFormatter /
              Tooltip's formatter accept a broader union (including
              `undefined`), so a plain `number`-typed parameter fails to
              compile against those types. Casting inside the function body
              is the fix — safe here since this chart's own data is always
              numeric.

              `width={yAxisWidth}` is computed from the real data (see
              above), not a fixed guess -- a fixed 72px guess here still
              clipped the "$" off "$600,000" in production once real revenue
              data pushed past what that guess assumed.
            */}
            <YAxis width={yAxisWidth} tickMargin={8} tickFormatter={(v) => `$${(v as number).toLocaleString()}`} />
            <Tooltip formatter={(v) => `$${(v as number).toLocaleString()}`} />
            <Line type="monotone" dataKey="revenue" name="Revenue" stroke={BRAND.navyTeal} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
