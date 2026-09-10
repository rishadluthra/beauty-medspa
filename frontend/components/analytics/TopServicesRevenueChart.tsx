"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";

export function TopServicesRevenueChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "top-services"],
    queryFn: api.getTopServices,
  });

  if (isLoading) return <p className="text-slate-500">Loading top services…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No service data yet.</p>;

  const chartData = [...data]
    .sort((a, b) => b.revenue_cents - a.revenue_cents)
    .map((item) => ({ service_name: item.service_name, revenue: item.revenue_cents / 100 }));

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Top Services by Revenue</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={(v) => `$${(v as number).toLocaleString()}`} />
          <YAxis type="category" dataKey="service_name" width={140} />
          <Tooltip formatter={(v) => `$${(v as number).toLocaleString()}`} />
          <Bar dataKey="revenue" fill="#0891b2" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
