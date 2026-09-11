"use client";

/**
 * Patients page (`/patients`) — one of the two pages required by the spec.
 * Several views live here, switched by a tab, rather than one combined table:
 *
 * - "Today's Appointments" (the default): the front desk's actual first
 *   question each day — who's coming in, when, for what, with whom. One
 *   row per scheduled service, sorted by time. A compact "Coming Up" strip
 *   underneath gives a quick glance at the next few appointments beyond
 *   today, without needing a whole separate tab for it (see below).
 * - "Calendar": a month-at-a-glance density grid, for spotting a heavy day
 *   before drilling into it, rather than paging through days one at a time.
 * - "Needs Rebooking": patients who have been seen before but have nothing
 *   scheduled going forward -- an outreach worklist, the one view here
 *   about who *isn't* on the books rather than who is.
 * - "Walk-In Availability": pick a service and a moment, see which
 *   providers are free to take a walk-in right now (and when the busy ones
 *   free up) -- a different question again, about open capacity rather
 *   than existing appointments.
 * - "All Patients": the full searchable/filterable/sortable roster (what
 *   this page used to be exclusively).
 *
 * There used to be a separate "Upcoming Appointments" tab (one row per
 * patient, their soonest booking after today) here too. It was retired
 * once the Calendar view shipped: Calendar already covers deep drill-down
 * into any future day, so a whole paginated tab over the same underlying
 * data added little beyond what the "Coming Up" strip below now covers in
 * a glance. The `list_upcoming_appointments` backend query itself is kept
 * (see `ComingUpStrip`) -- only the full-page presentation of it is gone.
 */

import { useState } from "react";

import { CalendarView } from "@/components/patients/CalendarView";
import { NeedsRebookingTable } from "@/components/patients/NeedsRebookingTable";
import { PatientTable } from "@/components/patients/PatientTable";
import { TodaysAppointmentsTable } from "@/components/patients/TodaysAppointmentsTable";
import { WalkInAvailability } from "@/components/patients/WalkInAvailability";

const TABS = [
  { key: "today", label: "Today's Appointments" },
  { key: "calendar", label: "Calendar" },
  { key: "rebooking", label: "Needs Rebooking" },
  { key: "walkin", label: "Walk-In Availability" },
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
      {tab === "calendar" && <CalendarView />}
      {tab === "rebooking" && <NeedsRebookingTable />}
      {tab === "walkin" && <WalkInAvailability />}
      {tab === "all" && <PatientTable />}
    </div>
  );
}
