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
    """One appointment in a patient's history: its status, every service performed, and its payment.

    `appointment_date` is the actual scheduled visit date/time (the
    earliest of its services' `start` times) -- this is the date to
    *display* and sort by. `created_date` is merely when the booking
    record was entered into the system and can be unrelated to when the
    visit is/was scheduled (e.g. booked in January for a visit the
    following January); it's kept here only as secondary "booked on"
    information, never as the primary date shown for an appointment.
    `appointment_date` is `None` for an appointment with no
    AppointmentService rows at all (nothing scheduled yet).
    """

    id: str
    status: str
    appointment_date: datetime | None
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


class TodaysAppointmentItem(BaseModel):
    """One scheduled service occurring on the reference "today" -- one row per
    AppointmentService, not per Appointment, since a multi-service appointment (e.g.
    consultation + X-ray) occupies multiple distinct time slots, possibly with different
    providers, each of which is its own line on a front desk's schedule for the day.
    Cancelled appointments are excluded entirely -- they aren't happening.
    """

    id: int  # the AppointmentService row's own surrogate id, so the frontend has a stable key per row
    patient_id: str
    patient_name: str
    phone: str
    service_name: str
    provider_name: str
    start: datetime
    end: datetime
    status: str


class TodaysAppointmentsResponse(BaseModel):
    """The full schedule for the reference "today", plus the date itself."""

    items: list[TodaysAppointmentItem]
    total: int
    page: int
    page_size: int
    # The effective "today" this view was computed against -- see
    # `_get_upcoming_reference_now` for why this isn't always the real current date.
    reference_date: date


class UpcomingPatientItem(BaseModel):
    """One row in the Upcoming Appointments dashboard: a patient with a scheduled appointment
    after the reference "today" (today itself is covered by the Today's Appointments view instead).
    """

    id: str
    first_name: str
    last_name: str
    date_of_birth: date
    phone: str
    email: str
    upcoming_appointment_date: datetime
    appointment_status: str


class UpcomingAppointmentsResponse(BaseModel):
    """A page of the Upcoming Appointments dashboard, plus the reference date it was computed against."""

    items: list[UpcomingPatientItem]
    total: int
    page: int
    page_size: int
    # The effective "today" this view was computed against -- see
    # `list_upcoming_appointments` for why this isn't always the real current date.
    reference_date: date


class CalendarDayCount(BaseModel):
    """One day's scheduled (non-cancelled) service count, for the calendar view's density grid."""

    date: date
    count: int


class CalendarMonthResponse(BaseModel):
    """A full calendar month's day-by-day appointment density, for the Calendar view.

    `days` always covers every day of the month (including zero-count days), so the
    frontend can render a complete grid without having to infer which dates are missing.
    """

    month: str  # "YYYY-MM"
    days: list[CalendarDayCount]
    # The effective "today" in this dataset (see `_get_upcoming_reference_now`) -- the
    # frontend uses this to highlight "today" on the grid, since the real calendar date
    # means nothing against this frozen seed dataset.
    reference_date: date
