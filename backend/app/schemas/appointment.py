"""Response schema for the Appointment Detail page.

Mirrors the return shape of `app.repositories.appointments.get_appointment_detail`.
Kept separate from `app.schemas.patient` (which owns the Patient Table/Patient Detail
shapes) because this page is about a single appointment, not a patient -- see
`get_appointment_detail`'s docstring for why that distinction exists at all.
"""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.patient import AppointmentServiceItem, PaymentSummary


class AppointmentPatientSummary(BaseModel):
    """Just enough of the patient's identity for the Appointment Detail page's compact
    summary strip -- not the full profile `PatientDetail` carries (address, lifetime
    spend, appointment count, etc.). This page is about the appointment; a "View full
    profile" link covers anyone who wants the rest.
    """

    id: str
    first_name: str
    last_name: str
    phone: str
    email: str


class AppointmentDetailResponse(BaseModel):
    """Everything the Appointment Detail page needs: the appointment's own status, every
    service performed on it, its payment if any, a compact patient summary, and the
    adjacent appointments (within the same Today's/Calendar schedule window this was
    navigated from) for Previous/Next.
    """

    id: str
    status: str
    # The earliest of this appointment's services' start times -- `None` if it has no
    # AppointmentService rows yet. Same meaning as `AppointmentDetail.appointment_date`
    # in app.schemas.patient.
    appointment_date: datetime | None
    created_date: datetime
    services: list[AppointmentServiceItem]
    payment: PaymentSummary | None
    patient: AppointmentPatientSummary
    # The specific service row (`AppointmentService.id`) this page was navigated to via,
    # if any -- lets the frontend bold/highlight that one line among `services` when the
    # appointment has more than one (so "the 10:15 slot you clicked" stays visually
    # findable, not just lumped into the whole visit's service list). `None` when no
    # `service_id` was given (e.g. a direct link) or it doesn't belong to this appointment.
    highlighted_service_start: datetime | None
    previous_appointment_id: str | None
    previous_service_id: int | None
    next_appointment_id: str | None
    next_service_id: int | None
