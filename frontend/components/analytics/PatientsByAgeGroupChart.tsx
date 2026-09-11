"use client";

/**
 * Patients-by-age-group bar chart. Split out of what used to be a combined
 * `DemographicsChart` -- see `PatientsByGenderChart`'s doc comment for why,
 * and for why sharing this queryKey with it is deliberate, not accidental
 * duplication.
 */

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { estimateAxisWidth } from "@/lib/chartAxis";
import { BRAND } from "@/lib/chartColors";

export function PatientsByAgeGroupChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "demographics"],
    queryFn: api.getDemographics,
  });

  if (isLoading) return <p className="text-brand-bg/70">Loading demographics…</p>;
  if (!data) return null;

  // age_buckets needs no label transform -- its `bucket` values are already
  // display-ready strings like "18-24".
  const yAxisWidth = estimateAxisWidth(data.age_buckets.map((entry) => entry.count.toLocaleString()));

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <h2 className="mb-4 font-medium text-brand-dark">Patients by Age Group</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data.age_buckets} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bucket" tickMargin={8} />
          <YAxis width={yAxisWidth} tickMargin={8} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" name="Patients" fill={BRAND.rose} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
