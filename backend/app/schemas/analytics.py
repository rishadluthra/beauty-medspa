"""Response schemas for the Analytics Dashboard page.

Each model mirrors the return shape of the correspondingly-named function
in `app.repositories.analytics`; these are what gets serialized to JSON
for the frontend charts/stat tiles. Money fields (suffixed `_cents`) are
always integer cents, never floats.
"""

from pydantic import BaseModel


class OverviewStats(BaseModel):
    """Top-line KPIs shown in the dashboard header. See `get_overview_stats`."""

    total_patients: int
    total_revenue_cents: int
    total_appointments: int
    avg_transaction_cents: int
    new_patients_last_30_days: int
    cancellation_rate: float  # cancelled / total appointments, 0.0-1.0
    # Of patients with at least one non-cancelled appointment, the fraction
    # with two or more -- i.e. did they come back. 0.0-1.0.
    repeat_patient_rate: float


class RevenuePoint(BaseModel):
    """One point in the monthly revenue time series. See `get_revenue_over_time`."""

    period: str  # "YYYY-MM"
    revenue_cents: int


class SourceBreakdownItem(BaseModel):
    """Patient count for one marketing source. See `get_patients_by_source`."""

    source: str
    patient_count: int


class TopServiceItem(BaseModel):
    """A service's booking count and revenue. See `get_top_services`."""

    service_id: str
    service_name: str
    booking_count: int
    revenue_cents: int


class ProviderUtilizationItem(BaseModel):
    """A provider's appointment count and revenue. See `get_provider_utilization`."""

    provider_id: str
    provider_name: str
    appointment_count: int
    revenue_cents: int


class AppointmentStatusItem(BaseModel):
    """Appointment count for one status value. See `get_appointment_status_breakdown`."""

    status: str
    count: int


class PaymentStatusItem(BaseModel):
    """Payment count for one status value. See `get_payment_status_breakdown`."""

    status: str
    count: int


class GenderCount(BaseModel):
    """Patient count for one gender value. See `get_patient_demographics`."""

    gender: str
    count: int


class AgeBucketCount(BaseModel):
    """Patient count for one 10-year age bucket. See `get_patient_demographics`."""

    bucket: str
    count: int


class DemographicsResponse(BaseModel):
    """Combined demographics breakdown. See `get_patient_demographics`."""

    gender_breakdown: list[GenderCount]
    age_buckets: list[AgeBucketCount]
