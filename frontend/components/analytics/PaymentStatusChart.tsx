"use client";

import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a",
  pending: "#d97706",
  failed: "#dc2626",
};

export function PaymentStatusChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "payment-status"],
    queryFn: api.getPaymentStatus,
  });

  if (isLoading) return <p className="text-slate-500">Loading payment status…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No payment data yet.</p>;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Payment Status</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" outerRadius={100} label>
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#64748b"} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
