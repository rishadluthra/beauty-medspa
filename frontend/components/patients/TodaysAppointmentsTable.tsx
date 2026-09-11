"use client";

/**
 * Today's Appointments — the default view on the Patients page, and the
 * thing a front desk agent actually needs first each day: the full
 * schedule, one row per scheduled service (not per patient, since a
 * multi-service appointment occupies more than one time slot, possibly
 * with different providers), sorted by time. See the backend's
 * `list_todays_appointments` for exactly what "today" means against this
 * seed dataset.
 *
 * No follow-up/confirmation indicator here on purpose — `status` is shown
 * as a plain fact, not a call-to-action, since it doesn't reliably
 * correlate with whether an appointment actually needs attention (see
 * ATTENTION_TO_DETAIL.md's note on Appointment.status being uncorrelated
 * with time in this dataset).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { APPOINTMENT_STATUS_COLORS } from "@/lib/chartColors";
import { formatDate, formatLabel, formatPhone, formatTimeRange } from "@/lib/format";

const PAGE_SIZE = 100;

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

export function TodaysAppointmentsTable() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", "today", page],
    queryFn: () => api.getTodaysAppointments({ page, page_size: PAGE_SIZE }),
  });

  return (
    <div className="space-y-4">
      {data && (
        <p className="text-sm text-brand-bg/70">Schedule for {formatDate(data.reference_date)}</p>
      )}

      {isLoading && <p className="text-brand-bg/70">Loading today&apos;s schedule…</p>}
      {isError && <p className="text-coral">Could not load today&apos;s schedule. Please try again.</p>}

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
                      No appointments scheduled today.
                    </td>
                  </tr>
                )}
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`/patients/${item.patient_id}`)}
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
                No appointments scheduled today.
              </p>
            )}
            {data.items.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(`/patients/${item.patient_id}`)}
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
              Showing {(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-brand-bg transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold disabled:opacity-40 disabled:hover:border-brand-bg/20 disabled:hover:bg-transparent disabled:hover:text-brand-bg"
                disabled={data.page <= 1}
                onClick={() => setPage(data.page - 1)}
              >
                Previous
              </button>
              <button
                className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-brand-bg transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold disabled:opacity-40 disabled:hover:border-brand-bg/20 disabled:hover:bg-transparent disabled:hover:text-brand-bg"
                disabled={data.page * data.page_size >= data.total}
                onClick={() => setPage(data.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
