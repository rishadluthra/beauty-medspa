/**
 * Typed fetch-wrapper layer over the FastAPI backend.
 *
 * Every function exported on the `api` object below maps 1:1 to a single
 * backend endpoint (same path, same response shape as the corresponding
 * type in `./types`). Callers (mostly `useQuery` hooks in components/pages)
 * should always go through `api.*` rather than calling `fetch` directly, so
 * this file stays the one place that knows about base URLs, query-string
 * building, and error handling for HTTP calls to the backend.
 */

import type {
  AvailabilityResponse,
  CalendarMonthResponse,
  DemographicsResponse,
  OverviewStats,
  PatientDetailContext,
  PatientDetailResponse,
  PatientListResponse,
  ProviderListResponse,
  ProviderUtilizationItem,
  RebookingOpportunitiesResponse,
  RevenuePoint,
  ServiceListResponse,
  SourceBreakdownItem,
  TodaysAppointmentsResponse,
  TopServiceItem,
  UpcomingAppointmentsResponse,
} from "./types";

// `NEXT_PUBLIC_*` env vars are inlined into the JS bundle at build time (not
// read at runtime), which is required here since this module is used from
// client components. Falls back to the local backend's default port so
// `npm run dev` works out of the box without extra env setup.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Issues a GET request to `${API_BASE_URL}${path}`, serializing `params` as
 * query-string values (skipping any that are `undefined` or an empty
 * string), and parses the JSON response as `T`. Throws if the response
 * status is not ok.
 */
async function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/** Query/filter/pagination params accepted by `GET /api/patients`. */
export interface PatientQueryParams {
  search?: string;
  source?: string;
  gender?: string;
  /** ISO date string (YYYY-MM-DD), inclusive. */
  created_from?: string;
  /** ISO date string (YYYY-MM-DD), inclusive of the entire day. */
  created_to?: string;
  /** Minimum age in years, inclusive, as of today. */
  age_min?: number;
  /** Maximum age in years, inclusive, as of today. */
  age_max?: number;
  sort?: string;
  page?: number;
  page_size?: number;
}

/**
 * The frontend's full surface of backend calls. Each entry is a thin,
 * typed wrapper around `apiGet` for one endpoint — add a new entry here
 * whenever a new backend endpoint needs to be consumed from the UI.
 */
