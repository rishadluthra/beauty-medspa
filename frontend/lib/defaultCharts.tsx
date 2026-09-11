/**
 * Registry of the 7 fixed default charts, keyed the same way the backend's
 * `app.repositories.custom_views.DEFAULT_CHART_KEYS` is -- what lets a
 * `"default:<key>"` chart ref (in the "All Graphs" order or a custom
 * view's chart_refs) resolve to an actual component to render. Must stay
 * in sync with that Python list; there's no shared codegen, same as every
 * other enum-ish list shared between the two.
 */

import { PatientsByAgeGroupChart } from "@/components/analytics/PatientsByAgeGroupChart";
import { PatientsByGenderChart } from "@/components/analytics/PatientsByGenderChart";
import { ProviderUtilizationChart } from "@/components/analytics/ProviderUtilizationChart";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { SourceBreakdownChart } from "@/components/analytics/SourceBreakdownChart";
import { TopServicesChart } from "@/components/analytics/TopServicesChart";
import { TopServicesRevenueChart } from "@/components/analytics/TopServicesRevenueChart";

export interface DefaultChartEntry {
  key: string;
  label: string;
  Component: React.ComponentType;
}

// `patients_by_source` and `patients_by_gender` sit adjacent here
// deliberately -- per direct request, those two specific charts pair up
// into one row instead of each taking a full row (see the Analytics
// page's `PAIRED_DEFAULT_KEYS` rendering rule, which pairs them only when
// they land next to each other in the active order -- true here by
// default, but also still true if someone drags something else in
// between, at which point they simply render full-width again).
export const DEFAULT_CHARTS: DefaultChartEntry[] = [
  { key: "revenue_over_time", label: "Revenue Over Time", Component: RevenueChart },
  { key: "patients_by_source", label: "How Patients Find Us", Component: SourceBreakdownChart },
  { key: "patients_by_gender", label: "Patients by Gender", Component: PatientsByGenderChart },
  { key: "top_services_by_bookings", label: "Top Services by Bookings", Component: TopServicesChart },
  { key: "provider_utilization", label: "Provider Utilization", Component: ProviderUtilizationChart },
  { key: "top_services_by_revenue", label: "Top Services by Revenue", Component: TopServicesRevenueChart },
  { key: "patients_by_age_group", label: "Patients by Age Group", Component: PatientsByAgeGroupChart },
];

const BY_KEY = new Map(DEFAULT_CHARTS.map((entry) => [entry.key, entry]));

/** Looks up a default chart's registry entry by its key. `undefined` for an unrecognized key. */
export function getDefaultChart(key: string): DefaultChartEntry | undefined {
  return BY_KEY.get(key);
}
