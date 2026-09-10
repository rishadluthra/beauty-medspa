"use client";

import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";

export function RevenueChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "revenue-over-time"],
    queryFn: api.getRevenueOverTime,
  });

  if (isLoading) return <p className="text-slate-500">Loading revenue trend…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No revenue data yet.</p>;

  const chartData = data.map((point) => ({ period: point.period, revenue: point.revenue_cents / 100 }));

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Revenue Over Time</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis tickFormatter={(v) => `$${(v as number).toLocaleString()}`} />
          <Tooltip formatter={(v) => `$${(v as number).toLocaleString()}`} />
          <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
