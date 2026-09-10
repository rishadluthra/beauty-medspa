"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";

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
