"use client";

/**
 * Filter/search/sort toolbar for the All Patients tab: a plain anchored
 * "Filters" button, rendered by `PatientsPage` in the shared tab row
 * (right-aligned, next to the left-aligned tab selector), that opens a
 * simple dropdown card. The card is anchored to the button's right edge
 * and expands leftward/downward from that corner (`origin-top-right`), the
 * same way any standard dropdown menu behaves — no scroll-tracking, no
 * shape-morphing, just a clean fade+scale.
 *
 * The toggle button shares `FILTER_PILL_CLASSNAME` with
 * `ProviderFilterSelect` (Today's Appointments' "All Providers" control,
 * which sits in that same tab row when that tab is active) so the two
 * controls read as one consistent style rather than two different ones
 * (this used to be a solid opaque button next to a transparent one).
 *
 * Holds only its own open/closed UI state — the actual filter *values* are
 * owned by `PatientsPage` and passed in as `filters`, with every change
 * reported upward via `onChange`.
 */

import { useEffect, useRef, useState } from "react";

import type { PatientQueryParams } from "@/lib/api";
import { formatLabel } from "@/lib/format";
import { FILTER_PILL_CLASSNAME } from "@/lib/pillStyles";

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
    filters.min_total_spent_cents,
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

/** Plain field styling shared by every control inside the dropdown card. */
const fieldClassName =
  "rounded-lg border border-brand-dark/10 bg-brand-dark/5 px-3 py-2 text-sm text-brand-dark outline-none transition-colors focus:ring-2 focus:ring-brand-gold/50 placeholder:text-brand-dark/40";

export function PatientFilters({ filters, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCount = countActiveFilters(filters);

  // Standard dropdown behavior: clicking anywhere outside the button/card closes it.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={FILTER_PILL_CLASSNAME}
      >
        <FilterIcon />
        Filters
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/*
        Anchored to the button's right edge; `origin-top-right` makes it
        visibly unfold leftward/downward from that corner. Width is capped
        at `calc(100vw-1.5rem)` so it can never overflow off the left edge
        of a narrow phone screen the way a fixed `22rem` would below ~370px.
      */}
      <div
        className={`absolute right-0 top-full z-30 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] origin-top-right rounded-2xl border border-brand-gold/10 bg-brand-bg p-4 shadow-xl transition-all duration-150 ease-out ${
          isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Search name, email, or phone"
            className={fieldClassName}
            defaultValue={filters.search ?? ""}
            onChange={(e) => onChange({ search: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-brand-dark/60">Age</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="Min"
                aria-label="Minimum age"
                className={`w-full ${fieldClassName}`}
                value={filters.age_min ?? ""}
                onChange={(e) => onChange({ age_min: e.target.value ? Number(e.target.value) : undefined })}
              />
              <span className="text-brand-dark/40">–</span>
              <input
                type="number"
                min={0}
                placeholder="Max"
                aria-label="Maximum age"
                className={`w-full ${fieldClassName}`}
                value={filters.age_max ?? ""}
                onChange={(e) => onChange({ age_max: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
          </div>

          <div>
            {/*
              For finding high-value patients -- entered in dollars (matching how
              money is shown everywhere else in this app) and converted to the cents
              the API actually expects. `Math.round` guards against float drift from
              typing something like "19.99".
            */}
            <span className="mb-1 block text-xs font-medium text-brand-dark/60">Min. Spent ($)</span>
            <input
              type="number"
              min={0}
              placeholder="e.g. 500"
              aria-label="Minimum total spent in dollars"
              className={`w-full ${fieldClassName}`}
              value={filters.min_total_spent_cents !== undefined ? filters.min_total_spent_cents / 100 : ""}
              onChange={(e) =>
                onChange({
                  min_total_spent_cents: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined,
                })
              }
            />
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-brand-dark/60">Joined</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Joined from"
                className={`w-full ${fieldClassName}`}
                value={filters.created_from ?? ""}
                onChange={(e) => onChange({ created_from: e.target.value || undefined })}
              />
              <span className="text-brand-dark/40">–</span>
              <input
                type="date"
                aria-label="Joined to"
                className={`w-full ${fieldClassName}`}
                value={filters.created_to ?? ""}
                onChange={(e) => onChange({ created_to: e.target.value || undefined })}
              />
            </div>
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
