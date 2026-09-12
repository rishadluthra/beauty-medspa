"""Repository functions for querying a single appointment's full detail.

Part of the data-access layer described in `app.repositories.__init__` -- see
`get_appointment_detail`'s docstring for why this is a separate module from
`app.repositories.patients` rather than another function bolted onto it.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, AppointmentService, Patient, Payment, Provider, Service
from app.repositories.patients import _schedule_sort_expressions, get_reference_now
from app.schemas.appointment import AppointmentDetailResponse, AppointmentPatientSummary
from app.schemas.patient import AppointmentServiceItem, PaymentSummary


@dataclass
class ScheduleContext:
    """Which schedule window (the reference "today", or a specific calendar day) and
    provider/service filter (plus sort) an appointment was navigated from, for its own
    Previous/Next -- the same shape of scope `_list_schedule_between` (in
    app.repositories.patients) itself takes, since Previous/Next here has to walk that
    exact same window/order.

    `filter_service_id` (a `Service.id`, e.g. "svc_...") is the schedule's own service
    filter -- deliberately not named `service_id` like `get_appointment_detail`'s own
    parameter, which is a *different* id (the specific `AppointmentService` row that was
    clicked, an int) -- the two must never be confused.
    """

    kind: str = "today"  # "today" or "day"
    target_date: date | None = None  # only meaningful for kind="day"
    provider_id: str | None = None
    filter_service_id: str | None = None
    sort: str = "time"


async def _neighbors_in_schedule(
    db: AsyncSession, service_id: int | None, start_of_day: datetime, end_of_day: datetime,
    provider_id: str | None, filter_service_id: str | None, sort: str,
) -> tuple[str | None, int | None, str | None, int | None]:
    """Previous/Next appointment for the Appointment Detail page: the appointment AND
    the specific `AppointmentService` row belonging to the schedule slot immediately
    before/after `service_id`, in the same `[start_of_day, end_of_day)` window
    `_list_schedule_between` (`app.repositories.patients`) displays (same filters, same
    sort order -- see `_schedule_sort_expressions`).

    Returns `(previous_appointment_id, previous_service_id, next_appointment_id, next_service_id)`.
    The *_service_id values matter just as much as the *_appointment_id ones: the
    frontend needs the actual neighboring row's id to use as the anchor for the NEXT hop
    -- reusing the same stale `service_id` across hops is exactly what made this page's
    ancestor (Patient Detail's old `ctx=today`/`"day"` contexts) get stuck after one
    click; see that history in `PatientListContext`.

    `service_id` -- not just the current appointment's id -- identifies the exact row
    that was clicked, because one appointment can have more than one service scheduled
    at different times the same day (e.g. a consultation, then an X-ray) -- using only
    the appointment id would leave "which of its rows are we walking from" ambiguous.
    Returns all `None`s if `service_id` doesn't resolve to a row in this window (e.g. no
    `service_id` was given at all, such as a stale/malformed link) -- disabling the
    buttons rather than guessing.
    """
    base = (
        select(AppointmentService.id, AppointmentService.appointment_id)
        .join(Appointment, Appointment.id == AppointmentService.appointment_id)
        .join(Patient, Patient.id == Appointment.patient_id)
        .join(Provider, Provider.id == AppointmentService.provider_id)
        .where(
            Appointment.status != "cancelled",
            AppointmentService.start >= start_of_day,
            AppointmentService.start < end_of_day,
        )
    )
    if provider_id:
        base = base.where(AppointmentService.provider_id == provider_id)
    if filter_service_id:
        base = base.where(AppointmentService.service_id == filter_service_id)
    ranked = base.add_columns(
        func.row_number().over(order_by=_schedule_sort_expressions(sort)).label("rn")
    ).subquery()

    current_rn = (await db.execute(select(ranked.c.rn).where(ranked.c.id == service_id))).scalar_one_or_none()
    if current_rn is None:
        return None, None, None, None
    previous_row = (
        await db.execute(select(ranked.c.appointment_id, ranked.c.id).where(ranked.c.rn == current_rn - 1))
    ).first()
    next_row = (
        await db.execute(select(ranked.c.appointment_id, ranked.c.id).where(ranked.c.rn == current_rn + 1))
    ).first()
    previous_appointment_id, previous_service_id = previous_row if previous_row else (None, None)
    next_appointment_id, next_service_id = next_row if next_row else (None, None)
    return previous_appointment_id, previous_service_id, next_appointment_id, next_service_id


async def get_appointment_detail(
    db: AsyncSession, appointment_id: str, service_id: int | None, context: ScheduleContext,
) -> AppointmentDetailResponse | None:
    """Return one appointment's full detail, or `None` if not found.

    This is the drill-down for a Today's Appointments / Calendar schedule row -- those
    views list one row per scheduled *service* (a multi-service appointment occupies
    several distinct time slots, possibly with different providers), so clicking a row
    is naturally "tell me about this appointment," not "tell me about this patient."
    Routing schedule rows into the generic, all-history Patient Detail page instead (the
    original design) meant Next/Prev could land on the exact same patient twice in a row
    -- correct in terms of *ranking* (the next schedule slot really did belong to the
    same patient), but confusing in terms of *destination*, since the page shown looked
    identical to a bug rather than "here's their next visit today." This page shows the
    appointment itself -- status, services, payment -- with the patient reduced to a
    compact summary strip, and Previous/Next walk actual schedule rows into more
    appointments, so a patient with two services today is correctly shown as two
    different appointment views, not the same patient page rendered twice.

    `service_id`, when given, is used two ways: to compute Previous/Next (see
    `_neighbors_in_schedule`) and to set `highlighted_service_start` (so the frontend can
    bold the specific row that was actually clicked, when `services` has more than one).
    """
    appointment = (await db.execute(select(Appointment).where(Appointment.id == appointment_id))).scalar_one_or_none()
    if appointment is None:
        return None
    patient = (await db.execute(select(Patient).where(Patient.id == appointment.patient_id))).scalar_one_or_none()

    service_rows = (await db.execute(
        select(
            AppointmentService.id, Service.name, Provider.first_name, Provider.last_name,
            AppointmentService.start, AppointmentService.end, Service.price,
        )
        .join(Service, Service.id == AppointmentService.service_id)
        .join(Provider, Provider.id == AppointmentService.provider_id)
        .where(AppointmentService.appointment_id == appointment_id)
        .order_by(AppointmentService.start)
    )).all()
    services = [
        AppointmentServiceItem(
            service_name=service_name, provider_name=f"{provider_first} {provider_last}",
            start=start, end=end, price_cents=price,
        )
        for _, service_name, provider_first, provider_last, start, end, price in service_rows
    ]
    appointment_date = min((service.start for service in services), default=None)
    highlighted_service_start = next(
        (
            row_start for row_service_id, _name, _pf, _pl, row_start, _end, _price in service_rows
            if row_service_id == service_id
        ),
        None,
    )

    payment_row = (await db.execute(
        select(Payment).where(Payment.appointment_id == appointment_id)
    )).scalar_one_or_none()
    payment = (
        PaymentSummary(
            amount_cents=payment_row.amount, method=payment_row.method,
            status=payment_row.status, date=payment_row.date,
        )
        if payment_row is not None else None
    )

    if context.kind == "day" and context.target_date is not None:
        start_of_day = datetime.combine(context.target_date, time.min)
        end_of_day = start_of_day + timedelta(days=1)
    else:
        reference_now = await get_reference_now(db)
        start_of_day, end_of_day = reference_now, reference_now + timedelta(days=1)

    previous_appointment_id, previous_service_id, next_appointment_id, next_service_id = await _neighbors_in_schedule(
        db, service_id, start_of_day, end_of_day, context.provider_id, context.filter_service_id, context.sort,
    )

    return AppointmentDetailResponse(
        id=appointment.id, status=appointment.status, appointment_date=appointment_date,
        created_date=appointment.created_date, services=services, payment=payment,
        patient=AppointmentPatientSummary(
            id=patient.id, first_name=patient.first_name, last_name=patient.last_name,
            phone=patient.phone, email=patient.email,
        ),
        highlighted_service_start=highlighted_service_start,
        previous_appointment_id=previous_appointment_id, previous_service_id=previous_service_id,
        next_appointment_id=next_appointment_id, next_service_id=next_service_id,
    )
