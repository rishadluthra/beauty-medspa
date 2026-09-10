"use client";

/**
 * Filter/search/sort toolbar for the Patient Table page. Renders a free-text
 * search box plus source/gender/sort dropdowns. Holds no state of its own —
 * it is a controlled component driven entirely by the `filters` prop it
 * receives from `PatientTable`, and every change is reported upward via
 * `onChange` (which triggers a new server-side fetch there).
 */

import type { PatientQueryParams } from "@/lib/api";
import { formatLabel } from "@/lib/format";

// Raw backend enum values for the source/gender filters. These must match
// the values the API expects (and that live in the seed data / DB), not
// display text — see the `formatLabel` note on the <option> below.
const SOURCES = ["in_person", "phone", "instagram", "tiktok", "google", "website"];
const GENDERS = ["male", "female", "other"];
const SORTS = [
  { value: "name", label: "Name" },
  { value: "created_date", label: "Newest" },
  { value: "total_spent", label: "Total Spent" },
  { value: "last_appointment_date", label: "Last Appointment" },
];

interface Props {
  /** Current filter/sort/page state, owned by the parent (`PatientTable`). */
  filters: PatientQueryParams;
  /** Reports a partial update to the parent; parent merges it into `filters`. */
  onChange: (next: Partial<PatientQueryParams>) => void;
}

/**
 * Controlled filter bar for the patient list: search input + source, gender,
 * and sort dropdowns. Doesn't fetch or own data itself — every interaction
 * just calls `onChange` with the changed field(s) and lets the parent
 * re-query the API.
 */
export function PatientFilters({ filters, onChange }: Props) {
  const selectClassName =
    "rounded-xl border border-brand-dark/15 bg-white px-3 py-2 text-sm text-brand-dark outline-none transition-colors focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30";

  return (
    <div className="flex flex-wrap gap-3 rounded-2xl border border-brand-dark/10 bg-white p-5 shadow-md">
      <input
        type="text"
        placeholder="Search name, email, or phone"
        className={`min-w-[200px] flex-1 ${selectClassName}`}
        defaultValue={filters.search ?? ""}
        onChange={(e) => onChange({ search: e.target.value })}
      />
      <select
        className={selectClassName}
        value={filters.source ?? ""}
        onChange={(e) => onChange({ source: e.target.value || undefined })}
      >
        <option value="">All sources</option>
        {/*
          `value` is intentionally the raw backend enum (e.g. "in_person") —
          that's what actually gets sent as the filter param. Only the
          displayed text runs through formatLabel() for readability (e.g.
          "In Person"). Do not swap these: making `value` the formatted
          text would send labels the backend doesn't recognize and silently
          break filtering.
        */}
        {SOURCES.map((s) => (
          <option key={s} value={s}>{formatLabel(s)}</option>
        ))}
      </select>
      <select
        className={selectClassName}
        value={filters.gender ?? ""}
        onChange={(e) => onChange({ gender: e.target.value || undefined })}
      >
        <option value="">All genders</option>
        {GENDERS.map((g) => (
          <option key={g} value={g}>{formatLabel(g)}</option>
        ))}
      </select>
      <select
        className={selectClassName}
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
