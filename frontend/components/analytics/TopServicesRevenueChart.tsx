"use client";

/**
 * Analytics Dashboard horizontal bar chart ranking services by revenue.
 * Data comes from the same GET /analytics/top-services endpoint as
 * `TopServicesChart` (via `api.getTopServices`), but re-sorted client-side
 * by `revenue_cents` since the backend returns it pre-sorted by booking
 * count instead.
 */

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { BRAND } from "@/lib/chartColors";

/**
 * Fetches and renders the top services as a horizontal bar chart, ordered
 * by revenue.
 *
 * Note: this intentionally shares its TanStack Query `queryKey` (["analytics",
 * "top-services"]) and `queryFn` (api.getTopServices) with `TopServicesChart`,
 * which renders the same underlying data ordered by booking count instead.
 * TanStack Query dedupes identical in-flight/cached queries by key, so both
 * charts rendering on the same page does not cause a duplicate fetch — only
 * the client-side sort/shape below differs per component.
 */
export function TopServicesRevenueChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "top-services"],
    queryFn: api.getTopServices,
  });

  if (isLoading) return <p className="text-brand-bg/70">Loading top services…</p>;
  if (!data || data.length === 0) return <p className="text-brand-bg/70">No service data yet.</p>;

  // The shared endpoint returns data pre-sorted by booking_count, so
  // re-sort by revenue_cents (highest first) for this view, and convert
  // cents to dollars for display.
  const chartData = [...data]
    .sort((a, b) => b.revenue_cents - a.revenue_cents)
    .map((item) => ({ service_name: item.service_name, revenue: item.revenue_cents / 100 }));

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <h2 className="mb-4 font-medium text-brand-dark">Top Services by Revenue</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          {/*
            `(v) => ... (v as number)` instead of a typed `(v: number) =>
            ...` param is deliberate: Recharts' TS types for
            tickFormatter/Tooltip's formatter accept a wider union
            (including `undefined`), so a plain `number` param won't
            compile. The cast inside the body is the correct fix — safe
            here since this chart's data is always numeric.
          */}
          <XAxis type="number" tickFormatter={(v) => `$${(v as number).toLocaleString()}`} />
          <YAxis type="category" dataKey="service_name" width={140} />
          <Tooltip formatter={(v) => `$${(v as number).toLocaleString()}`} />
          <Bar dataKey="revenue" name="Revenue" fill={BRAND.navyTeal} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
