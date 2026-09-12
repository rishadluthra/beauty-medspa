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
 * had nothing to do with filtering. `patientFilters` (All Patients),
 * `todayFilters` (Today's Appointments), and `calendarFilters` (Calendar's
 * Day View) are all owned here rather than inside their respective table
 * components specifically so their filter controls (`PatientFilters`,
 * `ScheduleFilters`) can be rendered in this one shared row while the table
 * components themselves stay plain controlled consumers of that same
 * state. `PatientFilters` and `ScheduleFilters` deliberately share one
 * visual style (`FILTER_PILL_CLASSNAME`) now that they can appear in the
 * same row, so they read as one consistent control, not two different-
 * looking ones. `calendarSelectedDate` is lifted here too (not just
 * `calendarFilters`) purely so this row knows whether Calendar is
 * currently showing its Day View -- filtering only makes sense once a
 * specific day's schedule is on screen, not the month grid itself.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { CalendarView } from "@/components/patients/CalendarView";
import { PatientFilters } from "@/components/patients/PatientFilters";
import { PatientTable } from "@/components/patients/PatientTable";
import { RebookingOpportunitiesTable } from "@/components/patients/RebookingOpportunitiesTable";
import { ScheduleFilters } from "@/components/patients/ScheduleFilters";
import { TodaysAppointmentsTable } from "@/components/patients/TodaysAppointmentsTable";
import { WalkInAvailability } from "@/components/patients/WalkInAvailability";
import type { PatientQueryParams, ScheduleFilterParams } from "@/lib/api";
import { TABS, type TabKey } from "@/lib/tabs";

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

  // `useState`'s initializer above only runs once, at mount -- it does NOT re-run just
  // because `tabParam` changes later. That's invisible for every navigation that lands on
  // a *different* route (e.g. a patient detail page's "Back to Front Desk" link), since
  // Next.js mounts `PatientsPageContent` fresh there. But the nav's own logo/name link
  // (`href="/patients?tab=today"`, see `app/layout.tsx`) targets this SAME route with only
  // the query string changed -- Next keeps this component instance mounted for that, so
  // without this effect, clicking it from any non-"today" tab updated the URL (confirmed:
  // the address bar did change) while the page kept showing whatever tab was already
  // active. Syncing here whenever the URL's own tab disagrees with local state covers that
  // case (and browser back/forward) without affecting `setTab` below, which already keeps
  // both in agreement itself.
  useEffect(() => {
    if (isTabKey(tabParam) && tabParam !== tab) setTabState(tabParam);
  }, [tabParam, tab]);

  const setTab = (key: TabKey) => {
    setTabState(key);
    router.replace(`/patients?tab=${key}`, { scroll: false });
  };
  const [patientFilters, setPatientFilters] = useState<PatientQueryParams>({
    page: 1,
    page_size: PATIENT_FILTERS_PAGE_SIZE,
    sort: "name",
  });
  const [todayFilters, setTodayFilters] = useState<ScheduleFilterParams>({});
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | undefined>(undefined);
  const [calendarFilters, setCalendarFilters] = useState<ScheduleFilterParams>({});

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-brand-bg">Front Desk</h1>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {/*
            Every tab is its own translucent glass "bubble" now (border +
            soft frosted fill + blur), not just bare text for the
            unselected ones -- the active tab stays obviously distinct by
            being solid/opaque instead of translucent, rather than being
            the only one with any pill shape at all.
          */}
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors ${
                tab === t.key
                  ? "border-brand-bg/20 bg-brand-bg text-brand-dark shadow-lg shadow-brand-gold/10"
                  : "border-brand-bg/20 bg-brand-bg/10 text-brand-bg/70 hover:border-brand-gold hover:bg-brand-bg/20 hover:text-brand-bg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "today" && (
          <ScheduleFilters
            filters={todayFilters}
            onChange={(next) => setTodayFilters((prev) => ({ ...prev, ...next }))}
          />
        )}
        {tab === "calendar" && calendarSelectedDate && (
          <ScheduleFilters
            filters={calendarFilters}
            onChange={(next) => setCalendarFilters((prev) => ({ ...prev, ...next }))}
          />
        )}
        {tab === "all" && (
          <PatientFilters
            filters={patientFilters}
            onChange={(next) => setPatientFilters((prev) => ({ ...prev, ...next }))}
          />
        )}
      </div>

      {tab === "today" && (
        <TodaysAppointmentsTable
          filters={todayFilters}
          onFiltersChange={(next) => setTodayFilters((prev) => ({ ...prev, ...next }))}
        />
      )}
      {tab === "calendar" && (
        <CalendarView
          selectedDate={calendarSelectedDate}
          onSelectedDateChange={setCalendarSelectedDate}
          filters={calendarFilters}
          onFiltersChange={(next) => setCalendarFilters((prev) => ({ ...prev, ...next }))}
        />
      )}
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
