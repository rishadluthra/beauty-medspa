"use client";

/**
 * Filter/search/sort toolbar for the Patient Table page, collapsed behind a
 * single persistent, center-aligned "Filters" pill rather than an
 * always-visible row of controls. Clicking it swaps the pill for a row of
 * standalone cream "chips" (search, source, gender, age, joined-date, sort)
 * popping outward from the same center point — there is no shared card
 * behind them, each chip carries its own frosted-glass surface, matching
 * the top nav's pill treatment. An "X" chip at the end of that row
 * collapses it back down to the single "Filters" pill.
 *
 * The whole toolbar also tracks scroll position so it visually rises up
 * and merges toward the nav bar's own resting height as the page scrolls —
 * a smooth, continuous interpolation (not a hard breakpoint swap) meant to
 * echo how iOS's Dynamic Island fluidly combines separate pills into one.
 *
 * Holds only its own open/closed + scroll UI state — the actual filter
 * *values* are owned by `PatientTable` and passed in as `filters`, with
 * every change reported upward via `onChange`.
 */

import { useEffect, useState } from "react";

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

// Sticky offset (px) when the page is at the very top, vs. once scrolled —
// the merged value matches the nav's own `top-3` resting position so the
// two pills read as one cluster once combined.
const TOP_OFFSET_REST = 80;
const TOP_OFFSET_MERGED = 12;
const MERGE_SCROLL_DISTANCE = 80;

interface Props {
  /** Current filter/sort/page state, owned by the parent (`PatientTable`). */
  filters: PatientQueryParams;
  /** Reports a partial update to the parent; parent merges it into `filters`. */
  onChange: (next: Partial<PatientQueryParams>) => void;
}

/** Counts how many distinct filter fields are currently active, for the toggle pill's badge. */
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

/** Shared frosted-cream "chip" styling — every standalone filter control is its own pill, not a section of a shared box. */
const chipClassName =
  "rounded-full border border-brand-gold/10 bg-brand-bg/90 px-4 py-2 text-sm text-brand-dark shadow-lg shadow-brand-gold/10 backdrop-blur-xl outline-none transition-colors placeholder:text-brand-dark/40 focus:ring-2 focus:ring-brand-gold/50";

/** Bare (border/shadow-less) input styling for controls nested *inside* a chip, e.g. the two number inputs sharing one "Age" chip. */
const nestedInputClassName = "bg-transparent text-brand-dark outline-none placeholder:text-brand-dark/40";

export function PatientFilters({ filters, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [topOffset, setTopOffset] = useState(TOP_OFFSET_REST);
  const activeCount = countActiveFilters(filters);

  useEffect(() => {
    function handleScroll() {
      const progress = Math.min(Math.max(window.scrollY / MERGE_SCROLL_DISTANCE, 0), 1);
      setTopOffset(TOP_OFFSET_REST - progress * (TOP_OFFSET_REST - TOP_OFFSET_MERGED));
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="sticky z-40 transition-[top] duration-150 ease-out" style={{ top: `${topOffset}px` }}>
      {/* Collapsed state: a single pill, centered under the nav, matching its own frosted style. */}
      {!isOpen && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-expanded={false}
            className="flex items-center gap-2 rounded-full border border-brand-gold/10 bg-brand-bg/80 px-5 py-2.5 text-sm font-medium text-brand-dark shadow-lg shadow-brand-gold/10 backdrop-blur-xl transition-all duration-300 hover:bg-brand-bg/90"
          >
            <FilterIcon />
            Filters
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-xs font-semibold text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/*
        Expanded state: no shared card behind these — each control is its
        own cream chip. The two nested divs below are transparent, borderless
        layout helpers only (never rendered as a visible box): the outer one
        uses the CSS grid-rows-[0fr → 1fr] trick to animate height from
        nothing up to the row's natural height, and the inner one scales up
        from 95%, so the whole row "pops outward" from the same center point
        the collapsed pill occupied, rather than a hard cut or a corner-grow.
      */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
        <div
          className={`flex flex-wrap items-center justify-center gap-3 pt-1 transition-transform duration-300 ${
            isOpen ? "scale-100" : "scale-95"
          }`}
        >
          <input
            type="text"
            placeholder="Search name, email, or phone"
            className={`w-56 ${chipClassName}`}
            defaultValue={filters.search ?? ""}
            onChange={(e) => onChange({ search: e.target.value })}
          />
          <select
            className={chipClassName}
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
            className={chipClassName}
            value={filters.gender ?? ""}
            onChange={(e) => onChange({ gender: e.target.value || undefined })}
          >
            <option value="">All genders</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{formatLabel(g)}</option>
            ))}
          </select>

          <div className={`flex items-center gap-2 ${chipClassName}`}>
            <span className="text-brand-dark/60">Age</span>
            <input
              type="number"
              min={0}
              placeholder="Min"
              aria-label="Minimum age"
              className={`w-12 ${nestedInputClassName}`}
              value={filters.age_min ?? ""}
              onChange={(e) => onChange({ age_min: e.target.value ? Number(e.target.value) : undefined })}
            />
            <span className="text-brand-dark/40">–</span>
            <input
              type="number"
              min={0}
              placeholder="Max"
              aria-label="Maximum age"
              className={`w-12 ${nestedInputClassName}`}
              value={filters.age_max ?? ""}
              onChange={(e) => onChange({ age_max: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          <div className={`flex items-center gap-2 ${chipClassName}`}>
            <span className="text-brand-dark/60">Joined</span>
            <input
              type="date"
              aria-label="Joined from"
              className={nestedInputClassName}
              value={filters.created_from ?? ""}
              onChange={(e) => onChange({ created_from: e.target.value || undefined })}
            />
            <span className="text-brand-dark/40">–</span>
            <input
              type="date"
              aria-label="Joined to"
              className={nestedInputClassName}
              value={filters.created_to ?? ""}
              onChange={(e) => onChange({ created_to: e.target.value || undefined })}
            />
          </div>

          <select
            className={chipClassName}
            value={filters.sort ?? "name"}
            onChange={(e) => onChange({ sort: e.target.value })}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>Sort: {s.label}</option>
            ))}
          </select>

          {/* Collapses the row back into the single "Filters" pill. Kept last so it reads as the rightmost chip. */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close filters"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-gold/10 bg-brand-bg/90 text-brand-dark shadow-lg shadow-brand-gold/10 backdrop-blur-xl transition-colors hover:bg-brand-bg"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
