"use client";

/**
 * "Coming Up" — a compact glance at the next few upcoming appointments
 * (soonest first, across all future days), shown below Today's
 * Appointments. Replaces the old full-page Upcoming Appointments tab: the
 * Calendar view already covers deep drill-down into any future day, so a
 * whole separate paginated tab of the same underlying data added little
 * beyond what this quick "what's coming up next" glance now covers,
 * without needing to click into a specific day first to see anything.
 * Renders nothing while loading, on error, or when there's nothing
 * upcoming -- this is a secondary glance, not primary content that needs
 * its own loading/error states competing with Today's Appointments above it.
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

const PREVIEW_COUNT = 8;

export function ComingUpStrip() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", "upcoming", "preview"],
    queryFn: () => api.getUpcomingAppointments({ page: 1, page_size: PREVIEW_COUNT }),
  });

  if (isLoading || isError || !data || data.items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-bg/50">Coming Up</p>
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
        {data.items.map((item) => (
          <Link
            key={item.id}
            href={`/patients/${item.id}`}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-brand-bg/20 bg-brand-bg/5 px-3 py-2.5 text-center transition-colors hover:border-brand-gold hover:bg-brand-bg/10"
          >
            <span className="w-full truncate text-sm font-medium text-brand-bg">{item.first_name} {item.last_name}</span>
            <span className="w-full truncate text-xs text-brand-bg/60">{formatDate(item.upcoming_appointment_date)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
