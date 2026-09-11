"use client";

/**
 * Patients-by-gender bar chart. Split out of what used to be a combined
 * `DemographicsChart` (gender + age group in one component) so each can be
 * independently referenced, badged, and reordered as its own "graph" in the
 * "All Graphs" tab / custom views -- see `lib/defaultCharts.tsx`.
 *
 * Shares its TanStack Query `queryKey` (["analytics", "demographics"]) and
 * `queryFn` with `PatientsByAgeGroupChart`, same dedup pattern already used
 * by `TopServicesChart`/`TopServicesRevenueChart` -- both charts render
 * different slices of one backend response, and TanStack Query collapses
 * the two identical in-flight/cached queries into one network request.
 */

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { estimateAxisWidth } from "@/lib/chartAxis";
import { BRAND } from "@/lib/chartColors";
import { formatLabel } from "@/lib/format";

export function PatientsByGenderChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "demographics"],
    queryFn: api.getDemographics,
  });

  if (isLoading) return <p className="text-brand-bg/70">Loading demographics…</p>;
  if (!data) return null;

  // formatLabel() applied to `gender` (e.g. "male" -> "Male") -- Recharts
  // reads its axis/tooltip labels straight from this field.
  const genderData = data.gender_breakdown.map((entry) => ({ ...entry, gender: formatLabel(entry.gender) }));
  const yAxisWidth = estimateAxisWidth(genderData.map((entry) => entry.count.toLocaleString()));

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <h2 className="mb-4 font-medium text-brand-dark">Patients by Gender</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={genderData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="gender" tickMargin={8} />
          <YAxis width={yAxisWidth} tickMargin={8} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" name="Patients" fill={BRAND.sage} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
