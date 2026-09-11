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
import { renderInsidePieLabel } from "@/lib/pieLabel";
import { getSourceChartColor } from "@/lib/sourceColors";

/** Fetches and renders the patient-source breakdown as a pie chart. */
export function SourceBreakdownChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "patients-by-source"],
    queryFn: api.getPatientsBySource,
  });

  if (isLoading) return <p className="text-brand-bg/70">Loading source breakdown…</p>;
  if (!data || data.length === 0) return <p className="text-brand-bg/70">No patient source data yet.</p>;

  // Map the raw fetched data into a separate `chartData` array with
  // formatLabel() applied to `source` (e.g. "in_person" -> "In Person").
  // Recharts derives pie slice labels, legend entries, and tooltip names
  // straight from the `nameKey` field of the data passed to <Pie>, so doing
  // this once here means the formatted text shows up everywhere in the
  // chart without needing separate formatter callbacks on Pie/Legend/Tooltip.
  const chartData = data.map((entry) => ({ ...entry, source: formatLabel(entry.source) }));

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <h2 className="mb-4 text-center font-medium text-brand-dark">How Patients Find Us</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          {/*
            `label={renderInsidePieLabel}` + `labelLine={false}` draws each
            slice's count INSIDE the slice itself instead of Recharts'
            default floating external label + connector line -- with six
            slices packed tightly together, the external labels and their
            connector lines were crowding each other and the legend below
            the chart.
          */}
          <Pie data={chartData} dataKey="patient_count" nameKey="source" outerRadius={100} label={renderInsidePieLabel} labelLine={false}>
            {/*
              IMPORTANT: iterates the ORIGINAL raw `data` array (e.g.
              "in_person"), not `chartData` (formatLabel()'d to "In
              Person") -- `getSourceChartColor` (like `SOURCE_BADGE_STYLE`
              behind the Patient Table's source badges) is keyed by the raw
              backend enum value. Matches each slice to the same real
              per-channel brand color already used everywhere else a
              source appears (e.g. Instagram's pink, Google's blue), not a
              generic, unrelated chart palette.
            */}
            {data.map((entry, index) => (
              <Cell key={index} fill={getSourceChartColor(entry.source)} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
