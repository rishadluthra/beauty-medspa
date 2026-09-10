"use client";

/**
 * Analytics Dashboard demographics section: two side-by-side bar charts,
 * patients by gender and patients by age group. Data comes from
 * GET /analytics/demographics via `api.getDemographics`, which returns
 * both `gender_breakdown` and `age_buckets` in one response.
 */

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { BRAND } from "@/lib/chartColors";
import { formatLabel } from "@/lib/format";

/** Fetches and renders the gender and age-group breakdowns as bar charts. */
export function DemographicsChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "demographics"],
    queryFn: api.getDemographics,
  });

  if (isLoading) return <p className="text-brand-bg/70">Loading demographics…</p>;
  if (!data) return null;

  // Map the raw fetched gender_breakdown into a separate `genderData` array
  // with formatLabel() applied to `gender` (e.g. "male" -> "Male"). Recharts
  // reads its axis/tooltip labels straight from this field, so doing the
  // transform once here gets human-readable text everywhere in the chart
  // without per-component formatter callbacks. (age_buckets needs no such
  // transform — its `bucket` values are already display-ready strings like
  // "18-24".)
  const genderData = data.gender_breakdown.map((entry) => ({ ...entry, gender: formatLabel(entry.gender) }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
        <h2 className="mb-4 font-medium text-brand-dark">Patients by Gender</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={genderData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="gender" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" name="Patients" fill={BRAND.sage} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
        <h2 className="mb-4 font-medium text-brand-dark">Patients by Age Group</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.age_buckets}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" name="Patients" fill={BRAND.rose} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
