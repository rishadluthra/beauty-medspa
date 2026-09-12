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
  /**
   * Neighboring patient ids for the detail page's Previous/Next buttons -- scoped to
   * whichever source list context (see {@link PatientDetailContext}) the request asked
   * for, or the default global name-sorted order if none was given.
   */
  previous_patient_id: string | null;
  next_patient_id: string | null;
}

/**
 * Which source list a Patient Detail page navigation came from, so its Previous/Next
 * buttons can walk that same list's own order instead of always the global default --
 * see the backend's `PatientListContext` for the full contract. Every list that links to
 * `/patients/{id}` builds one of these and encodes it into the URL's query string
 * (`patientDetailHref` in `lib/api.ts`); the detail page reads it back out and forwards
 * it to `api.getPatientDetail`.
 *
 * There used to be `kind="today"`/`"day"` variants here too. Per client feedback, a
 * Today's Appointments / Calendar schedule row now links to the Appointment Detail page
 * instead (see {@link AppointmentDetailContext}) -- those schedules are one row per
 * scheduled *service*, not per patient, so "next" should mean "the next appointment,"
 * not "the next patient" (who could be the same person twice).
 */
export type PatientDetailContext =
  | {
      kind: "all";
      sort?: string;
      search?: string;
      source?: string;
      gender?: string;
      created_from?: string;
      created_to?: string;
      age_min?: number;
      age_max?: number;
      min_total_spent_cents?: number;
    }
  | { kind: "rebooking" };

/**
 * Which schedule window (Today's Appointments, or a specific Calendar day) a schedule
 * row navigation came from, so the Appointment Detail page's Previous/Next buttons walk
 * that same schedule -- see the backend's `ScheduleContext`. `serviceId` identifies the
 * exact row clicked (an appointment can have more than one service scheduled at
 * different times), used both for ranking and to highlight that row on the destination
 * page. `filterServiceId`/`sort` mirror whatever service filter and sort order the
 * schedule view itself currently has active (see `ScheduleFilterParams` in `lib/api.ts`)
 * -- named `filterServiceId`, not `serviceId`, to stay distinct from the clicked-row
 * `serviceId` above (the backend keeps the same distinction: `filter_service_id` vs.
 * `service_id`). Encoded into the URL by `appointmentDetailHref` in `lib/api.ts`.
 */
export type AppointmentDetailContext =
  | { kind: "today"; providerId?: string; filterServiceId?: string; sort?: string; serviceId: number }
  | { kind: "day"; date: string; providerId?: string; filterServiceId?: string; sort?: string; serviceId: number };

/** One scheduled service occurring "today", as returned by `GET /api/patients/today`. One row per service, not per patient. */
export interface TodaysAppointmentItem {
  id: number;
  /** The Appointment this service row belongs to -- what a schedule row links to now (the Appointment Detail page). */
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  phone: string;
  service_name: string;
  provider_name: string;
  start: string;
  end: string;
  status: string;
}

/** Just enough of the patient's identity for the Appointment Detail page's compact summary strip. */
export interface AppointmentPatientSummary {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}

/** Response for `GET /api/appointments/{id}`: one appointment's full detail. */
export interface AppointmentDetailPageResponse {
  id: string;
  status: string;
  appointment_date: string | null;
  created_date: string;
  services: AppointmentServiceItem[];
  payment: PaymentSummary | null;
  patient: AppointmentPatientSummary;
  /** The clicked service row's own start time, for bolding that line among `services` when there's more than one. */
  highlighted_service_start: string | null;
  previous_appointment_id: string | null;
  previous_service_id: number | null;
  next_appointment_id: string | null;
  next_service_id: number | null;
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
  /** The specific appointment/service row that IS this soonest upcoming slot -- what the "Coming Up" strip links to and shows. */
  appointment_id: string;
  service_id: number;
  service_name: string;
  provider_name: string;
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

/** One patient on the Rebooking Opportunities worklist: seen before, nothing scheduled going forward. */
export interface RebookingOpportunitiesItem {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  last_appointment_date: string;
  /** The specific service/provider from that same last visit, for a concrete rebooking pitch. */
  last_service_name: string;
  last_provider_name: string;
}

/** Paginated envelope for the Rebooking Opportunities worklist, sorted most-recently-seen first. */
export interface RebookingOpportunitiesResponse {
  items: RebookingOpportunitiesItem[];
  total: number;
  page: number;
  page_size: number;
  /** The effective "today" this view was computed against — see the backend for why it isn't always the real current date. */
  reference_date: string;
}

/** One day's scheduled (non-cancelled) service count, for the Calendar view's density grid. */
export interface CalendarDayCount {
  date: string;
  count: number;
}

/** Response for `GET /api/patients/calendar`: one month's day-by-day appointment density. */
export interface CalendarMonthResponse {
  /** "YYYY-MM" */
  month: string;
  /** Always covers every day of the month, including zero-count days. */
  days: CalendarDayCount[];
  /** The dataset's effective "today" — see the backend for why it isn't always the real current date. */
  reference_date: string;
}

/** One service, as returned by `GET /api/services`. */
export interface ServiceListItem {
  id: string;
  name: string;
  duration: number; // minutes
  price_cents: number;
}

/** Response for `GET /api/services`: every service, sorted by name. */
export interface ServiceListResponse {
  items: ServiceListItem[];
}

/** One provider's availability for the requested service at the requested moment. */
export interface ProviderAvailability {
  provider_id: string;
  provider_name: string;
  available: boolean;
  /** Only set when `available` is false — when this provider is next free. */
  busy_until: string | null;
}

/** Response for `GET /api/availability`: the walk-in availability check's result. */
export interface AvailabilityResponse {
  service_id: string;
  service_name: string;
  service_duration_minutes: number;
  /** The moment this was checked against. */
  at: string;
  providers: ProviderAvailability[];
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

/** The fixed option lists the "Build Custom Analytics" modal offers -- must stay in sync with the backend's `Metric`/`Dimension`/`TimeGrain` enums. */
export type CustomReportMetric = "appointment_count" | "revenue_cents" | "unique_patient_count";
export type CustomReportDimension = "provider" | "service" | "source" | "gender" | "age_bucket";
export type CustomReportTimeGrain = "month" | "quarter";

/** One (period, dimension value) cell of a custom report's pivot data -- one line/series point on its chart. */
export interface CustomReportPoint {
  period: string; // "YYYY-MM" or "YYYY-Q#", depending on time_grain
  dimension_value: string;
  value: number; // a count, or integer cents for revenue_cents
}

/** A saved self-serve custom report, with its pivot data computed inline. See `POST/GET /api/custom-reports`. */
export interface CustomReport {
  id: string;
  title: string;
  metric: CustomReportMetric;
  dimension: CustomReportDimension;
  time_grain: CustomReportTimeGrain;
  created_date: string;
  data: CustomReportPoint[];
}

/**
 * The "All Graphs" tab's current display order: an ordered list of chart
 * refs, each either `"default:<key>"` (see `lib/defaultCharts.tsx`) or
 * `"custom:<report_id>"`. See `GET/PUT /api/graph-order`.
 */
export interface GraphOrder {
  chart_refs: string[];
}

/** A saved custom view: a named, ordered list of chart refs (same shape as {@link GraphOrder}'s list). See `/api/custom-views`. */
export interface CustomView {
  id: string;
  name: string;
  chart_refs: string[];
  created_date: string;
}
