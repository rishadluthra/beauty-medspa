"use client";

/**
 * Analytics Dashboard horizontal bar chart showing appointment count per
 * provider (i.e. how busy each staff member is). Data comes from
 * GET /analytics/provider-utilization via `api.getProviderUtilization`.
 */

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { BRAND } from "@/lib/chartColors";

/** Fetches and renders provider appointment counts as a horizontal bar chart. */
export function ProviderUtilizationChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "provider-utilization"],
    queryFn: api.getProviderUtilization,
  });

  if (isLoading) return <p className="text-brand-sage">Loading provider utilization…</p>;
  if (!data || data.length === 0) return <p className="text-brand-sage">No provider data yet.</p>;

  return (
    <div className="rounded-2xl border border-brand-dark/10 bg-white p-5 shadow-md">
      <h2 className="mb-4 font-medium text-brand-dark">Provider Utilization</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="provider_name" width={140} />
          <Tooltip />
          <Bar dataKey="appointment_count" fill={BRAND.sage} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
