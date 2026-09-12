"use client";

/**
 * Filter toolbar for Today's Appointments and the Calendar view's day drill-down --
 * same dropdown pattern as `PatientFilters` (a `FILTER_PILL_CLASSNAME` toggle button that
 * opens a small card), replacing the schedule views' previous bare provider-only
 * `ProviderFilterSelect` pill now that there's a service filter too. Sorting used to
 * live here too (a "Sort: X" select) -- removed in favor of column-header click-to-sort
 * on `ScheduleTable` itself, the same change `PatientFilters` went through for the same
 * reason (one consistent way to sort, covering every column, not just the few a
 * dropdown had room to list).
 *
 * Holds only its own open/closed UI state -- the actual filter *values* are owned
 * by whichever page renders this (`PatientsPage` for Today's Appointments, `CalendarView`
 * for the day drill-down) and passed in as `filters`, with every change reported upward
 * via `onChange`, the same contract `PatientFilters` uses.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, type ScheduleFilterParams } from "@/lib/api";
import { FILTER_FIELD_CLASSNAME, FILTER_PILL_CLASSNAME } from "@/lib/pillStyles";

interface Props {
  filters: ScheduleFilterParams;
  onChange: (next: Partial<ScheduleFilterParams>) => void;
}

/** Counts how many distinct filter fields (not sort -- that's a display order, not a filter) are active. */
function countActiveFilters(filters: ScheduleFilterParams): number {
  return [filters.provider_id, filters.service_id].filter((value) => value !== undefined && value !== "").length;
}

/** Same "sliders" glyph `PatientFilters`'s toggle button uses, for a visually identical control. */
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

export function ScheduleFilters({ filters, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCount = countActiveFilters(filters);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: providers } = useQuery({ queryKey: ["providers"], queryFn: () => api.getProviders() });
  const { data: services } = useQuery({ queryKey: ["services"], queryFn: () => api.getServices() });

  return (
    // `ml-auto` keeps this control pinned to the row's right edge even when it wraps
    // onto its own line at phone width -- see `PatientFilters` for why that specifically
    // matters for the dropdown card below (`right-0`/`absolute` anchors off THIS
    // element's own position, so this element landing at the row's left edge on a
    // narrow screen is what pushed the card off the left of the viewport).
    <div ref={containerRef} className="relative ml-auto">
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

      <div
        className={`absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-1.5rem)] origin-top-right rounded-2xl border border-brand-gold/10 bg-brand-bg p-4 shadow-xl transition-all duration-150 ease-out ${
          isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-3">
          <select
            aria-label="Filter by provider"
            className={FILTER_FIELD_CLASSNAME}
            value={filters.provider_id ?? ""}
            onChange={(e) => onChange({ provider_id: e.target.value || undefined })}
          >
            <option value="">All providers</option>
            {providers?.items.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.first_name} {provider.last_name}</option>
            ))}
          </select>

          <select
            aria-label="Filter by service"
            className={FILTER_FIELD_CLASSNAME}
            value={filters.service_id ?? ""}
            onChange={(e) => onChange({ service_id: e.target.value || undefined })}
          >
            <option value="">All services</option>
            {services?.items.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
