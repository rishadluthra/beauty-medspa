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

  if (isLoading) return <p className="text-slate-500">Loading top services…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No service data yet.</p>;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Top Services by Bookings</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="service_name" width={140} />
          <Tooltip />
          <Bar dataKey="booking_count" fill="#0f766e" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
