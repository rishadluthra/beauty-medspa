"use client";

/**
 * Filter/search/sort toolbar for the Patient Table page, collapsed behind a
 * single persistent, center-aligned "Filters" pill rather than an
 * always-visible row of controls.
 *
 * The pill itself is the shape that animates: clicking it springs its own
 * width/height open (an elastic easing curve, not a linear fade) into the
 * shape that holds the filter chips — like the pill stretching into the
 * panel — and the chip content only fades in once that shape has mostly
 * finished growing. Closing reverses the sequence: the chips fade out
 * first, then the shape springs back down into the single small pill, so
 * the row visibly "combines into one" rather than just disappearing.
 * Once fully open, the shape's own background fades away, leaving only
 * the individually-styled cream chips — no shared box behind them at rest.
 *
 * `sticky`, pinned at a fixed offset comfortably below the nav's own
 * sticky position, so the two stay visually paired while scrolling without
 * ever overlapping it (the nav sits at a higher z-index and a lower sticky
 * offset — this toolbar's offset must clear the nav's rendered height).
 *
 * Holds only its own open/closed UI state — the actual filter *values* are
 * owned by `PatientTable` and passed in as `filters`, with every change
 * reported upward via `onChange`.
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

// How long, after the shape starts growing/shrinking, before the chip
// content fades in/out. Keeping this shorter than the shape's own
// transition duration (500ms) is what makes the chips look like they
// "emerge from" the shape rather than popping in independently of it.
const CONTENT_DELAY_MS = 180;

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
  const [showContent, setShowContent] = useState(false);
  const activeCount = countActiveFilters(filters);

  // Opening: grow the shape first, then reveal the chips once it's mostly
  // there. Closing: hide the chips first, then let the shape spring shut —
  // this ordering is what makes the transition read as "grows out of" /
  // "collapses into" the pill instead of an independent fade.
  function handleOpen() {
    setIsOpen(true);
    window.setTimeout(() => setShowContent(true), CONTENT_DELAY_MS);
  }
  function handleClose() {
    setShowContent(false);
    window.setTimeout(() => setIsOpen(false), CONTENT_DELAY_MS);
  }

  // Safety net: if the component unmounts mid-transition, don't leak the timers.
  useEffect(() => () => {
    setShowContent(false);
  }, []);

  return (
    // Fixed sticky offset — comfortably clears the nav's own sticky pill
    // (top-3 / lg:top-4, roughly 56-60px tall) with a clean visible gap
    // rather than reacting to scroll position, which previously let the
    // two collide.
    <div className="sticky top-20 z-40 flex justify-center px-3 lg:top-24">
      <div className="relative flex justify-center">
        {/*
          This single element IS the animated shape: an elastic ease-out on
          width/height/background lets it read as one pill physically
          stretching into a wider capsule (liquid), rather than two
          different elements crossfading. `rounded-full` on any height
          still renders a fully-rounded stadium/pill shape, so no separate
          border-radius transition is needed as it grows. Height/width are
          both explicit fixed values (not "auto") specifically so the
          browser can natively transition between them — the fade of its
          own background is delayed so it stays looking solid while it's
          still visibly stretching, then disappears once the real chips
          have taken over.
        */}
        <div
          className={`overflow-hidden rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isOpen
              ? `h-16 w-[min(92vw,56rem)] delay-300 ${showContent ? "border-transparent bg-brand-bg/0 shadow-none" : "border border-brand-gold/10 bg-brand-bg/90 shadow-lg shadow-brand-gold/10 backdrop-blur-xl"}`
              : "h-11 w-40 border border-brand-gold/10 bg-brand-bg/80 shadow-lg shadow-brand-gold/10 backdrop-blur-xl"
          }`}
        >
          {/* Collapsed label — its own opacity fade keeps it from lingering visibly while the shape is mid-stretch. */}
          <button
            type="button"
            onClick={handleOpen}
            aria-expanded={isOpen}
            className={`flex h-11 w-40 items-center justify-center gap-2 whitespace-nowrap px-5 text-sm font-medium text-brand-dark transition-opacity duration-150 ${
              isOpen ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
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

      {/*
        The actual filter chips render as a separate layer positioned over
        the same centered spot — once `showContent` is true they fade/scale
        in "out of" the shape above; on close they fade out first, before
        the shape springs shut. No shared background here: each control
        below is its own standalone cream chip.
      */}
      {isOpen && (
        <div
          className={`absolute top-0 flex w-full max-w-4xl flex-wrap items-center justify-center gap-3 px-3 pt-1 transition-all duration-300 ease-out ${
            showContent ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-95 opacity-0"
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
            onClick={handleClose}
            aria-label="Close filters"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-gold/10 bg-brand-bg/90 text-brand-dark shadow-lg shadow-brand-gold/10 backdrop-blur-xl transition-colors hover:bg-brand-bg"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
