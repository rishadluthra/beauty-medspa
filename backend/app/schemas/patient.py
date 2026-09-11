"""Response schemas for the Patient Table page and the Patient Detail page.

Mirrors the return shapes of `app.repositories.patients.list_patients` and
`.get_patient_detail`; this is what gets serialized to JSON for the
frontend.
"""

from datetime import date, datetime

from pydantic import BaseModel


class PatientListItem(BaseModel):
    """One row in the patient table: demographics plus computed aggregates.

    `appointment_count`, `last_appointment_date`, and `total_spent_cents`
    are aggregated server-side (see `list_patients`), not raw patient
    fields. `total_spent_cents` is lifetime spend from *paid* payments
    only, in integer cents.
    """

    id: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    phone: str
    email: str
    source: str
    created_date: datetime
    appointment_count: int
    last_appointment_date: datetime | None
    total_spent_cents: int


class PatientListResponse(BaseModel):
    """A page of patients plus pagination metadata."""

    items: list[PatientListItem]
    total: int  # total matching rows across all pages, for building pagination controls
    page: int
    page_size: int


class AppointmentServiceItem(BaseModel):
    """One billed service performed during an appointment, with its provider and time window.

    An appointment can have several of these (e.g. consultation, then a
    blood test, then an X-ray) — see `app.models.AppointmentService`.
    """

    service_name: str
    provider_name: str
    start: datetime
    end: datetime
    price_cents: int


class PaymentSummary(BaseModel):
    """The payment tied to one appointment. Appointments without a payment have none at all."""

    amount_cents: int
    method: str
    status: str
    date: datetime


class AppointmentDetail(BaseModel):
    """One appointment in a patient's history: its status, every service performed, and its payment."""

    id: str
    status: str
    created_date: datetime
    services: list[AppointmentServiceItem]
    payment: PaymentSummary | None


class PatientDetail(BaseModel):
    """Full patient profile for the detail page — includes fields (like `address`)
    that the table view omits — plus the same aggregates shown there."""

    id: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    address: str
    phone: str
    email: str
    source: str
    created_date: datetime
    appointment_count: int
    last_appointment_date: datetime | None
    total_spent_cents: int


class PatientDetailResponse(BaseModel):
    """Everything the Patient Detail page needs: the profile, full appointment history, and the
    adjacent patients (in the default name-sorted order) for its Previous/Next navigation buttons.
    """

    patient: PatientDetail
    appointments: list[AppointmentDetail]
    previous_patient_id: str | None
    next_patient_id: str | None


class UpcomingPatientItem(BaseModel):
    """One row in the Upcoming Appointments dashboard: a patient with a scheduled future
    appointment, plus the two follow-up signals a front desk agent would triage by.

    `needs_confirmation` is true when this patient's soonest upcoming appointment falls on
    the view's reference "today" (see `list_upcoming_appointments`) and is still "pending"
    (not yet confirmed) -- something to call about today. `has_unpaid_appointment` is true
    when this patient has at least one *past*, non-cancelled appointment with no `Payment`
    record at all -- a real billing gap to follow up on. See `list_upcoming_appointments`
    for why this isn't based on a "failed" payment status (the seed data has none).
    """

    id: str
    first_name: str
    last_name: str
    date_of_birth: date
    phone: str
    email: str
    upcoming_appointment_date: datetime
    appointment_status: str
    needs_confirmation: bool
    has_unpaid_appointment: bool


class UpcomingAppointmentsResponse(BaseModel):
    """A page of the Upcoming Appointments dashboard, plus the reference date it was computed against."""

    items: list[UpcomingPatientItem]
    total: int
    page: int
    page_size: int
    # The effective "today" this view was computed against -- see
    # `list_upcoming_appointments` for why this isn't always the real current date.
    reference_date: date
