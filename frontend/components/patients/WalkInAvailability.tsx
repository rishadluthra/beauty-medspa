"use client";

/**
 * Walk-In Availability — answers the front desk's actual question when
 * someone shows up without an appointment: "can I fit this person in right
 * now, and with which provider?" Pick a service and a moment (defaulting to
 * "right now" against this dataset), and every provider is checked against
 * their existing (non-cancelled) bookings for a conflict over that service's
 * duration -- available providers are listed first, busy ones show when
 * they free up.
 *
 * Every provider in this seed dataset has historically performed every
 * service (verified directly against the data -- see the backend's
 * `app.repositories.availability` module docstring), so there's no
 * "which providers do this service" filter to apply here; all providers
 * are always checked.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { BRAND } from "@/lib/chartColors";
import { formatCents } from "@/lib/format";

/** "2026-01-01T10:00:00" -> "2026-01-01T10:00", the shape <input type="datetime-local"> needs. */
function toDatetimeLocalValue(iso: string): string {
  return iso.slice(0, 16);
}

function AvailabilityBadge({ available }: { available: boolean }) {
  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-xs font-medium text-white"
      style={{ backgroundColor: available ? BRAND.sage : BRAND.rust }}
    >
      {available ? "Available" : "Busy"}
    </span>
  );
}

export function WalkInAvailability() {
  const [serviceId, setServiceId] = useState<string | undefined>(undefined);
  const [at, setAt] = useState<string | undefined>(undefined);

  const { data: services, isLoading: servicesLoading, isError: servicesError } = useQuery({
    queryKey: ["services"],
    queryFn: () => api.getServices(),
  });

  // Default to the first (alphabetically) service once the list loads --
  // afterward, the dropdown fully owns this value.
  useEffect(() => {
    if (services && services.items.length > 0 && serviceId === undefined) {
      setServiceId(services.items[0].id);
    }
  }, [services, serviceId]);

  const { data: availability, isLoading: availabilityLoading, isError: availabilityError } = useQuery({
    queryKey: ["availability", serviceId, at],
    queryFn: () => api.getAvailability({ service_id: serviceId as string, at }),
    enabled: serviceId !== undefined,
  });

  // Seed the "at" input once the reference day is known, exactly once --
  // afterward the input fully owns it. Deliberately does NOT reuse the
  // server's own default `at` verbatim: the backend has no idea what
  // timezone the agent sitting at the front desk is actually in, so it
  // falls back to combining the reference day with server UTC time --
  // which, for a browser client, is very often a materially different
  // time of day (checked live: the backend returned 04:04 while the
  // browser's real local time was 22:05 the previous day, a 6-hour gap
  // landing in a completely different part of the schedule). The browser
  // DOES know the agent's real local time, so it's substituted in here
  // instead, keeping only the reference day (year/month/day) from the
  // server's response.
  useEffect(() => {
    if (availability && at === undefined) {
      const referenceDay = availability.at.slice(0, 10); // "YYYY-MM-DD"
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setAt(`${referenceDay}T${hh}:${mm}:00`);
    }
  }, [availability, at]);

  const availableCount = availability?.providers.filter((p) => p.available).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-4 text-brand-dark shadow-lg shadow-brand-gold/10 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-brand-dark/60">Service</span>
            <select
              className="rounded-lg border border-brand-dark/10 bg-brand-dark/5 px-3 py-2 text-sm text-brand-dark outline-none transition-colors focus:ring-2 focus:ring-brand-gold/50"
              value={serviceId ?? ""}
              onChange={(e) => setServiceId(e.target.value)}
              disabled={servicesLoading || !services?.items.length}
            >
              {services?.items.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.duration} min, {formatCents(service.price_cents)})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-brand-dark/60">Check availability at</span>
            <input
              type="datetime-local"
              className="rounded-lg border border-brand-dark/10 bg-brand-dark/5 px-3 py-2 text-sm text-brand-dark outline-none transition-colors focus:ring-2 focus:ring-brand-gold/50"
              value={at ? toDatetimeLocalValue(at) : ""}
              onChange={(e) => setAt(e.target.value ? `${e.target.value}:00` : undefined)}
              disabled={at === undefined}
            />
          </label>
        </div>

        {servicesError && <p className="mt-3 text-rust">Could not load services. Please try again.</p>}
      </div>

      {availabilityLoading && <p className="text-brand-bg/70">Checking availability…</p>}
      {availabilityError && <p className="text-coral">Could not check availability. Please try again.</p>}

      {availability && (
        <>
          <p className="text-sm text-brand-bg/70">
            {availableCount} of {availability.providers.length} providers available for {availability.service_name} ({availability.service_duration_minutes} min)
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {availability.providers.map((provider) => (
              <div
                key={provider.provider_id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-brand-gold/10 bg-brand-bg p-4 text-brand-dark shadow-lg shadow-brand-gold/10"
              >
                <span className="font-medium">{provider.provider_name}</span>
                <div className="flex flex-col items-end gap-1">
                  <AvailabilityBadge available={provider.available} />
                  {!provider.available && provider.busy_until && (
                    <span className="text-xs text-brand-dark/60">
                      until {new Date(provider.busy_until).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
