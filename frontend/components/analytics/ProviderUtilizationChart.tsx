"use client";

/**
 * Analytics Dashboard horizontal bar chart showing appointment count per
 * provider (i.e. how busy each staff member is). Data comes from
 * GET /analytics/provider-utilization via `api.getProviderUtilization`.
 */

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";

/** Fetches and renders provider appointment counts as a horizontal bar chart. */
export function ProviderUtilizationChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "provider-utilization"],
    queryFn: api.getProviderUtilization,
  });

  if (isLoading) return <p className="text-slate-500">Loading provider utilization…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No provider data yet.</p>;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Provider Utilization</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="provider_name" width={140} />
          <Tooltip />
          <Bar dataKey="appointment_count" fill="#0891b2" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
