from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_patients: int
    total_revenue_cents: int
    total_appointments: int
    avg_transaction_cents: int
    new_patients_last_30_days: int
    cancellation_rate: float


class RevenuePoint(BaseModel):
    period: str
    revenue_cents: int


class SourceBreakdownItem(BaseModel):
    source: str
    patient_count: int


class TopServiceItem(BaseModel):
    service_id: str
    service_name: str
    booking_count: int
    revenue_cents: int


class ProviderUtilizationItem(BaseModel):
    provider_id: str
    provider_name: str
    appointment_count: int
    revenue_cents: int


class AppointmentStatusItem(BaseModel):
    status: str
    count: int


class GenderCount(BaseModel):
    gender: str
    count: int


class AgeBucketCount(BaseModel):
    bucket: str
    count: int


class DemographicsResponse(BaseModel):
    gender_breakdown: list[GenderCount]
    age_buckets: list[AgeBucketCount]
