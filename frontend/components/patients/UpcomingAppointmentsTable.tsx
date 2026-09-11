"use client";

/**
 * Upcoming Appointments dashboard — the default view on the Patients page.
 * Unlike `PatientTable` (the full patient roster), this shows one row per
 * patient with a scheduled future appointment, soonest first, plus two
 * follow-up signals a front desk agent would actually triage by: whether
 * today's appointment still needs confirming, and whether the patient has
 * an unpaid appointment on file. See the backend's `list_upcoming_appointments`
 * for exactly what "upcoming"/"today" mean against this seed dataset.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { calculateAge, formatDateTime, formatPhone } from "@/lib/format";

const PAGE_SIZE = 25;

/** Small colored pill for one follow-up reason. Both can appear together if both apply. */
function FollowUpBadge({ tone, children }: { tone: "amber" | "rust"; children: ReactNode }) {
  const toneClassName =
    tone === "amber" ? "bg-brand-gold/15 text-brand-gold-dark" : "bg-brand-rust/10 text-brand-rust";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClassName}`}>
      {children}
    </span>
  );
}

export function UpcomingAppointmentsTable() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", "upcoming", page],
    queryFn: () => api.getUpcomingAppointments({ page, page_size: PAGE_SIZE }),
  });

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-brand-bg/70">Loading upcoming appointments…</p>}
      {isError && <p className="text-coral">Could not load upcoming appointments. Please try again.</p>}

      {data && (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-brand-gold/10 bg-brand-bg text-brand-dark shadow-lg shadow-brand-gold/10 sm:block">
            <table className="w-full table-fixed text-sm">
              <thead className="text-left text-brand-dark">
                <tr className="border-b border-brand-gold/20">
                  <th className="w-[20%] whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Name</th>
                  <th className="w-[6%] whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Age</th>
                  <th className="w-[14%] whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Phone</th>
                  <th className="w-[24%] whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Email</th>
                  <th className="w-[18%] whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Follow-up</th>
                  <th className="w-[18%] whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50">Upcoming Appt.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark/5 text-brand-dark">
                {/* Empty-state row. colSpan={6} must match the number of <th> columns above. */}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-brand-sage">
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
                    <td className="truncate px-4 py-3.5">{item.first_name} {item.last_name}</td>
                    <td className="px-4 py-3.5 text-right">{calculateAge(item.date_of_birth)}</td>
                    <td className="truncate px-4 py-3.5">{formatPhone(item.phone)}</td>
                    <td className="truncate px-4 py-3.5">{item.email}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {item.needs_confirmation && <FollowUpBadge tone="amber">Confirm Today</FollowUpBadge>}
                        {item.has_unpaid_appointment && <FollowUpBadge tone="rust">Unpaid</FollowUpBadge>}
                        {!item.needs_confirmation && !item.has_unpaid_appointment && (
                          <span className="text-brand-dark/30">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">{formatDateTime(item.upcoming_appointment_date)}</td>
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
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{formatDateTime(item.upcoming_appointment_date)}</span>
                  <div className="flex flex-wrap gap-1">
                    {item.needs_confirmation && <FollowUpBadge tone="amber">Confirm Today</FollowUpBadge>}
                    {item.has_unpaid_appointment && <FollowUpBadge tone="rust">Unpaid</FollowUpBadge>}
                  </div>
                </div>
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
