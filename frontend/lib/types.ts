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

export interface PatientListResponse {
  items: PatientListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface OverviewStats {
  total_patients: number;
  total_revenue_cents: number;
  total_appointments: number;
  avg_transaction_cents: number;
  new_patients_last_30_days: number;
  cancellation_rate: number;
}

export interface RevenuePoint {
  period: string;
  revenue_cents: number;
}

export interface SourceBreakdownItem {
  source: string;
  patient_count: number;
}

export interface TopServiceItem {
  service_id: string;
  service_name: string;
  booking_count: number;
  revenue_cents: number;
}

export interface ProviderUtilizationItem {
  provider_id: string;
  provider_name: string;
  appointment_count: number;
  revenue_cents: number;
}

export interface AppointmentStatusItem {
  status: string;
  count: number;
}

export interface PaymentStatusItem {
  status: string;
  count: number;
}

export interface GenderCount {
  gender: string;
  count: number;
}

export interface AgeBucketCount {
  bucket: string;
  count: number;
}

export interface DemographicsResponse {
  gender_breakdown: GenderCount[];
  age_buckets: AgeBucketCount[];
}
