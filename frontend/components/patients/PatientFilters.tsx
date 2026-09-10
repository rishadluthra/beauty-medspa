"use client";

/**
 * Filter/search/sort toolbar for the Patient Table page, collapsed behind a
 * single persistent "Filters" toggle button rather than an always-visible
 * row of controls. Clicking it expands a frosted-glass panel (the same
 * translucent-cream + backdrop-blur treatment as the top nav) containing
 * the free-text search box plus source/gender/age/created-date/sort
 * controls. Holds only its own open/closed UI state — the actual filter
 * *values* are owned by `PatientTable` and passed in as `filters`, with
 * every change reported upward via `onChange`.
 */

import { useState } from "react";

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

/** Counts how many distinct filter fields are currently active, for the toggle button's badge. */
function countActiveFilters(filters: PatientQueryParams): number {
  return [
    filters.search,
    filters.source,
    filters.gender,
    filters.created_from,
    filters.created_to,
    filters.age_min,
    filters.age_max,
  ].filter((value) => value !== undefined && value !== "").length;
}

/** Three-line "sliders" glyph — a plain inline SVG so this doesn't need an icon library dependency. */
function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Toggle button + expandable frosted-glass panel for the patient filters.
 *
 * `sticky top-20` (below the nav's own `sticky top-3`) means both the nav
 * and this toggle stay pinned together near the top of the viewport while
 * scrolling through the (potentially long) patient table — visually one
 * persistent floating chrome cluster, not something that scrolls away.
 */
export function PatientFilters({ filters, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  // Individual controls read as dark-green "chips" against the panel's own
  // cream/translucent surface — reusing the same cream-vs-dark-green
  // duality as the rest of the app, so fields don't visually disappear
  // into the panel they sit on.
  const fieldClassName =
    "rounded-xl bg-brand-dark px-3 py-2 text-sm text-brand-bg outline-none transition-colors placeholder:text-brand-bg/50 focus:ring-2 focus:ring-brand-gold/50";

  return (
    <div className="sticky top-20 z-40 lg:top-24">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-full border border-brand-gold/10 bg-brand-bg/80 px-5 py-2.5 text-sm font-medium text-brand-dark shadow-lg shadow-brand-gold/10 backdrop-blur-xl transition-all duration-300 hover:bg-brand-bg/90"
      >
        <FilterIcon />
        Filters
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/*
        Height/opacity/scale all animate together for a "liquid" expand
        rather than an abrupt reveal — transform-origin at the top-left so
        it visually grows out of the toggle button above it, echoing how
        iOS's Dynamic Island expands from a small pill into a larger panel.
      */}
      <div
        className={`origin-top-left overflow-hidden transition-all duration-300 ease-out ${
          isOpen ? "mt-3 max-h-[28rem] scale-100 opacity-100" : "max-h-0 scale-95 opacity-0"
        }`}
      >
        <div className="flex flex-wrap gap-3 rounded-2xl border border-brand-gold/10 bg-brand-bg/80 p-5 shadow-lg shadow-brand-gold/10 backdrop-blur-xl">
          <input
            type="text"
            placeholder="Search name, email, or phone"
            className={`min-w-[200px] flex-1 ${fieldClassName}`}
            defaultValue={filters.search ?? ""}
            onChange={(e) => onChange({ search: e.target.value })}
          />
          <select
            className={fieldClassName}
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
            className={fieldClassName}
            value={filters.gender ?? ""}
            onChange={(e) => onChange({ gender: e.target.value || undefined })}
          >
            <option value="">All genders</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{formatLabel(g)}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <span className="text-sm text-brand-bg/70">Age:</span>
            <input
              type="number"
              min={0}
              placeholder="Min age"
              aria-label="Minimum age"
              className={`w-24 ${fieldClassName}`}
              value={filters.age_min ?? ""}
              onChange={(e) => onChange({ age_min: e.target.value ? Number(e.target.value) : undefined })}
            />
            <span className="text-brand-bg/50">–</span>
            <input
              type="number"
              min={0}
              placeholder="Max age"
              aria-label="Maximum age"
              className={`w-24 ${fieldClassName}`}
              value={filters.age_max ?? ""}
              onChange={(e) => onChange({ age_max: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-brand-bg/70">Joined:</span>
            <input
              type="date"
              aria-label="Joined from"
              className={fieldClassName}
              value={filters.created_from ?? ""}
              onChange={(e) => onChange({ created_from: e.target.value || undefined })}
            />
            <span className="text-brand-bg/50">–</span>
            <input
              type="date"
              aria-label="Joined to"
              className={fieldClassName}
              value={filters.created_to ?? ""}
              onChange={(e) => onChange({ created_to: e.target.value || undefined })}
            />
          </div>

          <select
            className={fieldClassName}
            value={filters.sort ?? "name"}
            onChange={(e) => onChange({ sort: e.target.value })}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>Sort: {s.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
