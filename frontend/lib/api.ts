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

import type { PatientFilterCondition } from "./patientFilters";
import type {
  AppointmentDetailContext,
  AppointmentDetailPageResponse,
  AvailabilityResponse,
  CalendarMonthResponse,
  CustomReport,
  CustomReportDimension,
  CustomReportMetric,
  CustomReportTimeGrain,
  CustomView,
  DemographicsResponse,
  GraphOrder,
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
async function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
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

/**
 * Issues a POST request with a JSON body to `${API_BASE_URL}${path}` and parses the JSON
 * response as `T`. Used only by the "Build Custom Analytics" feature -- see `app.main`'s
 * CORS `allow_methods` for why this is the one write path this otherwise read-only API
 * exposes. Throws (with the backend's own `detail` message when present, e.g. the saved-
 * report soft cap) if the response status is not ok.
 */
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/** Issues a DELETE request to `${API_BASE_URL}${path}`. Throws if the response status is not ok. */
async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
}

/** Issues a PUT request with a JSON body -- the "replace this whole ordered list" shape used by reordering. */
async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Filter/sort params shared by Today's Appointments and the Calendar day drill-down --
 * accepted by `GET /api/patients/today` and `GET /api/patients/day`. Owned by
 * `ScheduleFilters` (the dropdown that edits them) and threaded through by whichever
 * page/component holds the current filter state.
 */
export interface ScheduleFilterParams {
  provider_id?: string;
  service_id?: string;
  /** "time" (default, chronological), "patient_name", "provider_name", "service_name", or "status". */
  sort?: string;
  /** "asc" or "desc" -- set via column-header click-to-sort, not a dropdown (see `ScheduleTable`). */
  sort_dir?: string;
}

/**
 * Query/filter/pagination params accepted by `GET /api/patients`. `filters` is the
 * generic, per-column-type condition list (see `lib/patientFilters.ts`) that replaced
 * this endpoint's earlier fixed named params (`source`, `age_min`/`age_max`, etc.) --
 * `search` stays its own separate top-level param (the quick-search box), not folded
 * into `filters`, since it's a fast fuzzy lookup, not a structured per-column condition.
 */
