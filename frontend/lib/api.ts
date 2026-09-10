import type {
  AppointmentStatusItem,
  DemographicsResponse,
  OverviewStats,
  PatientListResponse,
  ProviderUtilizationItem,
  RevenuePoint,
  SourceBreakdownItem,
  TopServiceItem,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export interface PatientQueryParams {
  search?: string;
  source?: string;
  gender?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

export const api = {
  getPatients: (params: PatientQueryParams) => apiGet<PatientListResponse>("/api/patients", { ...params }),
  getOverview: () => apiGet<OverviewStats>("/api/analytics/overview"),
  getRevenueOverTime: () => apiGet<RevenuePoint[]>("/api/analytics/revenue-over-time"),
  getPatientsBySource: () => apiGet<SourceBreakdownItem[]>("/api/analytics/patients-by-source"),
  getTopServices: () => apiGet<TopServiceItem[]>("/api/analytics/top-services"),
  getProviderUtilization: () => apiGet<ProviderUtilizationItem[]>("/api/analytics/provider-utilization"),
  getAppointmentStatus: () => apiGet<AppointmentStatusItem[]>("/api/analytics/appointment-status"),
  getDemographics: () => apiGet<DemographicsResponse>("/api/analytics/demographics"),
};
