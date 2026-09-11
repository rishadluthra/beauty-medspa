"use client";

/**
 * Provider filter dropdown shared by TodaysAppointmentsTable and
 * CalendarView's day drill-down — lets a front desk agent narrow either
 * schedule view down to one provider's own appointments (e.g. "what does
 * Dr. Smith have today" or "what does Dr. Jones have on this day").
 */

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { FILTER_PILL_CLASSNAME } from "@/lib/pillStyles";

interface Props {
  value: string | undefined;
  onChange: (providerId: string | undefined) => void;
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <path d="M1.5 2 6 6.5 10.5 2" />
    </svg>
  );
}

export function ProviderFilterSelect({ value, onChange }: Props) {
  const { data } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.getProviders(),
  });

  return (
    // A native <select>'s own default rendering (line-height, internal
    // chrome) never quite matched the tab buttons' height even with
    // identical padding -- a 1px browser-level mismatch that read as
    // visibly "off" sitting right next to them. `appearance-none` strips
    // that native rendering entirely, so this box-models exactly like
    // <button className={FILTER_PILL_CLASSNAME}> does (same padding,
    // same border, same height), with a hand-drawn chevron standing in
    // for the native arrow this removes.
    <div className="relative inline-flex">
      <select
        aria-label="Filter by provider"
        // A native <select> sizes its own intrinsic width off the WIDEST
        // option in the list (e.g. "Anthony Freeman"), not just the
        // currently selected/displayed one -- so a `max-w` here isn't just
        // a safety cap, it's effectively the control's real rendered width
        // in practice, letting this be sized deliberately to match the tab
        // bubbles alongside it. 142px is the measured minimum that fits
        // "All Providers" (the default/common state) in full without
        // truncating it. `truncate` still covers a long provider name.
        className={`${FILTER_PILL_CLASSNAME} max-w-[142px] appearance-none truncate pr-8`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        {/* Options render in the browser's native dropdown list, not against this
            control's own dark background, so they're given a light-mode text color
            to stay legible there regardless of the page theme. */}
        <option value="" className="text-brand-dark">All Providers</option>
        {data?.items.map((provider) => (
          <option key={provider.id} value={provider.id} className="text-brand-dark">
            {provider.first_name} {provider.last_name}
          </option>
        ))}
      </select>
      {/* Purely decorative stand-in for the native arrow `appearance-none` removed --
          `pointer-events-none` so clicks/taps pass straight through to the <select>. */}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-bg/70">
        <ChevronIcon />
      </span>
    </div>
  );
}
