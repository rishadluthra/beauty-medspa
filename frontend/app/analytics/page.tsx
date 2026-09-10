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
 */

import { useQuery } from "@tanstack/react-query";

import { AppointmentStatusChart } from "@/components/analytics/AppointmentStatusChart";
import { DemographicsChart } from "@/components/analytics/DemographicsChart";
import { KpiCard } from "@/components/analytics/KpiCard";
import { PaymentStatusChart } from "@/components/analytics/PaymentStatusChart";
import { ProviderUtilizationChart } from "@/components/analytics/ProviderUtilizationChart";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { SourceBreakdownChart } from "@/components/analytics/SourceBreakdownChart";
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      {isLoading && <p className="text-brand-sage">Loading overview…</p>}
      {isError && <p className="text-rust">Could not load analytics overview.</p>}

      {overview && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total Patients" value={overview.total_patients.toLocaleString()} />
          <KpiCard label="Total Revenue" value={formatCents(overview.total_revenue_cents)} />
          <KpiCard label="Total Appointments" value={overview.total_appointments.toLocaleString()} />
          <KpiCard label="Avg. Transaction" value={formatCents(overview.avg_transaction_cents)} />
          <KpiCard label="New Patients (30d)" value={overview.new_patients_last_30_days.toLocaleString()} />
          <KpiCard label="Cancellation Rate" value={`${(overview.cancellation_rate * 100).toFixed(1)}%`} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <RevenueChart />
        <SourceBreakdownChart />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TopServicesChart />
        <ProviderUtilizationChart />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TopServicesRevenueChart />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AppointmentStatusChart />
        <PaymentStatusChart />
      </div>

      <DemographicsChart />
    </div>
  );
}
