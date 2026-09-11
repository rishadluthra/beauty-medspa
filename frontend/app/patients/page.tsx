"use client";

/**
 * Patients page (`/patients`) — one of the two pages required by the spec.
 * Two views live here, switched by a tab, rather than one combined table:
 *
 * - "Upcoming Appointments" (the default): a front-desk-facing view of
 *   patients with a scheduled future appointment, surfacing who needs a
 *   same-day confirmation call or has an unpaid appointment on file.
 * - "All Patients": the full searchable/filterable/sortable roster (what
 *   this page used to be exclusively).
 *
 * These are different enough in shape and purpose (one row per upcoming
 * appointment vs. the entire patient base) that combining them into a
 * single table with a filter would have made neither view fast to scan.
 */

import { useState } from "react";

import { PatientTable } from "@/components/patients/PatientTable";
import { UpcomingAppointmentsTable } from "@/components/patients/UpcomingAppointmentsTable";

const TABS = [
  { key: "upcoming", label: "Upcoming Appointments" },
  { key: "all", label: "All Patients" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Top-level route component for `/patients`. */
export default function PatientsPage() {
  const [tab, setTab] = useState<TabKey>("upcoming");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-brand-bg">Patients</h1>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-brand-bg text-brand-dark shadow-lg shadow-brand-gold/10"
                : "text-brand-bg/60 hover:text-brand-bg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "upcoming" ? <UpcomingAppointmentsTable /> : <PatientTable />}
    </div>
  );
}
