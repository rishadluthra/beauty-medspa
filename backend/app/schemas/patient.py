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
    """Everything the Patient Detail page needs: the profile plus the full appointment history."""

    patient: PatientDetail
    appointments: list[AppointmentDetail]
