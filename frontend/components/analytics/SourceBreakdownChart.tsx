"use client";

/**
 * Analytics Dashboard pie chart of patient counts by marketing source
 * (in_person/phone/instagram/tiktok/google/website). Data comes from
 * GET /analytics/patients-by-source via `api.getPatientsBySource`.
 */

import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";
import { formatLabel } from "@/lib/format";

// Colors are assigned by array position (index % COLORS.length), not keyed
// by source value — fine here since there's no raw/formatted color-lookup
// split like in AppointmentStatusChart/PaymentStatusChart.
const COLORS = ["#0f766e", "#0891b2", "#7c3aed", "#db2777", "#d97706", "#65a30d"];

/** Fetches and renders the patient-source breakdown as a pie chart. */
export function SourceBreakdownChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "patients-by-source"],
    queryFn: api.getPatientsBySource,
  });

  if (isLoading) return <p className="text-slate-500">Loading source breakdown…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No patient source data yet.</p>;

  // Map the raw fetched data into a separate `chartData` array with
  // formatLabel() applied to `source` (e.g. "in_person" -> "In Person").
  // Recharts derives pie slice labels, legend entries, and tooltip names
  // straight from the `nameKey` field of the data passed to <Pie>, so doing
  // this once here means the formatted text shows up everywhere in the
  // chart without needing separate formatter callbacks on Pie/Legend/Tooltip.
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
