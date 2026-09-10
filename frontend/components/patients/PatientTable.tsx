"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, type PatientQueryParams } from "@/lib/api";
import { PatientFilters } from "./PatientFilters";

const PAGE_SIZE = 25;

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function PatientTable() {
  const [filters, setFilters] = useState<PatientQueryParams>({ page: 1, page_size: PAGE_SIZE, sort: "name" });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", filters],
    queryFn: () => api.getPatients(filters),
  });

  return (
    <div className="space-y-4">
      <PatientFilters filters={filters} onChange={(next) => setFilters({ ...filters, ...next, page: 1 })} />

      {isLoading && <p className="text-slate-500">Loading patients…</p>}
      {isError && <p className="text-red-600">Could not load patients. Please try again.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Gender</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Created</th>
                  <th className="p-3"># Appointments</th>
                  <th className="p-3">Last Appointment</th>
                  <th className="p-3">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
                      No patients match these filters.
                    </td>
                  </tr>
                )}
                {data.items.map((patient) => (
                  <tr key={patient.id} className="border-t">
                    <td className="p-3">{patient.first_name} {patient.last_name}</td>
                    <td className="p-3 capitalize">{patient.gender}</td>
                    <td className="p-3">{patient.phone}</td>
                    <td className="p-3">{patient.email}</td>
                    <td className="p-3 capitalize">{patient.source}</td>
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
            <span className="text-slate-500">
              Showing {(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded border px-3 py-1 disabled:opacity-40"
                disabled={data.page <= 1}
                onClick={() => setFilters({ ...filters, page: data.page - 1 })}
              >
                Previous
              </button>
              <button
                className="rounded border px-3 py-1 disabled:opacity-40"
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
