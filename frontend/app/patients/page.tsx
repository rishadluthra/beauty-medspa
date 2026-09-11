"use client";

/**
 * Patients page (`/patients`) — one of the two pages required by the spec.
 * Three views live here, switched by a tab, rather than one combined table:
 *
 * - "Today's Appointments" (the default): the front desk's actual first
 *   question each day — who's coming in, when, for what, with whom. One
 *   row per scheduled service, sorted by time.
 * - "Upcoming Appointments": patients with a scheduled appointment after
 *   today, one row per patient (their next visit) — for planning ahead,
 *   not the immediate day-of schedule.
 * - "All Patients": the full searchable/filterable/sortable roster (what
 *   this page used to be exclusively).
 *
 * These are different enough in shape and purpose (today's schedule vs.
 * future bookings vs. the entire patient base) that combining them into
 * one table with a filter would have made none of them fast to scan.
 */

import { useState } from "react";

import { PatientTable } from "@/components/patients/PatientTable";
import { TodaysAppointmentsTable } from "@/components/patients/TodaysAppointmentsTable";
import { UpcomingAppointmentsTable } from "@/components/patients/UpcomingAppointmentsTable";

const TABS = [
  { key: "today", label: "Today's Appointments" },
  { key: "upcoming", label: "Upcoming Appointments" },
  { key: "all", label: "All Patients" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Top-level route component for `/patients`. */
export default function PatientsPage() {
  const [tab, setTab] = useState<TabKey>("today");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-brand-bg">Patients</h1>

      <div className="flex flex-wrap gap-2">
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

      {tab === "today" && <TodaysAppointmentsTable />}
      {tab === "upcoming" && <UpcomingAppointmentsTable />}
      {tab === "all" && <PatientTable />}
    </div>
  );
}
