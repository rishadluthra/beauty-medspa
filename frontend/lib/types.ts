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
  /** Of patients with at least one non-cancelled appointment, the fraction with two or more. 0.0-1.0. */
  repeat_patient_rate: number;
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

/** One billed service performed during an appointment, with its provider and time window. */
export interface AppointmentServiceItem {
  service_name: string;
  provider_name: string;
  start: string;
  end: string;
  price_cents: number;
}

/** The payment tied to one appointment. Appointments without a payment have none at all. */
export interface PaymentSummary {
  amount_cents: number;
  method: string;
  status: string;
  date: string;
}

/** One appointment in a patient's history: its status, every service performed, and its payment. */
export interface AppointmentDetail {
  id: string;
  status: string;
  /**
   * The actual scheduled visit date/time (earliest of its services' start times) — this
   * is the date to display, not `created_date` (merely when the booking record was
   * entered, which can be unrelated to when the visit is/was scheduled). `null` if the
   * appointment has no services scheduled yet.
   */
  appointment_date: string | null;
  created_date: string;
  services: AppointmentServiceItem[];
  payment: PaymentSummary | null;
}

/** Full patient profile for the detail page — includes fields (like `address`) the table omits. */
export interface PatientDetail {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  address: string;
  phone: string;
  email: string;
  source: string;
  created_date: string;
  appointment_count: number;
  last_appointment_date: string | null;
  total_spent_cents: number;
}

/** Response for `GET /api/patients/{id}`: the profile plus the full appointment history. */
export interface PatientDetailResponse {
  patient: PatientDetail;
  appointments: AppointmentDetail[];
  /** Neighboring patient ids in the default name-sorted order, for the detail page's Previous/Next buttons. */
  previous_patient_id: string | null;
  next_patient_id: string | null;
}

/** One scheduled service occurring "today", as returned by `GET /api/patients/today`. One row per service, not per patient. */
export interface TodaysAppointmentItem {
  id: number;
  patient_id: string;
  patient_name: string;
  phone: string;
  service_name: string;
  provider_name: string;
  start: string;
  end: string;
  status: string;
}

/** Paginated envelope for the Today's Appointments dashboard. */
export interface TodaysAppointmentsResponse {
  items: TodaysAppointmentItem[];
  total: number;
  page: number;
  page_size: number;
  reference_date: string;
}

/** One row in the Upcoming Appointments dashboard, as returned by `GET /api/patients/upcoming`. */
export interface UpcomingPatientItem {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  email: string;
  upcoming_appointment_date: string;
  appointment_status: string;
}

/** Paginated envelope for the Upcoming Appointments dashboard. */
export interface UpcomingAppointmentsResponse {
  items: UpcomingPatientItem[];
  total: number;
  page: number;
  page_size: number;
  /** The effective "today" this view was computed against — see the backend for why it isn't always the real current date. */
  reference_date: string;
}

/** One provider, as returned by `GET /api/providers`. */
export interface ProviderListItem {
  id: string;
  first_name: string;
  last_name: string;
}

/** Response for `GET /api/providers`: every provider, sorted by name. */
export interface ProviderListResponse {
  items: ProviderListItem[];
}
