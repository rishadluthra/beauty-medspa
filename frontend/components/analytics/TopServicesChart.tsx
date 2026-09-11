"use client";

/**
 * Analytics Dashboard horizontal bar chart ranking services by booking
 * count. Data comes from GET /analytics/top-services via
 * `api.getTopServices`, which the backend returns pre-sorted by booking
 * count (this component charts it as-is). See `TopServicesRevenueChart`
 * for the companion view of the same data, sorted by revenue instead.
 */

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { estimateAxisWidth, LEFT_ALIGNED_CATEGORY_TICK } from "@/lib/chartAxis";
import { BRAND } from "@/lib/chartColors";

/**
 * Fetches and renders the top services as a horizontal bar chart, ordered
 * by number of bookings.
 *
 * Note: this shares its TanStack Query `queryKey` (["analytics",
 * "top-services"]) and `queryFn` (api.getTopServices) with
 * `TopServicesRevenueChart`, even though the two components render
 * different views of the same underlying data (bookings vs. revenue).
 * That's intentional — TanStack Query dedupes identical in-flight/cached
 * queries by key, so rendering both charts on the same page does not
 * trigger a duplicate network request.
 */
export function TopServicesChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "top-services"],
    queryFn: api.getTopServices,
  });

  if (isLoading) return <p className="text-brand-bg/70">Loading top services…</p>;
  if (!data || data.length === 0) return <p className="text-brand-bg/70">No service data yet.</p>;

  // Both computed from the real data, not fixed guesses -- a fixed 140px
  // category width clipped the leading "R" off "RF Skin Tightening" in
  // production, and a fixed height left too little room per row once
  // there were more than a handful of services, silently hiding every
  // other Y-axis label (see `interval` below).
  const yAxisWidth = estimateAxisWidth(data.map((entry) => entry.service_name));
  const height = Math.max(240, data.length * 40 + 48);

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <h2 className="mb-4 text-center font-medium text-brand-dark">Top Services by Bookings</h2>
      <ResponsiveContainer width="100%" height={height}>
        {/*
          No extra `margin.left` here -- `YAxis width={yAxisWidth}` already
          reserves the space its own category labels need, and stacking a
          separate left margin on top of that double-counted the gutter,
          pushing the bars themselves too far right.
        */}
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickMargin={8} allowDecimals={false} />
          {/*
            `interval={0}` forces EVERY category tick to render -- Recharts'
            default tick interval was silently skipping every other service
            name once there were enough of them to risk overlapping.

            `tick={LEFT_ALIGNED_CATEGORY_TICK}` left-aligns every label to
            a shared left edge instead of Recharts' default right-aligned
            (ragged-left) placement -- see the constant's own doc comment
            for why that default was also the actual cause of the "RF Skin
            Tightening" clipping in production.
          */}
          <YAxis type="category" dataKey="service_name" width={yAxisWidth} interval={0} tick={LEFT_ALIGNED_CATEGORY_TICK} />
          <Tooltip />
          <Bar dataKey="booking_count" name="Bookings" fill={BRAND.gold} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
