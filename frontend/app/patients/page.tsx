"use client";

/**
 * Front Desk page (route: `/patients` -- see `app/layout.tsx` for why the
 * nav label and the route path deliberately differ) — one of the two pages
 * required by the spec. Several views live here, switched by a tab, rather
 * than one combined table:
 *
 * - "Today's Appointments" (the default): the front desk's actual first
 *   question each day — who's coming in, when, for what, with whom. One
 *   row per scheduled service, sorted by time. A compact "Coming Up" strip
 *   underneath gives a quick glance at the next few appointments beyond
 *   today, without needing a whole separate tab for it (see below).
 * - "Calendar": a month-at-a-glance density grid, for spotting a heavy day
 *   before drilling into it, rather than paging through days one at a time.
 * - "Walk-In Availability": pick a service and a moment, see which
 *   providers are free to take a walk-in right now (and when the busy ones
 *   free up) -- a different question again, about open capacity rather
 *   than existing appointments.
 * - "All Patients": the full searchable/filterable/sortable roster (what
 *   this page used to be exclusively).
 * - "Rebooking Opportunities": patients who have been seen before but have
 *   nothing scheduled going forward -- an outreach worklist, the one view
 *   here about who *isn't* on the books rather than who is.
 *
 * There used to be a separate "Upcoming Appointments" tab (one row per
 * patient, their soonest booking after today) here too. It was retired
 * once the Calendar view shipped: Calendar already covers deep drill-down
 * into any future day, so a whole paginated tab over the same underlying
 * data added little beyond what the "Coming Up" strip below now covers in
 * a glance. The `list_upcoming_appointments` backend query itself is kept
 * (see `ComingUpStrip`) -- only the full-page presentation of it is gone.
 *
 * The tab row also hosts each active tab's own filter control, right-
 * aligned against the left-aligned tab selector via `justify-between`, NOT
 * a separate row below the tabs -- a row that only exists for a filter
 * used to push every tab's content down an extra row even when that tab
 * had nothing to do with filtering. Both `patientFilters` (All Patients)
 * and `todayProviderId` (Today's Appointments) are owned here rather than
 * inside their respective table components specifically so their filter
 * controls (`PatientFilters`, `ProviderFilterSelect`) can be rendered in
 * this one shared row while the table components themselves stay plain
 * controlled consumers of that same state. `PatientFilters` and
 * `ProviderFilterSelect` deliberately share one visual style
 * (`FILTER_PILL_CLASSNAME`) now that they can appear in the same row, so
 * they read as one consistent control, not two different-looking ones.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { CalendarView } from "@/components/patients/CalendarView";
import { PatientFilters } from "@/components/patients/PatientFilters";
import { PatientTable } from "@/components/patients/PatientTable";
import { ProviderFilterSelect } from "@/components/patients/ProviderFilterSelect";
import { RebookingOpportunitiesTable } from "@/components/patients/RebookingOpportunitiesTable";
import { TodaysAppointmentsTable } from "@/components/patients/TodaysAppointmentsTable";
import { WalkInAvailability } from "@/components/patients/WalkInAvailability";
import type { PatientQueryParams } from "@/lib/api";

const TABS = [
  { key: "today", label: "Today's Appointments" },
  { key: "calendar", label: "Calendar" },
  { key: "walkin", label: "Walk-In Availability" },
  { key: "all", label: "All Patients" },
  { key: "rebooking", label: "Rebooking Opportunities" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const PATIENT_FILTERS_PAGE_SIZE = 25;

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((t) => t.key === value);
}

/**
 * Top-level route component for `/patients`. Wrapped in `Suspense` because it reads
 * `useSearchParams()` (for the `?tab=` param above) -- required by Next.js for this
 * route to still be statically prerendered rather than opting the whole page into
 * client-side-only rendering.
 */
export default function PatientsPage() {
  return (
    <Suspense fallback={null}>
      <PatientsPageContent />
    </Suspense>
  );
}

function PatientsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  // The active tab lives in the URL (`?tab=...`), not just local state, so that clicking
  // "Back to Front Desk" from a patient's detail page (see that page's `backHref`) can
  // return to the specific tab the agent was actually on -- previously this page always
  // mounted back on "Today's Appointments" regardless of where the agent had navigated
  // from.
  const [tab, setTabState] = useState<TabKey>(isTabKey(tabParam) ? tabParam : "today");

  const setTab = (key: TabKey) => {
    setTabState(key);
    router.replace(`/patients?tab=${key}`, { scroll: false });
  };
  const [patientFilters, setPatientFilters] = useState<PatientQueryParams>({
    page: 1,
    page_size: PATIENT_FILTERS_PAGE_SIZE,
    sort: "name",
  });
  const [todayProviderId, setTodayProviderId] = useState<string | undefined>(undefined);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-brand-bg">Front Desk</h1>

      <div className="flex flex-wrap items-center justify-between gap-2">
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

        {tab === "today" && <ProviderFilterSelect value={todayProviderId} onChange={setTodayProviderId} />}
        {tab === "all" && (
          <PatientFilters
            filters={patientFilters}
            onChange={(next) => setPatientFilters((prev) => ({ ...prev, ...next, page: 1 }))}
          />
        )}
      </div>

      {tab === "today" && <TodaysAppointmentsTable providerId={todayProviderId} />}
      {tab === "calendar" && <CalendarView />}
      {tab === "walkin" && <WalkInAvailability />}
      {tab === "all" && (
        <PatientTable
          filters={patientFilters}
          onFiltersChange={(next) => setPatientFilters((prev) => ({ ...prev, ...next }))}
        />
      )}
      {tab === "rebooking" && <RebookingOpportunitiesTable />}
    </div>
  );
}
