"use client";

/**
 * Rebooking Opportunities — the front desk's outreach worklist: patients who have
 * been seen before but have nothing scheduled going forward. Unlike every
 * other view on this page (all about *existing* appointments), this is
 * actionable in the opposite direction -- these are the people worth
 * calling to get back on the books. Defaults to most-recently-seen first (see
 * the backend's `list_rebooking_opportunities` for why), so the most promising
 * calls are at the top rather than buried under years-stale leads -- every
 * column except Phone is click-to-sort, the same as every other table in this app.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { SortableTableHeader } from "@/components/SortableTableHeader";
import { api, patientDetailHref } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/format";
import type { PatientDetailContext } from "@/lib/types";

const PAGE_SIZE = 25;
const DEFAULT_SORT = "last_appointment_date";
const DEFAULT_SORT_DIR = "desc";

export function RebookingOpportunitiesTable() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [sortDir, setSortDir] = useState(DEFAULT_SORT_DIR);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", "rebooking-opportunities", page, sort, sortDir],
    queryFn: () => api.getRebookingOpportunities({ page, page_size: PAGE_SIZE, sort, sort_dir: sortDir }),
  });

  function handleSort(key: string) {
    if (sort === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  // Same sort/sort_dir the worklist is currently showing -- so the detail page's
  // Previous/Next buttons walk this exact order.
  const context: PatientDetailContext = { kind: "rebooking", sort, sortDir };

  return (
    <div className="space-y-4">
      {data && (
        <p className="text-sm text-brand-bg/70">
          {data.total} patient{data.total === 1 ? "" : "s"} seen before with nothing scheduled as of {formatDate(data.reference_date)}
        </p>
      )}

      {isLoading && <p className="text-brand-bg/70">Loading rebooking list…</p>}
      {isError && <p className="text-coral">Could not load the rebooking list. Please try again.</p>}

      {data && (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-brand-gold/10 bg-brand-bg text-brand-dark shadow-lg shadow-brand-gold/10 sm:block">
            <table className="w-full text-sm">
              <thead className="text-left text-brand-dark">
                <tr className="border-b border-brand-gold/20">
                  <SortableTableHeader label="Name" sortKey="name" activeSort={sort} activeDir={sortDir} onSort={handleSort} />
                  <SortableTableHeader label="Phone" activeSort={sort} activeDir={sortDir} onSort={handleSort} />
                  <SortableTableHeader label="Email" sortKey="email" activeSort={sort} activeDir={sortDir} onSort={handleSort} />
                  <SortableTableHeader label="Last Appointment" sortKey="last_appointment_date" activeSort={sort} activeDir={sortDir} onSort={handleSort} />
                  <SortableTableHeader label="Last Service" sortKey="last_service_name" activeSort={sort} activeDir={sortDir} onSort={handleSort} />
                  <SortableTableHeader label="Provider" sortKey="last_provider_name" activeSort={sort} activeDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark/5 text-brand-dark">
                {/* Empty-state row. colSpan={6} must match the number of <th> columns above. */}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-brand-sage">
                      No patients currently need rebooking.
                    </td>
                  </tr>
                )}
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => router.push(patientDetailHref(item.id, context))}
                    className="cursor-pointer transition-colors hover:bg-brand-gold/5"
                  >
                    <td className="whitespace-nowrap px-4 py-3.5">{item.first_name} {item.last_name}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{formatPhone(item.phone)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{item.email}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{formatDate(item.last_appointment_date)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{item.last_service_name}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">{item.last_provider_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile equivalent of the table above — same rows, same click-through, laid out as cards. */}
          <div className="space-y-2 sm:hidden">
            {data.items.length === 0 && (
              <p className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-6 text-center text-brand-sage shadow-lg shadow-brand-gold/10">
                No patients currently need rebooking.
              </p>
            )}
            {data.items.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(patientDetailHref(item.id, context))}
                className="cursor-pointer rounded-2xl border border-brand-gold/10 bg-brand-bg p-4 text-brand-dark shadow-lg shadow-brand-gold/10"
              >
                <p className="font-medium">{item.first_name} {item.last_name}</p>
                <p className="mt-1 text-sm text-brand-dark/60">{formatPhone(item.phone)} · {item.email}</p>
                <p className="mt-2 text-sm font-medium">Last seen {formatDate(item.last_appointment_date)}</p>
                <p className="mt-1 text-sm text-brand-dark/60">{item.last_service_name} with {item.last_provider_name}</p>
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
