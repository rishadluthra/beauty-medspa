"use client";

import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";
import { formatLabel } from "@/lib/format";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#0f766e",
  pending: "#d97706",
  cancelled: "#dc2626",
};

export function AppointmentStatusChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "appointment-status"],
    queryFn: api.getAppointmentStatus,
  });

  if (isLoading) return <p className="text-slate-500">Loading appointment status…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No appointment data yet.</p>;

  const chartData = data.map((entry) => ({ ...entry, status: formatLabel(entry.status) }));

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Appointment Status</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chartData} dataKey="count" nameKey="status" outerRadius={100} label>
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
