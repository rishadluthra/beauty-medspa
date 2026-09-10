"""Response schemas for the Patient Table page.

Mirrors the return shape of `app.repositories.patients.list_patients`; this
is what gets serialized to JSON for the frontend.
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
