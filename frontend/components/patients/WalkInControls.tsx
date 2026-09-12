"use client";

/**
 * Walk-In Availability's own service/time picker, rendered by `PatientsPage` in the
 * shared tab row (right-aligned, next to the tab selector) -- exactly where
 * `ScheduleFilters`/`PatientFilters` sit for the other tabs. Previously these two
 * fields lived inside `WalkInAvailability` itself, wrapped in a bordered/shadowed card
 * that pushed the whole results list down a row; the rest of the app never puts a
 * tab's controls in their own row below the tabs (see `PatientsPage`'s top-of-file
 * comment), so that card read as a one-off that didn't belong.
 *
 * Deliberately NOT styled as a `FILTER_PILL_CLASSNAME` toggle-button-plus-dropdown like
 * `ScheduleFilters`/`PatientFilters`: those hide *optional* narrowing behind a click
 * because the table underneath is already meaningful with nothing selected. Here,
 * service + time aren't narrowing anything -- they're the required inputs the whole
 * view depends on to show any result at all, so they stay directly visible in the row
 * rather than hidden behind a "Filters" click.
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

/** Compact select/date/time styling for the dark page background this row sits on -- a lighter-weight cousin of `FILTER_PILL_CLASSNAME` (no button chrome needed for native form fields). */
const TOOLBAR_FIELD_CLASSNAME =
  "rounded-full border border-brand-bg/20 bg-transparent px-3 py-1.5 text-sm text-brand-bg outline-none transition-colors [color-scheme:dark] hover:border-brand-gold focus:ring-2 focus:ring-brand-gold/50";

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
    <div className="ml-auto flex flex-wrap items-center gap-2">
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