export interface PatientQueryParams {
  search?: string;
  filters?: PatientFilterCondition[];
  sort?: string;
  /** "asc" or "desc" -- a genuine per-request choice now that every column is click-to-sort, not baked into `sort` itself. */
  sort_dir?: string;
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
  getPatients: (params: PatientQueryParams) => {
    // `filters` is an array of objects -- apiGet's query-string builder only handles
    // primitive values, so it's JSON-encoded into a single `filters` param here (the
    // exact shape `_parse_filters` on the backend expects), rather than teaching the
    // shared query-string builder about one endpoint's own array-of-objects param.
    const { filters, ...rest } = params;
    return apiGet<PatientListResponse>("/api/patients", {
      ...rest,
      filters: filters && filters.length > 0 ? JSON.stringify(filters) : undefined,
    });
  },
  /** Fetches today's full schedule (the default Patients-page view). `provider_id`/`service_id` narrow to one provider's/service's own schedule; `sort` picks the display order. */
  getTodaysAppointments: (params: { page?: number; page_size?: number } & ScheduleFilterParams) =>
    apiGet<TodaysAppointmentsResponse>("/api/patients/today", { ...params }),
  /**
   * Fetches a page of the Upcoming Appointments dashboard (patients scheduled after
   * today). `provider_id` narrows to one provider's own upcoming schedule.
   * `only_tomorrow`, when true, further narrows to just the single day right after
   * today -- what the "Coming Up Tomorrow" strip uses, so its name is actually accurate
   * (without it, "soonest upcoming" can span several days out, not just tomorrow).
   */
  getUpcomingAppointments: (params: { page?: number; page_size?: number; provider_id?: string; only_tomorrow?: boolean }) =>
    apiGet<UpcomingAppointmentsResponse>("/api/patients/upcoming", { ...params }),
  /** Fetches a page of the Rebooking Opportunities worklist (seen before, nothing scheduled going forward). Defaults to most-recently-seen first; `sort`/`sort_dir` pick any other column. */
  getRebookingOpportunities: (params: { page?: number; page_size?: number; sort?: string; sort_dir?: string }) =>
    apiGet<RebookingOpportunitiesResponse>("/api/patients/rebooking-opportunities", { ...params }),
  /** Fetches every provider, for populating the schedule views' provider filter. */
  getProviders: () => apiGet<ProviderListResponse>("/api/providers"),
  /** Fetches one calendar month's day-by-day appointment density, for the Calendar view's grid. Omitting `month` defaults to the dataset's reference month. */
  getCalendarMonth: (params: { month?: string }) => apiGet<CalendarMonthResponse>("/api/patients/calendar", { ...params }),
  /** Fetches the full schedule for one specific day, for the Calendar view's day drill-down. */
  getDaySchedule: (params: { date: string; page?: number; page_size?: number } & ScheduleFilterParams) =>
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
   * `params`, when given, are the same `ctx`/`sort`/`search`/.../`age_max` query keys
   * `patientDetailHref` encodes into the URL -- the detail page just forwards its own
   * `useSearchParams()` straight through here rather than re-deriving a typed context,
   * so a Previous/Next hop can never drift from whatever context the agent actually
   * navigated in with.
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
  /**
   * Fetches one appointment's full detail, for the Appointment Detail page -- the
   * drill-down from a Today's Appointments / Calendar schedule row (see
   * `appointmentDetailHref` for the query params this accepts, forwarded the same way
   * `getPatientDetail` forwards its own). Resolves to `null` on a 404.
   */
  getAppointmentDetail: async (
    id: string, params?: Record<string, string | number | undefined>,
  ): Promise<AppointmentDetailPageResponse | null> => {
    const url = new URL(`${API_BASE_URL}/api/appointments/${encodeURIComponent(id)}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
      }
    }
    const response = await fetch(url.toString());
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    return response.json() as Promise<AppointmentDetailPageResponse>;
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
  /** Fetches every saved custom report, each with its pivot data computed inline. */
  getCustomReports: () => apiGet<CustomReport[]>("/api/custom-reports"),
  /** Saves a new custom report (metric x dimension x time grain) and returns it with its pivot data computed inline. */
  createCustomReport: (params: { title: string; metric: CustomReportMetric; dimension: CustomReportDimension; time_grain: CustomReportTimeGrain }) =>
    apiPost<CustomReport>("/api/custom-reports", params),
  /** Deletes a saved custom report. */
  deleteCustomReport: (id: string) => apiDelete(`/api/custom-reports/${encodeURIComponent(id)}`),
  /** Fetches the "All Graphs" tab's current display order (seeded with the default charts on first read). */
  getGraphOrder: () => apiGet<GraphOrder>("/api/graph-order"),
  /** Replaces the "All Graphs" tab's display order (the reorder modal's save action). */
  setGraphOrder: (chart_refs: string[]) => apiPut<GraphOrder>("/api/graph-order", { chart_refs }),
  /** Fetches every saved custom view, in tab order. */
  getCustomViews: () => apiGet<CustomView[]>("/api/custom-views"),
  /** Saves a new custom view (a named, ordered subset of existing graphs). */
  createCustomView: (params: { name: string; chart_refs: string[] }) => apiPost<CustomView>("/api/custom-views", params),
  /** Replaces one view's chart_refs -- reordering within it, or removing an item from it. */
  updateCustomView: (id: string, chart_refs: string[]) => apiPut<CustomView>(`/api/custom-views/${encodeURIComponent(id)}`, { chart_refs }),
  /** Deletes a saved custom view. */
  deleteCustomView: (id: string) => apiDelete(`/api/custom-views/${encodeURIComponent(id)}`),
};

/**
 * Builds the `/patients/{id}` URL for linking to a patient from a specific source list
 * (All Patients or Rebooking Opportunities), encoding `context` into the query string
 * with the exact key names `api.getPatientDetail`/the backend expect (`ctx`, `sort`,
 * `sort_dir`, `search`, `filters`) -- so the destination page's Previous/Next buttons
 * walk that same list's order instead of the global default (see `PatientDetailContext`).
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
    set("sort", context.sort);
    set("sort_dir", context.sortDir);
    if (context.kind === "all") {
      set("search", context.search);
      if (context.filters && context.filters.length > 0) set("filters", JSON.stringify(context.filters));
    }
  }

  const qs = query.toString();
  return `/patients/${encodeURIComponent(patientId)}${qs ? `?${qs}` : ""}`;
}

/**
 * Builds the `/appointments/{id}` URL for linking to an appointment from a Today's
 * Appointments / Calendar schedule row, encoding `context` into the query string with
 * the exact key names `api.getAppointmentDetail`/the backend expect (`ctx`,
 * `provider_id`, `filter_service_id`, `sort`, `service_id`, `date`) -- so the
 * destination's Previous/Next buttons walk that same schedule window, filtered and
 * sorted the same way (see `AppointmentDetailContext`).
 */
export function appointmentDetailHref(appointmentId: string, context: AppointmentDetailContext): string {
  const query = new URLSearchParams();
  const set = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  };

  set("ctx", context.kind);
  set("provider_id", context.providerId);
  set("filter_service_id", context.filterServiceId);
  set("sort", context.sort);
  set("sort_dir", context.sortDir);
  set("service_id", context.serviceId);
  if (context.kind === "day") set("date", context.date);

  const qs = query.toString();
  return `/appointments/${encodeURIComponent(appointmentId)}${qs ? `?${qs}` : ""}`;
}
