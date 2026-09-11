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

export function ProviderFilterSelect({ value, onChange }: Props) {
  const { data } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.getProviders(),
  });

  return (
    <select
      aria-label="Filter by provider"
      // A native <select> sizes its own intrinsic width off the WIDEST
      // option in the list (e.g. "Anthony Freeman"), not just the
      // currently selected/displayed one -- so a `max-w` here isn't just
      // a safety cap, it's effectively the control's real rendered width
      // in practice, letting this be sized deliberately to match the tab
      // bubbles alongside it, closer than the Filters button's own
      // (visibly wider) measured width. 142px is the measured minimum
      // that fits "All Providers" (the default/common state) in full
      // without truncating it too -- a first attempt at 125px clipped
      // that default label to "All Provi…", caught in a screenshot
      // before shipping. `truncate` still covers a long provider name.
      className={`${FILTER_PILL_CLASSNAME} max-w-[142px] truncate`}
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
  );
}
