"use client";

/**
 * Analytics Dashboard pie chart of patient counts by marketing source
 * (in_person/phone/instagram/tiktok/google/website). Data comes from
 * GET /analytics/patients-by-source via `api.getPatientsBySource`.
 */

import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";
import { CATEGORICAL_PALETTE } from "@/lib/chartColors";
import { formatLabel } from "@/lib/format";

/** Fetches and renders the patient-source breakdown as a pie chart. */
export function SourceBreakdownChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "patients-by-source"],
    queryFn: api.getPatientsBySource,
  });

  if (isLoading) return <p className="text-brand-sage">Loading source breakdown…</p>;
  if (!data || data.length === 0) return <p className="text-brand-sage">No patient source data yet.</p>;

  // Map the raw fetched data into a separate `chartData` array with
  // formatLabel() applied to `source` (e.g. "in_person" -> "In Person").
  // Recharts derives pie slice labels, legend entries, and tooltip names
  // straight from the `nameKey` field of the data passed to <Pie>, so doing
  // this once here means the formatted text shows up everywhere in the
  // chart without needing separate formatter callbacks on Pie/Legend/Tooltip.
  const chartData = data.map((entry) => ({ ...entry, source: formatLabel(entry.source) }));

  return (
    <div className="rounded-2xl border border-brand-dark/10 bg-white p-5 shadow-md">
      <h2 className="mb-4 font-medium text-brand-dark">How Patients Find Us</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chartData} dataKey="patient_count" nameKey="source" outerRadius={100} label>
            {data.map((_, index) => (
              <Cell key={index} fill={CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