export const api = {
  /** Fetches a page of the patient table, with optional search/filter/sort. */
  getPatients: (params: PatientQueryParams) => apiGet<PatientListResponse>("/api/patients", { ...params }),
  /** Fetches today's full schedule (the default Patients-page view). `provider_id` narrows to one provider's own schedule. */
  getTodaysAppointments: (params: { page?: number; page_size?: number; provider_id?: string }) =>
    apiGet<TodaysAppointmentsResponse>("/api/patients/today", { ...params }),
  /** Fetches a page of the Upcoming Appointments dashboard (patients scheduled after today). `provider_id` narrows to one provider's own upcoming schedule. */
  getUpcomingAppointments: (params: { page?: number; page_size?: number; provider_id?: string }) =>
    apiGet<UpcomingAppointmentsResponse>("/api/patients/upcoming", { ...params }),
  /** Fetches a page of the Rebooking Opportunities worklist (seen before, nothing scheduled going forward), most-recently-seen first. */
  getRebookingOpportunities: (params: { page?: number; page_size?: number }) =>
    apiGet<RebookingOpportunitiesResponse>("/api/patients/rebooking-opportunities", { ...params }),
  /** Fetches every provider, for populating the schedule views' provider filter. */
  getProviders: () => apiGet<ProviderListResponse>("/api/providers"),
  /** Fetches one calendar month's day-by-day appointment density, for the Calendar view's grid. Omitting `month` defaults to the dataset's reference month. */
  getCalendarMonth: (params: { month?: string }) => apiGet<CalendarMonthResponse>("/api/patients/calendar", { ...params }),
  /** Fetches the full schedule for one specific day, for the Calendar view's day drill-down. */
  getDaySchedule: (params: { date: string; page?: number; page_size?: number; provider_id?: string }) =>
    apiGet<TodaysAppointmentsResponse>("/api/patients/day", { ...params }),
  /** Fetches every service, for populating the walk-in availability checker's service picker. */
  getServices: () => apiGet<ServiceListResponse>("/api/services"),
  /** Checks every provider's availability for a service at a moment (`at` defaults to "right now" against this dataset). */
  getAvailability: (params: { service_id: string; at?: string }) =>
    apiGet<AvailabilityResponse>("/api/availability", { ...params }),
  /**
   * Fetches one patient's full profile plus their complete appointment
   * history, for the Patient Detail page. Resolves to `null` (rather than
   * throwing) when the patient doesn't exist, so the detail page can
   * render a clean "not found" state instead of a generic error.
   *
   * `params`, when given, are the same `ctx`/`sort`/`search`/.../`service_id`/`date`
   * query keys `patientDetailHref` encodes into the URL -- the detail page just
   * forwards its own `useSearchParams()` straight through here rather than
   * re-deriving a typed context, so a Previous/Next hop can never drift from
   * whatever context the agent actually navigated in with.
   */
  getPatientDetail: async (
    id: string, params?: Record<string, string | number | undefined>,
  ): Promise<PatientDetailResponse | null> => {
    const url = new URL(`${API_BASE_URL}/api/patients/${encodeURIComponent(id)}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
      }
    }
    const response = await fetch(url.toString());
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    return response.json() as Promise<PatientDetailResponse>;
  },
  /** Fetches the Analytics page's top-line KPI summary. */
  getOverview: () => apiGet<OverviewStats>("/api/analytics/overview"),
  /** Fetches revenue totals bucketed over time, for the revenue chart. */
  getRevenueOverTime: () => apiGet<RevenuePoint[]>("/api/analytics/revenue-over-time"),
  /** Fetches patient counts grouped by marketing source, for the source-breakdown chart. */
  getPatientsBySource: () => apiGet<SourceBreakdownItem[]>("/api/analytics/patients-by-source"),
  /** Fetches booking/revenue totals per service, for the top-services charts. */
  getTopServices: () => apiGet<TopServiceItem[]>("/api/analytics/top-services"),
  /** Fetches appointment/revenue totals per provider, for the provider-utilization chart. */
  getProviderUtilization: () => apiGet<ProviderUtilizationItem[]>("/api/analytics/provider-utilization"),
  /** Fetches gender and age-bucket breakdowns, for the demographics chart. */
  getDemographics: () => apiGet<DemographicsResponse>("/api/analytics/demographics"),
};

/**
 * Builds the `/patients/{id}` URL for linking to a patient from a specific source list,
 * encoding `context` into the query string with the exact key names
 * `api.getPatientDetail`/the backend expect (`ctx`, `sort`, `search`, ..., `provider_id`,
 * `service_id`, `date`) -- so the destination page's Previous/Next buttons walk that
 * same list's order instead of the global default (see `PatientDetailContext`).
 *
 * Every list/table component that links out to a patient should build its link through
 * this helper rather than a bare `/patients/${id}` template string, so a new list added
 * later doesn't have to reinvent (or risk misspelling) these query param names.
 */
export function patientDetailHref(patientId: string, context?: PatientDetailContext): string {
  const query = new URLSearchParams();
  const set = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  };

  if (context) {
    set("ctx", context.kind);
    if (context.kind === "all") {
      set("sort", context.sort);
      set("search", context.search);
      set("source", context.source);
      set("gender", context.gender);
      set("created_from", context.created_from);
      set("created_to", context.created_to);
      set("age_min", context.age_min);
      set("age_max", context.age_max);
    } else if (context.kind === "today") {
      set("provider_id", context.providerId);
      set("service_id", context.serviceId);
    } else if (context.kind === "day") {
      set("date", context.date);
      set("provider_id", context.providerId);
      set("service_id", context.serviceId);
    }
  }

  const qs = query.toString();
  return `/patients/${encodeURIComponent(patientId)}${qs ? `?${qs}` : ""}`;
}
