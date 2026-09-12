"use client";

/**
 * Shared rendering for a `TodaysAppointmentsResponse`-shaped schedule: the
 * one-row-per-service table (with mobile card fallback) and pagination
 * footer used by both `TodaysAppointmentsTable` and `CalendarView`'s day
 * drill-down. Pulled out so the two call sites can't silently drift apart
 * on layout/behavior (e.g. one keeping a truncation fix the other missed).
 */

import { useRouter } from "next/navigation";

import { appointmentDetailHref } from "@/lib/api";
import type { AppointmentDetailContext, TodaysAppointmentsResponse } from "@/lib/types";
import { APPOINTMENT_STATUS_COLORS } from "@/lib/chartColors";
import { formatLabel, formatPhone, formatTimeRange } from "@/lib/format";

interface Props {
  data: TodaysAppointmentsResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  page: number;
  onPageChange: (page: number) => void;
  loadingMessage: string;
  errorMessage: string;
  emptyMessage: string;
  /**
   * Which schedule this table is showing -- "today" (`TodaysAppointmentsTable`) or a
   * specific calendar day (`CalendarView`'s drill-down) -- plus whatever provider/service
   * filter and sort are active, so a row's link-out scopes the destination Appointment
   * Detail page's Previous/Next buttons to this same schedule (see
   * `AppointmentDetailContext`). `date` is required for "day" (the specific day being
   * viewed) and ignored for "today".
   */
  contextKind: "today" | "day";
  providerId: string | undefined;
  serviceId: string | undefined;
  sort: string | undefined;
  date?: string;
  /** Whether a provider/service filter is currently active -- shows a "Clear filters" action in the empty state when true. */
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-xs font-medium text-white"
      style={{ backgroundColor: APPOINTMENT_STATUS_COLORS[status] ?? "#64748b" }}
    >
      {formatLabel(status)}
    </span>
  );
}

/**
 * Simple inbox-with-slash glyph for the empty state below -- a plain inline SVG, matching
 * this app's existing convention of hand-drawn icons (see `PatientFilters`'s `FilterIcon`)
 * rather than pulling in an icon library for one glyph.
 */
function EmptyStateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-brand-sage/60">
      <path d="M4 7h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
      <path d="M4 7l2-4h12l2 4" />
      <path d="M4 7l6 5h4l6-5" />
    </svg>
  );
}

/**
 * The "no rows" state for both the desktop table and the mobile card list below --
 * deliberately more than a bare line of text (an icon, the message, and, when a
 * provider/service filter narrowed the result to nothing, a "Clear filters" action) so a
 * zero-result schedule reads as an intentional, designed state rather than a broken page.
 */
function EmptyState({ message, hasActiveFilters, onClearFilters }: { message: string; hasActiveFilters: boolean; onClearFilters: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center">
      <EmptyStateIcon />
      <p className="text-brand-sage">{message}</p>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-1 rounded-full border border-brand-dark/20 px-4 py-1.5 text-sm text-brand-dark/70 transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export function ScheduleTable({
  data, isLoading, isError, page, onPageChange, loadingMessage, errorMessage, emptyMessage,
  contextKind, providerId, serviceId, sort, date, hasActiveFilters, onClearFilters,
}: Props) {
  const router = useRouter();

  // `rowServiceId` (the specific AppointmentService row, i.e. `item.id`) is filled in per
  // row below -- an appointment can have more than one service on the same schedule, so
  // the row actually clicked has to be pinned down, not just the appointment. `serviceId`
  // (this table's own service *filter*, a `Service.id` string) and `sort` are threaded
  // through too, so the destination's Previous/Next walk this exact same filtered/sorted
  // schedule -- see `AppointmentDetailContext.filterServiceId`/`.sort`.
  const contextFor = (rowServiceId: number): AppointmentDetailContext =>
    contextKind === "today"
      ? { kind: "today", providerId, filterServiceId: serviceId, sort, serviceId: rowServiceId }
      : { kind: "day", date: date as string, providerId, filterServiceId: serviceId, sort, serviceId: rowServiceId };

  return (
    <>
      {isLoading && <p className="text-brand-bg/70">{loadingMessage}</p>}
      {isError && <p className="text-coral">{errorMessage}</p>}

      {data && (
        <>
          {/*
            No `table-fixed`/fixed-percentage columns here on purpose —
            those forced a real phone number ("+1-883-313-9650x45293", 22
            characters) and a time range ("10:00 AM – 10:30 AM") to
            visibly truncate, cutting off actual digits, once the
            container was capped at a size that didn't leave enough room
            per column. The browser's own content-based auto-layout sizes
            each column to what it actually needs; `whitespace-nowrap`
            keeps that content from wrapping instead. If the table ever
            ends up wider than a narrow viewport can show, the
            `overflow-x-auto` wrapper below lets it scroll horizontally
            rather than clipping or truncating anything.
          */}
          <div className="hidden overflow-x-auto rounded-2xl border border-brand-gold/10 bg-brand-bg text-brand-dark shadow-lg shadow-brand-gold/10 sm:block">
            <table className="w-full text-sm">
              <thead className="text-left text-brand-dark">
                <tr className="border-b border-brand-gold/20">
                  <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Time</th>
                  <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Patient</th>
                  <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Phone</th>
                  <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Service</th>
                  <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Provider</th>
                  <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark/5 text-brand-dark">
                {/* Empty-state row. colSpan={6} must match the number of <th> columns above. */}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState message={emptyMessage} hasActiveFilters={hasActiveFilters} onClearFilters={onClearFilters} />
                    </td>
                  </tr>
                )}
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => router.push(appointmentDetailHref(item.appointment_id, contextFor(item.id)))}
                    className="cursor-pointer transition-colors hover:bg-brand-gold/5"
                  >
                    <td className="whitespace-nowrap px-4 py-3.5">{formatTimeRange(item.start, item.end)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{item.patient_name}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{formatPhone(item.phone)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{item.service_name}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{item.provider_name}</td>
                    <td className="whitespace-nowrap px-4 py-3.5"><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile equivalent of the table above — same rows, same click-through, laid out as cards. */}
          <div className="space-y-2 sm:hidden">
            {data.items.length === 0 && (
              <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg shadow-lg shadow-brand-gold/10">
                <EmptyState message={emptyMessage} hasActiveFilters={hasActiveFilters} onClearFilters={onClearFilters} />
              </div>
            )}
            {data.items.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(appointmentDetailHref(item.appointment_id, contextFor(item.id)))}
                className="cursor-pointer rounded-2xl border border-brand-gold/10 bg-brand-bg p-4 text-brand-dark shadow-lg shadow-brand-gold/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{formatTimeRange(item.start, item.end)}</p>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-sm text-brand-dark/70">{item.patient_name} · {formatPhone(item.phone)}</p>
                <p className="mt-1 text-sm text-brand-dark/60">{item.service_name} with {item.provider_name}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-brand-bg/70">
              Showing {data.total === 0 ? 0 : (data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-brand-bg transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold disabled:opacity-40 disabled:hover:border-brand-bg/20 disabled:hover:bg-transparent disabled:hover:text-brand-bg"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </button>
              <button
                className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-brand-bg transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold disabled:opacity-40 disabled:hover:border-brand-bg/20 disabled:hover:bg-transparent disabled:hover:text-brand-bg"
                disabled={page * data.page_size >= data.total}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
