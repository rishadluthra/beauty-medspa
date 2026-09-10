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

/** Fetches and renders revenue-over-time as a line chart, in dollars. */
export function RevenueChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "revenue-over-time"],
    queryFn: api.getRevenueOverTime,
  });

  if (isLoading) return <p className="text-slate-500">Loading revenue trend…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No revenue data yet.</p>;

  // Convert integer cents (backend convention) to dollars for display.
  const chartData = data.map((point) => ({ period: point.period, revenue: point.revenue_cents / 100 }));

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Revenue Over Time</h2>
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
          <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
