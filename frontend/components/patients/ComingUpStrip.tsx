"use client";

/**
 * "Coming Up Tomorrow" — a compact glance at tomorrow's soonest-first
 * appointments, shown below Today's Appointments. Replaces the old
 * full-page Upcoming Appointments tab: the Calendar view already covers
 * deep drill-down into any future day, so a whole separate paginated tab
 * of the same underlying data added little beyond what this quick glance
 * now covers, without needing to click into a specific day first to see
 * anything.
 *
 * `only_tomorrow: true` on the API call is what makes this strip's own
 * name accurate -- without it, `list_upcoming_appointments` returns each
 * patient's soonest upcoming appointment regardless of which future day
 * it falls on, which can span several days out (verified live: an 8-item
 * unrestricted preview included appointments 3 days out, not just
 * tomorrow's). Since every item shown is now guaranteed to be the same
 * day, only the TIME is shown per card, not the full date -- repeating
 * an identical date on every single card would be redundant once the
 * heading itself already says "tomorrow."
 *
 * Renders nothing while loading, on error, or when there's nothing
 * upcoming -- this is a secondary glance, not primary content that needs
 * its own loading/error states competing with Today's Appointments above it.
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";

const PREVIEW_COUNT = 8;

export function ComingUpStrip() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", "upcoming", "tomorrow", "preview"],
    queryFn: () => api.getUpcomingAppointments({ page: 1, page_size: PREVIEW_COUNT, only_tomorrow: true }),
  });

  if (isLoading || isError || !data || data.items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-bg/50">Coming Up Tomorrow</p>
      {/*
        A CSS grid (equal-width/equal-height cells) instead of the previous
        `flex flex-wrap` row -- flex-wrap sized each pill to its own content,
        so a short name ("Eric West") produced a visibly smaller pill than a
        long one ("Christopher Smith") sitting right next to it, reading as
        uneven/inconsistent. Every cell here is the same size regardless of
        content, with `truncate` as the overflow fallback for a name that
        doesn't fit rather than letting it grow the cell.
      */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/*
          Links to the Appointment Detail page (with `service_id` so that
          specific row highlights there), not the Patient Detail page like
          this used to -- clicking "what's coming up" is about that
          upcoming visit, matching the same appointment-first mental model
          Today's Appointments/Calendar already use. No `ctx` is passed:
          this strip isn't one of the tab-level schedule windows the
          Appointment Detail page's Previous/Next can walk, so those
          buttons simply stay disabled when arriving from here, which is
          honest given there's no "next item in this list" concept to offer.
        */}
        {data.items.map((item) => (
          <Link
            key={item.id}
            href={`/appointments/${item.appointment_id}?service_id=${item.service_id}`}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-brand-bg/20 bg-brand-bg/5 px-3 py-2.5 text-center transition-colors hover:border-brand-gold hover:bg-brand-bg/10"
          >
            <span className="w-full truncate text-sm font-medium text-brand-bg">{item.first_name} {item.last_name}</span>
            <span className="w-full truncate text-xs text-brand-bg/60">{formatTime(item.upcoming_appointment_date)}</span>
            <span className="w-full truncate text-xs text-brand-bg/50">{item.service_name} · {item.provider_name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
