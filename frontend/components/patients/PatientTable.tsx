"use client";

/**
 * Patient Table page: a searchable, filterable, sortable, paginated table
 * over the full patient list (~4,000 rows). All of that work happens on the
 * server — this component never fetches the whole dataset. It depends on
 * GET /patients (via `api.getPatients`) and renders whatever page of
 * results comes back.
 *
 * The `PatientFilters` toolbar that drives `filters` is NOT rendered here
 * -- it's owned and rendered by the parent (`PatientsPage`), anchored in
 * the same row as the tab selector, rather than in its own row below the
 * tabs (which used to push the whole table down an extra row). This
 * component is a fully controlled component with respect to filtering:
 * `filters`/`onFiltersChange` come in as props, the same shape
 * `PatientFilters` itself expects, so the parent can wire the two
 * together directly.
 *
 * Every column except Phone is click-to-sort (see `PATIENT_COLUMNS` in
 * `lib/patientFilters.ts` for which are `sortable`) -- clicking a header
 * sorts by it ascending, clicking the already-active header flips to
 * descending. This replaced the old standalone "Sort: X" dropdown in
 * `PatientFilters`, which only covered 4 of the table's columns; every
 * column now sorts the same way a spreadsheet's does, including ones
 * (Age, Gender, Appointments) that dropdown never could.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { SortableTableHeader } from "@/components/SortableTableHeader";
import { api, patientDetailHref, type PatientQueryParams } from "@/lib/api";
import { calculateAge, formatCents, formatDate, formatLabel, formatPhone } from "@/lib/format";
import { isCompleteFilterCondition, PATIENT_COLUMNS } from "@/lib/patientFilters";
import type { PatientDetailContext } from "@/lib/types";
import { SourceBadge } from "./SourceBadge";

interface Props {
  filters: PatientQueryParams;
  onFiltersChange: (next: Partial<PatientQueryParams>) => void;
}

/**
 * Renders the patient list as a server-paginated table.
 *
 * Important: this is fully server-side pagination/filtering/sorting, not a
 * client-side slice of a bulk-fetched array. `apiFilters` (below) -- not the
 * raw `filters` prop -- is the TanStack Query `queryKey`, so any change to
 * what's actually SENT to the API (search text, a completed filter
 * condition, sort, page number) is treated as a new query and triggers a
 * fresh call. The full ~4,000-patient set is never loaded into the browser
 * at once.
 */
