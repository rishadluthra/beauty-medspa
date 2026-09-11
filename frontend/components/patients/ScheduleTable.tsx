"use client";

/**
 * Shared rendering for a `TodaysAppointmentsResponse`-shaped schedule: the
 * one-row-per-service table (with mobile card fallback) and pagination
 * footer used by both `TodaysAppointmentsTable` and `CalendarView`'s day
 * drill-down. Pulled out so the two call sites can't silently drift apart
 * on layout/behavior (e.g. one keeping a truncation fix the other missed).
 */

import { useRouter } from "next/navigation";

import { patientDetailHref } from "@/lib/api";
import type { PatientDetailContext, TodaysAppointmentsResponse } from "@/lib/types";
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
   * specific calendar day (`CalendarView`'s drill-down) -- plus whatever provider filter
   * is active, so a row's link-out scopes the destination's Previous/Next buttons to
   * this same schedule (see `PatientDetailContext`). `date` is required for "day" (the
   * specific day being viewed) and ignored for "today".
   */
  contextKind: "today" | "day";
  providerId: string | undefined;
  date?: string;
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

export function ScheduleTable({
  data, isLoading, isError, page, onPageChange, loadingMessage, errorMessage, emptyMessage,
  contextKind, providerId, date,
}: Props) {
  const router = useRouter();

  // `serviceId` (the specific AppointmentService row, i.e. `item.id`) is filled in per
  // row below -- a patient can have more than one service on the same schedule, so the
  // row actually clicked has to be pinned down, not just the patient.
  const contextFor = (serviceId: number): PatientDetailContext =>
    contextKind === "today"
      ? { kind: "today", providerId, serviceId }
      : { kind: "day", date: date as string, providerId, serviceId };

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
                    <td colSpan={6} className="p-6 text-center text-brand-sage">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => router.push(patientDetailHref(item.patient_id, contextFor(item.id)))}
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
              <p className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-6 text-center text-brand-sage shadow-lg shadow-brand-gold/10">
                {emptyMessage}
              </p>
            )}
            {data.items.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(patientDetailHref(item.patient_id, contextFor(item.id)))}
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
