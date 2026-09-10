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
  AppointmentStatusItem,
  DemographicsResponse,
  OverviewStats,
  PatientListResponse,
  PaymentStatusItem,
  ProviderUtilizationItem,
  RevenuePoint,
  SourceBreakdownItem,
  TopServiceItem,
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
  /** Fetches appointment counts grouped by status, for the appointment-status chart. */
  getAppointmentStatus: () => apiGet<AppointmentStatusItem[]>("/api/analytics/appointment-status"),
  /** Fetches payment counts grouped by status, for the payment-status chart. */
  getPaymentStatus: () => apiGet<PaymentStatusItem[]>("/api/analytics/payment-status"),
  /** Fetches gender and age-bucket breakdowns, for the demographics chart. */
  getDemographics: () => apiGet<DemographicsResponse>("/api/analytics/demographics"),
};