export function PatientTable({ filters, onFiltersChange }: Props) {
  const router = useRouter();
  const sort = filters.sort ?? "name";
  const sortDir = filters.sort_dir ?? "asc";

  // Only COMPLETE filter conditions (a value already entered) are sent to the API -- a
  // row still being edited in `PatientFilters` (column picked, no value yet, or an
  // operator picked but no value yet) stays local UI state there and simply isn't
  // queried on until it's finished. See `isCompleteFilterCondition`.
  const completeConditions = (filters.filters ?? []).filter(isCompleteFilterCondition);
  const apiFilters: PatientQueryParams = { ...filters, filters: completeConditions };

  // Resetting to page 1 whenever the APPLIED (complete) filters/search change -- not on
  // every keystroke of `filters` itself, which also changes the instant a new, still-
  // empty filter row is added or its column/operator is picked before a value exists.
  // Reacting to raw `filters` here (or, before this, unconditionally forcing `page: 1`
  // in the parent's onChange -- see `app/patients/page.tsx`) was a real reported bug:
  // it fed straight into `queryKey` below, so the table visibly refetched/flashed the
  // instant "+ Add Filter" was clicked, before any actual filter value existed.
  const appliedSignature = JSON.stringify({ filters: completeConditions, search: filters.search });
  const previousAppliedSignature = useRef(appliedSignature);
  useEffect(() => {
    if (previousAppliedSignature.current !== appliedSignature) {
      previousAppliedSignature.current = appliedSignature;
      onFiltersChange({ page: 1 });
    }
  }, [appliedSignature, onFiltersChange]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", apiFilters],
    queryFn: () => api.getPatients(apiFilters),
  });

  function handleSort(key: string) {
    onFiltersChange(sort === key ? { sort: key, sort_dir: sortDir === "asc" ? "desc" : "asc", page: 1 } : { sort: key, sort_dir: "asc", page: 1 });
  }

  // Same filters/sort the table itself is currently showing -- so the detail page's
  // Previous/Next buttons walk this exact list, not the unfiltered global order.
  const context: PatientDetailContext = {
    kind: "all", sort, sortDir, search: filters.search, filters: apiFilters.filters,
  };

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-brand-bg/70">Loading patients…</p>}
      {isError && <p className="text-coral">Could not load patients. Please try again.</p>}

      {data && (
        <>
          {/*
            A plain HTML <table> doesn't reflow for narrow screens (its
            columns just get uncomfortably cramped, or force horizontal
            scrolling), so below `sm` it's replaced entirely by a stacked
            card list showing the same data in a mobile-appropriate
            layout — this is the actual "works on all screen sizes" fix,
            not just letting the table scroll sideways.
          */}
          <div className="hidden overflow-x-auto rounded-2xl border border-brand-gold/10 bg-brand-bg text-brand-dark shadow-lg shadow-brand-gold/10 sm:block">
            {/*
              No `table-fixed`/percentage widths -- Phone and Email are
              dimensionally-critical columns the same way they are on the
              schedule tables (see TodaysAppointmentsTable for the
              truncation bug that caused), so this uses the same
              content-based `table-auto` + `whitespace-nowrap` sizing, with
              `overflow-x-auto` on the wrapper as the fallback on narrower
              screens now that there are ten columns to fit. Every column
              is left-aligned, including the numeric ones -- a deliberate,
              explicit request, not the usual right-aligned-numbers
              convention, since a per-column mix of alignments here read as
              inconsistent/broken rather than as a meaningful signal.
            */}
            <table className="w-full text-sm">
              <thead className="text-left text-brand-dark">
                <tr className="border-b border-brand-gold/20">
                  {PATIENT_COLUMNS.map((column) => (
                    <SortableTableHeader
                      key={column.key}
                      label={column.label}
                      sortKey={column.sortable ? column.key : undefined}
                      activeSort={sort}
                      activeDir={sortDir}
                      onSort={handleSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark/5 text-brand-dark">
                {/*
                  Empty-state row. colSpan must match the number of <th>
                  columns above (driven by `PATIENT_COLUMNS.length`, so
                  this can never silently fall out of sync with them).
                */}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={PATIENT_COLUMNS.length} className="p-6 text-center text-brand-sage">
                      No patients match these filters.
                    </td>
                  </tr>
                )}
                {data.items.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => router.push(patientDetailHref(patient.id, context))}
                    className="cursor-pointer transition-colors hover:bg-brand-gold/5"
                  >
                    <td className="whitespace-nowrap px-4 py-3.5">{patient.first_name} {patient.last_name}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{formatPhone(patient.phone)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{patient.email}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{calculateAge(patient.date_of_birth)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{formatLabel(patient.gender)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5"><SourceBadge source={patient.source} size="compact" /></td>
                    <td className="whitespace-nowrap px-4 py-3.5">{formatDate(patient.created_date)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{patient.appointment_count}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{formatCents(patient.total_spent_cents)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{formatDate(patient.last_appointment_date)}</td>
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
                onClick={() => router.push(patientDetailHref(patient.id, context))}
                className="cursor-pointer rounded-2xl border border-brand-gold/10 bg-brand-bg p-4 text-brand-dark shadow-lg shadow-brand-gold/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{patient.first_name} {patient.last_name}</p>
                  <SourceBadge source={patient.source} size="compact" />
                </div>
                <p className="mt-1 text-sm text-brand-dark/60">{formatPhone(patient.phone)} · {patient.email}</p>
                <p className="mt-1 text-sm text-brand-dark/60">
                  {calculateAge(patient.date_of_birth)} · {formatLabel(patient.gender)} · Joined {formatDate(patient.created_date)}
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-brand-dark/70">{patient.appointment_count} appointments</span>
                  <span className="font-medium">{formatCents(patient.total_spent_cents)}</span>
                </div>
                <p className="mt-1 text-sm text-brand-dark/60">Last appointment: {formatDate(patient.last_appointment_date)}</p>
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
                onClick={() => onFiltersChange({ page: data.page - 1 })}
              >
                Previous
              </button>
              <button
                className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-brand-bg transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold disabled:opacity-40 disabled:hover:border-brand-bg/20 disabled:hover:bg-transparent disabled:hover:text-brand-bg"
                disabled={data.page * data.page_size >= data.total}
                onClick={() => onFiltersChange({ page: data.page + 1 })}
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
