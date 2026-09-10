"use client";

import type { PatientQueryParams } from "@/lib/api";
import { formatLabel } from "@/lib/format";

const SOURCES = ["in_person", "phone", "instagram", "tiktok", "google", "website"];
const GENDERS = ["male", "female", "other"];
const SORTS = [
  { value: "name", label: "Name" },
  { value: "created_date", label: "Newest" },
  { value: "total_spent", label: "Total Spent" },
  { value: "last_appointment_date", label: "Last Appointment" },
];

interface Props {
  filters: PatientQueryParams;
  onChange: (next: Partial<PatientQueryParams>) => void;
}

export function PatientFilters({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3 rounded-lg border bg-white p-4">
      <input
        type="text"
        placeholder="Search name, email, or phone"
        className="min-w-[200px] flex-1 rounded border px-3 py-2 text-sm"
        defaultValue={filters.search ?? ""}
        onChange={(e) => onChange({ search: e.target.value })}
      />
      <select
        className="rounded border px-3 py-2 text-sm"
        value={filters.source ?? ""}
        onChange={(e) => onChange({ source: e.target.value || undefined })}
      >
        <option value="">All sources</option>
        {SOURCES.map((s) => (
          <option key={s} value={s}>{formatLabel(s)}</option>
        ))}
      </select>
      <select
        className="rounded border px-3 py-2 text-sm"
        value={filters.gender ?? ""}
        onChange={(e) => onChange({ gender: e.target.value || undefined })}
      >
        <option value="">All genders</option>
        {GENDERS.map((g) => (
          <option key={g} value={g}>{formatLabel(g)}</option>
        ))}
      </select>
      <select
        className="rounded border px-3 py-2 text-sm"
        value={filters.sort ?? "name"}
        onChange={(e) => onChange({ sort: e.target.value })}
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>Sort: {s.label}</option>
        ))}
      </select>
    </div>
  );
}
