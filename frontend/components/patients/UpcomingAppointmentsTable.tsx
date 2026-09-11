"use client";

/**
 * Upcoming Appointments dashboard. Unlike `TodaysAppointmentsTable` (the
 * immediate day-of schedule) and `PatientTable` (the full roster), this
 * shows one row per patient with their soonest appointment *after* today,
 * for planning ahead rather than day-of operations. See the backend's
 * `list_upcoming_appointments` for exactly what "today" means against
 * this seed dataset.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { calculateAge, formatDate, formatDateTime, formatPhone } from "@/lib/format";

const PAGE_SIZE = 25;

export function UpcomingAppointmentsTable() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", "upcoming", page],
    queryFn: () => api.getUpcomingAppointments({ page, page_size: PAGE_SIZE }),
  });

  return (
    <div className="space-y-4">
      {data && <p className="text-sm text-brand-bg/70">Scheduled after {formatDate(data.reference_date)}</p>}

      {isLoading && <p className="text-brand-bg/70">Loading upcoming appointments…</p>}
      {isError && <p className="text-coral">Could not load upcoming appointments. Please try again.</p>}

      {data && (
        <>
          {/*
            No `table-fixed`/fixed-percentage columns — see
            TodaysAppointmentsTable for why: a fixed-percentage column
            sized against an assumed-typical content length can still
            truncate a real phone number or email once the container is
            capped below what dense columns actually need. Column widths
            here are content-based instead, with `overflow-x-auto` on the
            wrapper as the fallback if the table ever exceeds a narrow
            viewport.
          */}
          <div className="hidden overflow-x-auto rounded-2xl border border-brand-gold/10 bg-brand-bg text-brand-dark shadow-lg shadow-brand-gold/10 sm:block">
            <table className="w-full text-sm">
              <thead className="text-left text-brand-dark">
                <tr className="border-b border-brand-gold/20">
                  <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Name</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Age</th>
                  <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Phone</th>
                  <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Email</th>
                  <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Upcoming Appt.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark/5 text-brand-dark">
                {/* Empty-state row. colSpan={5} must match the number of <th> columns above. */}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-brand-sage">
                      No upcoming appointments.
                    </td>
                  </tr>
                )}
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`/patients/${item.id}`)}
                    className="cursor-pointer transition-colors hover:bg-brand-gold/5"
                  >
                    <td className="whitespace-nowrap px-4 py-3.5">{item.first_name} {item.last_name}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right">{calculateAge(item.date_of_birth)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{formatPhone(item.phone)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{item.email}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{formatDateTime(item.upcoming_appointment_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile equivalent of the table above — same rows, same click-through, laid out as cards. */}
          <div className="space-y-2 sm:hidden">
            {data.items.length === 0 && (
              <p className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-6 text-center text-brand-sage shadow-lg shadow-brand-gold/10">
                No upcoming appointments.
              </p>
            )}
            {data.items.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(`/patients/${item.id}`)}
                className="cursor-pointer rounded-2xl border border-brand-gold/10 bg-brand-bg p-4 text-brand-dark shadow-lg shadow-brand-gold/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{item.first_name} {item.last_name}</p>
                  <span className="text-sm text-brand-dark/60">{calculateAge(item.date_of_birth)}</span>
                </div>
                <p className="mt-1 text-sm text-brand-dark/60">{formatPhone(item.phone)} · {item.email}</p>
                <p className="mt-2 text-sm font-medium">{formatDateTime(item.upcoming_appointment_date)}</p>
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
