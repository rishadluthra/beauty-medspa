/**
 * Shared TypeScript types for the frontend.
 *
 * These interfaces mirror the FastAPI backend's Pydantic response schemas
 * field-for-field (same names, same shapes — cents stay integers, dates stay
 * ISO strings, etc.). There is no codegen tying the two together, so if the
 * backend response schema changes, these types must be updated by hand to
 * match or the frontend will silently drift out of sync with what the API
 * actually returns.
 */

/** A single row in the patient list/table, as returned by `GET /api/patients`. */
export interface PatientListItem {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email: string;
  source: string;
  created_date: string;
  appointment_count: number;
  last_appointment_date: string | null;
  total_spent_cents: number;
}

/** Paginated envelope wrapping a page of {@link PatientListItem} rows. */
export interface PatientListResponse {
  items: PatientListItem[];
  total: number;
  page: number;
  page_size: number;
}

/** Top-level KPI figures shown in the Analytics page's summary cards. */
export interface OverviewStats {
  total_patients: number;
  total_revenue_cents: number;
  total_appointments: number;
  avg_transaction_cents: number;
  new_patients_last_30_days: number;
  cancellation_rate: number;
}

/** One point on the revenue-over-time chart (e.g. one month's total revenue). */
export interface RevenuePoint {
  period: string;
  revenue_cents: number;
}

/** Patient count for a single marketing `source` (e.g. instagram, google). */
export interface SourceBreakdownItem {
  source: string;
  patient_count: number;
}

/** Booking/revenue totals for a single service, used by the top-services charts. */
export interface TopServiceItem {
  service_id: string;
  service_name: string;
  booking_count: number;
  revenue_cents: number;
}

/** Appointment/revenue totals for a single provider, used by the provider-utilization chart. */
export interface ProviderUtilizationItem {
  provider_id: string;
  provider_name: string;
  appointment_count: number;
  revenue_cents: number;
}

/** Count of appointments in a given status (pending/confirmed/cancelled). */
export interface AppointmentStatusItem {
  status: string;
  count: number;
}

/** Count of payments in a given status (pending/paid/failed). */
export interface PaymentStatusItem {
  status: string;
  count: number;
}

/** Patient count for a single gender value, used in the demographics chart. */
export interface GenderCount {
  gender: string;
  count: number;
}

/** Patient count for a single age bucket (e.g. "18-24"), used in the demographics chart. */
export interface AgeBucketCount {
  bucket: string;
  count: number;
}

/** Combined response for `GET /api/analytics/demographics`: gender + age breakdowns. */
export interface DemographicsResponse {
  gender_breakdown: GenderCount[];
  age_buckets: AgeBucketCount[];
}
