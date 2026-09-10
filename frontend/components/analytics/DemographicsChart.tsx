"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";

export function DemographicsChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "demographics"],
    queryFn: api.getDemographics,
  });

  if (isLoading) return <p className="text-slate-500">Loading demographics…</p>;
  if (!data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-4 font-medium">Patients by Gender</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.gender_breakdown}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="gender" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#7c3aed" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-4 font-medium">Patients by Age Group</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.age_buckets}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#db2777" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
