"use client";

/**
 * Patient Table page: a searchable, filterable, sortable, paginated table
 * over the full patient list (~4,000 rows). All of that work happens on the
 * server — this component never fetches the whole dataset. It depends on
 * GET /patients (via `api.getPatients`) and renders whatever page of
 * results comes back, plus the `PatientFilters` toolbar that drives it.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { api, type PatientQueryParams } from "@/lib/api";
import { calculateAge, formatCents, formatDate, formatLabel } from "@/lib/format";
import { PatientFilters } from "./PatientFilters";
import { SourceBadge } from "./SourceBadge";

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
  const router = useRouter();
  const [filters, setFilters] = useState<PatientQueryParams>({ page: 1, page_size: PAGE_SIZE, sort: "name" });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", filters],
    queryFn: () => api.getPatients(filters),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-bg">Patients</h1>
        {/*
          Any filter/search/sort change resets page back to 1 (see the
          `page: 1` merged in below). Without this, narrowing a filter could
          leave the user "stuck" on e.g. page 5 when the new filter only
          produces 2 pages of results, showing an empty page instead of the
          top of the new result set.
        */}
        <PatientFilters filters={filters} onChange={(next) => setFilters({ ...filters, ...next, page: 1 })} />
      </div>

      {isLoading && <p className="text-brand-bg/70">Loading patients…</p>}
      {isError && <p className="text-coral">Could not load patients. Please try again.</p>}

      {data && (
        <>
          {/*
            Deliberately fewer columns than the full patient record holds
            (phone, email, address, and per-visit history all live one
            click away on the Patient Detail page instead) — this is the
            "most relevant at a glance" view, not the whole record.

            A plain HTML <table> doesn't reflow for narrow screens (its
            columns just get uncomfortably cramped, or force horizontal
            scrolling), so below `sm` it's replaced entirely by a stacked
            card list showing the same data in a mobile-appropriate
            layout — this is the actual "works on all screen sizes" fix,
            not just letting the table scroll sideways.
          */}
          <div className="hidden overflow-hidden rounded-2xl border border-brand-gold/10 bg-brand-bg text-brand-dark shadow-lg shadow-brand-gold/10 sm:block">
            {/*
              `table-fixed` with an explicit percentage width on every
              column (not just the narrow ones) is what keeps the columns
              evenly, predictably spaced. Without it, the browser's default
              auto-layout distributes all of the table's leftover width
              across whichever columns *don't* have a width — since this
              table is inside a now width-capped page (see layout.tsx),
              that used to mean a handful of short-text columns getting
              stretched into huge, uneven gaps.
            */}
            <table className="w-full table-fixed text-sm">
              <thead className="bg-brand-gold/10 text-left text-brand-dark">
                <tr>
                  <th className="w-[26%] p-3 font-semibold">Name</th>
                  <th className="w-[8%] p-3 font-semibold">Age</th>
                  <th className="w-[13%] p-3 font-semibold">Gender</th>
                  <th className="w-[17%] p-3 font-semibold">Source</th>
                  <th className="w-[16%] p-3 font-semibold">Joined</th>
                  <th className="w-[10%] p-3 font-semibold">Visits</th>
                  <th className="w-[10%] p-3 text-right font-semibold">Spent</th>
                </tr>
              </thead>
              <tbody className="text-brand-dark">
                {/*
                  Empty-state row. colSpan={7} must match the number of
                  <th> columns in the header above (Name, Age, Gender,
                  Source, Joined, Visits, Spent) — if a column is ever
                  added/removed, update this number too or the empty-state
                  cell will misalign.
                */}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-brand-sage">
                      No patients match these filters.
                    </td>
                  </tr>
                )}
                {data.items.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => router.push(`/patients/${patient.id}`)}
                    className="cursor-pointer border-t border-brand-dark/10 hover:bg-brand-gold/5"
                  >
                    <td className="truncate p-3">{patient.first_name} {patient.last_name}</td>
                    <td className="p-3">{calculateAge(patient.date_of_birth)}</td>
                    <td className="p-3">{formatLabel(patient.gender)}</td>
                    <td className="p-3"><SourceBadge source={patient.source} size="compact" /></td>
                    <td className="p-3">{formatDate(patient.created_date)}</td>
                    <td className="p-3">{patient.appointment_count}</td>
                    <td className="p-3 text-right">{formatCents(patient.total_spent_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile equivalent of the table above — same rows, same click-through, laid out as cards instead of columns. */}
          <div className="space-y-2 sm:hidden">
            {data.items.length === 0 && (
              <p className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-6 text-center text-brand-sage shadow-lg shadow-brand-gold/10">
                No patients match these filters.
              </p>
            )}
            {data.items.map((patient) => (
              <div
                key={patient.id}
                onClick={() => router.push(`/patients/${patient.id}`)}
                className="cursor-pointer rounded-2xl border border-brand-gold/10 bg-brand-bg p-4 text-brand-dark shadow-lg shadow-brand-gold/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{patient.first_name} {patient.last_name}</p>
                  <SourceBadge source={patient.source} size="compact" />
                </div>
                <p className="mt-1 text-sm text-brand-dark/60">
                  {calculateAge(patient.date_of_birth)} · {formatLabel(patient.gender)} · Joined {formatDate(patient.created_date)}
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-brand-dark/70">{patient.appointment_count} visits</span>
                  <span className="font-medium">{formatCents(patient.total_spent_cents)}</span>
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
