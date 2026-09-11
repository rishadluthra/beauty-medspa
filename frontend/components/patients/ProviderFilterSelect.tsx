"use client";

/**
 * Provider filter dropdown shared by TodaysAppointmentsTable and
 * CalendarView's day drill-down — lets a front desk agent narrow either
 * schedule view down to one provider's own appointments (e.g. "what does
 * Dr. Smith have today" or "what does Dr. Jones have on this day").
 */

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

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
      className="rounded-full border border-brand-bg/20 bg-transparent px-4 py-1.5 text-sm text-brand-bg outline-none transition-colors focus:ring-2 focus:ring-brand-gold/50"
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
