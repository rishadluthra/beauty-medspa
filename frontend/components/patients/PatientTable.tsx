"use client";

/**
 * Patient Table page: a searchable, filterable, sortable, paginated table
 * over the full patient list (~4,000 rows). All of that work happens on the
 * server — this component never fetches the whole dataset. It depends on
 * GET /patients (via `api.getPatients`) and renders whatever page of
 * results comes back, plus the `PatientFilters` toolbar that drives it.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, type PatientQueryParams } from "@/lib/api";
import { formatCents, formatDate, formatLabel, formatPhone } from "@/lib/format";
import { getSourceBadgeStyle } from "@/lib/sourceColors";
import { PatientFilters } from "./PatientFilters";

const PAGE_SIZE = 25;

/**
 * Renders the patient list as a server-paginated table with filters.
 *
 * Important: this is fully server-side pagination/filtering/sorting, not a
 * client-side slice of a bulk-fetched array. `filters` is the single source
 * of truth for what to display; it's passed as the TanStack Query
 * `queryKey`, so any change to it (search text, source/gender/sort,
 * page number) is treated as a new query and triggers a fresh API call.
 * The full ~4,000-patient set is never loaded into the browser at once.
 */
export function PatientTable() {
  const [filters, setFilters] = useState<PatientQueryParams>({ page: 1, page_size: PAGE_SIZE, sort: "name" });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", filters],
    queryFn: () => api.getPatients(filters),
  });

  return (
    <div className="space-y-4">
      {/*
        Any filter/search/sort change resets page back to 1 (see the
        `page: 1` merged in below). Without this, narrowing a filter could
        leave the user "stuck" on e.g. page 5 when the new filter only
        produces 2 pages of results, showing an empty page instead of the
        top of the new result set.
      */}
      <PatientFilters filters={filters} onChange={(next) => setFilters({ ...filters, ...next, page: 1 })} />

      {isLoading && <p className="text-brand-bg/70">Loading patients…</p>}
      {isError && <p className="text-coral">Could not load patients. Please try again.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-brand-gold/10 bg-brand-bg shadow-lg shadow-brand-gold/10">
            <table className="w-full text-sm">
              <thead className="bg-brand-gold/10 text-left text-brand-dark">
                <tr>
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">Gender</th>
                  <th className="p-3 font-semibold">Phone</th>
                  <th className="p-3 font-semibold">Email</th>
                  <th className="p-3 font-semibold">Source</th>
                  <th className="p-3 font-semibold">Created</th>
                  <th className="p-3 font-semibold"># Appointments</th>
                  <th className="p-3 font-semibold">Last Appointment</th>
                  <th className="p-3 font-semibold">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {/*
                  Empty-state row. colSpan={9} must match the number of
                  <th> columns in the header above (Name, Gender, Phone,
                  Email, Source, Created, # Appointments, Last Appointment,
                  Total Spent) — if a column is ever added/removed, update
                  this number too or the empty-state cell will misalign.
                */}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-brand-sage">
                      No patients match these filters.
                    </td>
                  </tr>
                )}
                {data.items.map((patient) => (
                  <tr key={patient.id} className="border-t border-brand-dark/10 hover:bg-brand-gold/5">
                    <td className="p-3">{patient.first_name} {patient.last_name}</td>
                    <td className="p-3">{formatLabel(patient.gender)}</td>
                    <td className="p-3">{formatPhone(patient.phone)}</td>
                    <td className="p-3">{patient.email}</td>
                    <td className="p-3">
                      <span
                        className="inline-block rounded-full px-2.5 py-1 text-xs font-medium text-white"
                        style={getSourceBadgeStyle(patient.source)}
                      >
                        {formatLabel(patient.source)}
                      </span>
                    </td>
                    <td className="p-3">{formatDate(patient.created_date)}</td>
                    <td className="p-3">{patient.appointment_count}</td>
                    <td className="p-3">{formatDate(patient.last_appointment_date)}</td>
                    <td className="p-3">{formatCents(patient.total_spent_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-brand-bg/70">
              Showing {(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-brand-bg transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold disabled:opacity-40 disabled:hover:border-brand-bg/20 disabled:hover:bg-transparent disabled:hover:text-brand-bg"
                disabled={data.page <= 1}
                onClick={() => setFilters({ ...filters, page: data.page - 1 })}
              >
                Previous
              </button>
              <button
                className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-brand-bg transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold disabled:opacity-40 disabled:hover:border-brand-bg/20 disabled:hover:bg-transparent disabled:hover:text-brand-bg"
                disabled={data.page * data.page_size >= data.total}
                onClick={() => setFilters({ ...filters, page: data.page + 1 })}
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
