"use client";

/**
 * Analytics Dashboard page (`/analytics`) — the second of the two pages
 * required by the spec. Composes a row of top-line KPI cards (fetched here,
 * via `api.getOverview`) together with every analytics chart component.
 *
 * Each chart component (RevenueChart, SourceBreakdownChart, etc.) fetches
 * its own data independently via its own `useQuery` call rather than
 * receiving data as props from this page. That means one chart's slow
 * query or fetch error doesn't block or break the others — each section of
 * the dashboard loads and fails independently.
 *
 * Three things that used to be here were removed, not just visually
 * demoted:
 *  - The "New Patients (30d)" KPI always read 0 -- it compared patient
 *    creation dates against the real `datetime.utcnow()`, but every other
 *    "today"-relative view in this app is anchored to the dataset's own
 *    reference date instead (see the backend's `get_reference_now`), since
 *    this is a frozen seed dataset far behind the real current date. This
 *    one never got that treatment. Removed outright, along with its
 *    backend field, rather than patched, since nothing else depended on it.
 *  - The Payment Status pie chart: `Payment.status` in this dataset is
 *    100% "paid" (verified live), so it could only ever render as one
 *    single-color circle.
 *  - The Appointment Status pie chart, per direct request.
 *  For both charts, the backend endpoint/repository function was left in
 *  place (only the dead frontend chart + its now-unused API client method
 *  were removed) -- still a live, tested, reusable query worth keeping for
 *  a future AI/NL-query consumer even with no chart currently on top of it.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { BuildCustomAnalyticsModal } from "@/components/analytics/BuildCustomAnalyticsModal";
import { CustomReportCard } from "@/components/analytics/CustomReportCard";
import { DemographicsChart } from "@/components/analytics/DemographicsChart";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ProviderUtilizationChart } from "@/components/analytics/ProviderUtilizationChart";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { SourceBreakdownChart } from "@/components/analytics/SourceBreakdownChart";
import { Toast } from "@/components/analytics/Toast";
import { TopServicesChart } from "@/components/analytics/TopServicesChart";
import { TopServicesRevenueChart } from "@/components/analytics/TopServicesRevenueChart";
import { api } from "@/lib/api";
import { formatCents } from "@/lib/format";

/** Top-level route component for `/analytics`. */
export default function AnalyticsPage() {
  // KPI summary is fetched here (rather than inside a child component)
  // since it feeds the row of KpiCards rendered directly by this page.
  const { data: overview, isLoading, isError } = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: api.getOverview,
  });

  const [isBuildModalOpen, setBuildModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const { data: customReports } = useQuery({
    queryKey: ["custom-reports"],
    queryFn: api.getCustomReports,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        {/*
          Self-serve pivot builder (metric x dimension x time grain) --
          lets a manager slice the data their own way (e.g. "revenue by
          provider by month") instead of being limited to the fixed set
          of charts below. Saved reports are shared across every viewer
          (this app has no per-user auth), so any report built here is
          visible to everyone on their next visit to this page.
        */}
        <button
          type="button"
          onClick={() => setBuildModalOpen(true)}
          className="rounded-full bg-brand-gold px-4 py-1.5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-gold-dark"
        >
          + Build Custom Analytics
        </button>
      </div>

      {isBuildModalOpen && (
        <BuildCustomAnalyticsModal
          onClose={() => setBuildModalOpen(false)}
          onCreated={() => setToast({ message: "Custom graph created", variant: "success" })}
          onFailed={() => setToast({ message: "Failed to create custom graph", variant: "error" })}
        />
      )}
      {toast && <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />}

      {isLoading && <p className="text-brand-bg/70">Loading overview…</p>}
      {isError && <p className="text-coral">Could not load analytics overview.</p>}

      {overview && (
        // `md:grid-cols-3` (no further lg override) gives two clean, even
        // rows of 3 for these 6 KPIs from medium screens up through large
        // ones, rather than an uneven 4-then-2 split. Single column on
        // mobile (not 2) -- a 2-up grid on a narrow phone leaves too
        // little width for a long formatted-currency value (e.g. a
        // six-figure Total Revenue) to fit without overflowing.
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <KpiCard label="Total Patients" value={overview.total_patients.toLocaleString()} />
          {/*
            Retention: of patients who've come in at least once, what
            share came back for a second (non-cancelled) visit. Placed
            second, right after the headline patient count, since it's a
            core "how healthy is this business" answer the spec calls out
            explicitly -- not a minor stat to bury at the end of the row.
          */}
          <KpiCard label="Repeat Patient Rate" value={`${(overview.repeat_patient_rate * 100).toFixed(1)}%`} />
          <KpiCard label="Total Revenue" value={formatCents(overview.total_revenue_cents)} />
          <KpiCard label="Total Appointments" value={overview.total_appointments.toLocaleString()} />
          <KpiCard label="Avg. Transaction" value={formatCents(overview.avg_transaction_cents)} />
          <KpiCard label="Cancellation Rate" value={`${(overview.cancellation_rate * 100).toFixed(1)}%`} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <RevenueChart />
        <SourceBreakdownChart />
      </div>

      {/*
        Paired by similar shape/height (both horizontal bar charts whose
        height scales with the same ~10-provider/~10-service row count),
        not by topic -- a tall chart next to a short one would leave one
        side of the row with a lot of empty space underneath it.
      */}
      <div className="grid gap-4 md:grid-cols-2">
        <TopServicesChart />
        <ProviderUtilizationChart />
      </div>

      {/*
        Full width rather than sharing a `md:grid-cols-2` row -- with
        Appointment Status removed, this was left as the one odd chart out
        with no natural same-height partner; giving it the full row width
        instead of leaving an empty, unpaired half-row also means its own
        (potentially long) service-name labels and dollar-amount bars have
        more room to breathe.
      */}
      <TopServicesRevenueChart />

      <DemographicsChart />

      {/*
        Custom reports always render last, after every fixed chart --
        per direct feedback, they were landing visually "in the middle" of
        the page when placed just before Demographics (still true even
        though they were already the last *fixed* section in source order),
        since Demographics itself came after them. Creation order (newest
        last) so a freshly-built report appears right where the person who
        just built it is already looking: the very bottom of the page.
      */}
      {customReports && customReports.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {customReports.map((report) => (
            <CustomReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
