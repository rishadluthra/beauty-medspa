"use client";

import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";
import { formatLabel } from "@/lib/format";

const COLORS = ["#0f766e", "#0891b2", "#7c3aed", "#db2777", "#d97706", "#65a30d"];

export function SourceBreakdownChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "patients-by-source"],
    queryFn: api.getPatientsBySource,
  });

  if (isLoading) return <p className="text-slate-500">Loading source breakdown…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No patient source data yet.</p>;

  const chartData = data.map((entry) => ({ ...entry, source: formatLabel(entry.source) }));

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">How Patients Find Us</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chartData} dataKey="patient_count" nameKey="source" outerRadius={100} label>
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
