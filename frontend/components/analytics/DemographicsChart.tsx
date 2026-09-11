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
import { estimateAxisWidth } from "@/lib/chartAxis";
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

  // Estimated from the real max count in each dataset, not a fixed guess --
  // a fixed 40px guess here still clipped the leading digit off a tick
  // like "2,800" in production once the real patient count pushed past
  // what that guess assumed.
  const genderYAxisWidth = estimateAxisWidth(genderData.map((entry) => entry.count.toLocaleString()));
  const ageYAxisWidth = estimateAxisWidth(data.age_buckets.map((entry) => entry.count.toLocaleString()));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
        <h2 className="mb-4 font-medium text-brand-dark">Patients by Gender</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={genderData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="gender" tickMargin={8} />
            <YAxis width={genderYAxisWidth} tickMargin={8} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Patients" fill={BRAND.sage} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
        <h2 className="mb-4 font-medium text-brand-dark">Patients by Age Group</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.age_buckets} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" tickMargin={8} />
            <YAxis width={ageYAxisWidth} tickMargin={8} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Patients" fill={BRAND.rose} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
