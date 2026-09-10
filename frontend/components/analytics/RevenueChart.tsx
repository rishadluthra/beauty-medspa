"use client";

/**
 * Analytics Dashboard line chart showing total revenue per time period
 * (e.g. per month). Data comes from GET /analytics/revenue-over-time via
 * `api.getRevenueOverTime`, which returns `revenue_cents` (integer cents,
 * per the app-wide money convention) — converted to dollars here for
 * charting/display.
 */

import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { BRAND } from "@/lib/chartColors";

/** Fetches and renders revenue-over-time as a line chart, in dollars. */
export function RevenueChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "revenue-over-time"],
    queryFn: api.getRevenueOverTime,
  });

  if (isLoading) return <p className="text-brand-bg/70">Loading revenue trend…</p>;
  if (!data || data.length === 0) return <p className="text-brand-bg/70">No revenue data yet.</p>;

  // Convert integer cents (backend convention) to dollars for display.
  const chartData = data.map((point) => ({ period: point.period, revenue: point.revenue_cents / 100 }));

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <h2 className="mb-4 font-medium text-brand-dark">Revenue Over Time</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          {/*
            `(v) => ... (v as number)` rather than `(v: number) => ...` is
            deliberate, not a typo: Recharts' TS types for tickFormatter /
            Tooltip's formatter accept a broader union (including
            `undefined`), so a plain `number`-typed parameter fails to
            compile against those types. Casting inside the function body
            is the fix — safe here since this chart's own data is always
            numeric.
          */}
          <YAxis tickFormatter={(v) => `$${(v as number).toLocaleString()}`} />
          <Tooltip formatter={(v) => `$${(v as number).toLocaleString()}`} />
          <Line type="monotone" dataKey="revenue" stroke={BRAND.navyTeal} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
