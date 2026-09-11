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
      // A native <select> otherwise sizes itself to its currently selected
      // option's text -- "Dr. Anthony Freeman" renders far wider than
      // "Filters" does, so the two controls didn't match sitting in the
      // same tab row even though they share `FILTER_PILL_CLASSNAME`. Fixed
      // to the Filters button's own measured width (97-98px) instead, with
      // `truncate` so a long provider name still fits, ellipsized, rather
      // than stretching the control back out.
      className={`${FILTER_PILL_CLASSNAME} max-w-[150px] truncate`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      {/* Options render in the browser's native dropdown list, not against this
          control's own dark background, so they're given a light-mode text color
          to stay legible there regardless of the page theme. */}
      <option value="" className="text-brand-dark">All providers</option>
      {data?.items.map((provider) => (
        <option key={provider.id} value={provider.id} className="text-brand-dark">
          {provider.first_name} {provider.last_name}
        </option>
      ))}
    </select>
  );
}
