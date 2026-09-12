"use client";

/**
 * Walk-In Availability's own service/time picker, rendered by `PatientsPage` in its
 * own centered row below the tabs (not the shared right-aligned tab-row filter slot
 * `ScheduleFilters`/`PatientFilters` use) -- a deliberate, direct exception to that
 * convention: service + time aren't narrowing anything the way a filter does, they're
 * the required inputs the whole view depends on to show any result at all, and a
 * front-desk agent should be able to see/change them without hunting for a small
 * right-aligned control. Previously these fields lived inside `WalkInAvailability`
 * itself in a flat opaque cream card that read as visually out of place; the current
 * frosted-glass treatment (translucent fill + blur, on the dark page background) and
 * centered placement is a direct, explicit design request, not a re-derivation of the
 * app's general tab-row-filter convention.
 *
 * Owns the "default to the first service once the list loads" effect itself (rather
 * than `WalkInAvailability`, which no longer needs the services list at all now that
 * it only renders the picked service's name/duration from the availability response
 * it already fetches) -- this component is what actually knows once a service is
 * selectable, so it's the natural place to pick the default.
 */

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatCents } from "@/lib/format";

/** Field styling for inside the frosted-glass panel -- a slightly-lighter fill than the panel itself so each field still reads as its own control against the blur, not just floating text. */
const TOOLBAR_FIELD_CLASSNAME =
  "rounded-full border border-brand-bg/25 bg-brand-bg/10 px-3 py-1.5 text-sm text-brand-bg outline-none transition-colors [color-scheme:dark] hover:border-brand-gold focus:ring-2 focus:ring-brand-gold/50";

interface Props {
  serviceId: string | undefined;
  at: string | undefined;
  onServiceIdChange: (serviceId: string) => void;
  onAtChange: (at: string) => void;
}

export function WalkInControls({ serviceId, at, onServiceIdChange, onAtChange }: Props) {
  const { data: services, isLoading: servicesLoading, isError: servicesError } = useQuery({
    queryKey: ["services"],
    queryFn: () => api.getServices(),
  });

  // Default to the first (alphabetically) service once the list loads -- afterward the
  // dropdown fully owns this value.
  useEffect(() => {
    if (services && services.items.length > 0 && serviceId === undefined) {
      onServiceIdChange(services.items[0].id);
    }
  }, [services, serviceId, onServiceIdChange]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-brand-bg/15 bg-brand-bg/10 px-5 py-3 shadow-lg shadow-black/10 backdrop-blur-xl">
      <select
        aria-label="Service"
        className={TOOLBAR_FIELD_CLASSNAME}
        value={serviceId ?? ""}
        onChange={(e) => onServiceIdChange(e.target.value)}
        disabled={servicesLoading || !services?.items.length}
      >
        {services?.items.map((service) => (
          <option key={service.id} value={service.id} className="text-brand-dark">
            {service.name} ({service.duration} min, {formatCents(service.price_cents)})
          </option>
        ))}
      </select>

      {/*
        Separate native `date`/`time` inputs instead of one combined `datetime-local`
        field -- a picker's actual look is entirely up to the browser engine, not this
        code. Safari already renders `datetime-local` close to the native macOS/iOS
        calendar and wheel pickers, but Chrome renders it as a cramped little stepper.
        Splitting into two plain inputs gets Chrome's own (much cleaner) native calendar
        popup for the date half too.
      */}
      <label className="sr-only" htmlFor="walkin-date">Date</label>
      <input
        id="walkin-date"
        type="date"
        className={TOOLBAR_FIELD_CLASSNAME}
        value={at ? at.slice(0, 10) : ""}
        onChange={(e) => e.target.value && at && onAtChange(`${e.target.value}T${at.slice(11, 16)}:00`)}
        disabled={at === undefined}
      />
      <label className="sr-only" htmlFor="walkin-time">Time</label>
      <input
        id="walkin-time"
        type="time"
        className={TOOLBAR_FIELD_CLASSNAME}
        value={at ? at.slice(11, 16) : ""}
        onChange={(e) => e.target.value && at && onAtChange(`${at.slice(0, 10)}T${e.target.value}:00`)}
        disabled={at === undefined}
      />

      {servicesError && <p className="text-sm text-coral">Could not load services.</p>}
    </div>
  );
}
