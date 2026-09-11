"""Repository functions backing the self-serve "Build Custom Analytics" feature.

Part of the data-access layer described in `app.repositories.__init__`.
`get_custom_report_data` is the one reusable, parameterized query function
here (metric x dimension x time grain -> a pivot table) -- exactly the
shape a future AI/natural-language-query service would want to call
directly ("show me revenue by provider per month"). `create_custom_report`,
`list_custom_reports`, and `delete_custom_report` are plain CRUD against
the `custom_reports` table backing saved reports; unlike every other
module in this package, this app-config table has no seed-data
counterpart, so these are the API's first writes (see `app.models.custom_report`).

Every metric x dimension combination is computed independently below
rather than through one generically-joined query, because the correct
FROM table (and which entity to join for a human-readable dimension
label) differs per metric: `revenue_cents` is anchored to `Payment`
(only `status == "paid"` rows), `appointment_count` to `AppointmentService`
(one row per booked service-slot), and `unique_patient_count` to
`AppointmentService` joined through `Appointment` for `patient_id` (which
lives on `Appointment`, not `AppointmentService`). Trying to force all
three through a single shared query shape would either double-count (see
`app.repositories.analytics`'s module docstring on join fan-out) or
require joining tables a given metric doesn't need.
"""

import secrets
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, AppointmentService, CustomReport, Patient, Payment, Provider, Service
from app.schemas.custom_reports import CustomReportPoint, Dimension, Metric, TimeGrain

MAX_SAVED_REPORTS = 12


def _period_format(time_grain: TimeGrain) -> str:
    """Postgres `to_char` format string for the given time grain.

    `'YYYY"-Q"Q'` uses to_char's `Q` token (quarter-of-year) with the
    literal `-Q` text quoted so it passes through unchanged, producing
    e.g. "2025-Q4" -- matching the "YYYY-MM" shape `get_revenue_over_time`
    already uses for months, just one grain coarser.
    """
    return "YYYY-MM" if time_grain == TimeGrain.month else 'YYYY"-Q"Q'


async def get_custom_report_data(
    db: AsyncSession, metric: Metric, dimension: Dimension, time_grain: TimeGrain
) -> list[CustomReportPoint]:
    """Compute a metric x dimension x time-grain pivot, oldest period first.

    Returns one row per (period, dimension_value) cell that actually has
    data -- empty cells are simply absent, not zero-filled, since the
    frontend chart only needs to plot points that exist.
    """
    period_fmt = _period_format(time_grain)

    if metric == Metric.revenue_cents:
        period = func.to_char(Payment.date, period_fmt).label("period")
        value = func.sum(Payment.amount).label("value")
        query = select(period, value).where(Payment.status == "paid")  # only paid payments count as revenue
        if dimension == Dimension.provider:
            dim_value = (Provider.first_name + " " + Provider.last_name).label("dimension_value")
            query = query.join(Provider, Provider.id == Payment.provider_id)
        elif dimension == Dimension.service:
            dim_value = Service.name.label("dimension_value")
            query = query.join(Service, Service.id == Payment.service_id)
        else:  # source
            dim_value = Patient.source.label("dimension_value")
            query = query.join(Patient, Patient.id == Payment.patient_id)

    elif metric == Metric.appointment_count:
        period = func.to_char(AppointmentService.start, period_fmt).label("period")
        value = func.count(AppointmentService.id).label("value")
        query = select(period, value).select_from(AppointmentService)
        if dimension == Dimension.provider:
            dim_value = (Provider.first_name + " " + Provider.last_name).label("dimension_value")
            query = query.join(Provider, Provider.id == AppointmentService.provider_id)
        elif dimension == Dimension.service:
            dim_value = Service.name.label("dimension_value")
            query = query.join(Service, Service.id == AppointmentService.service_id)
        else:  # source -- not on AppointmentService, so join up through Appointment -> Patient
            dim_value = Patient.source.label("dimension_value")
            query = query.join(Appointment, Appointment.id == AppointmentService.appointment_id).join(
                Patient, Patient.id == Appointment.patient_id
            )

    else:  # unique_patient_count
        # patient_id lives on Appointment, not AppointmentService, so this
        # join is required regardless of which dimension was requested.
        period = func.to_char(AppointmentService.start, period_fmt).label("period")
        value = func.count(func.distinct(Appointment.patient_id)).label("value")
        query = (
            select(period, value)
            .select_from(AppointmentService)
            .join(Appointment, Appointment.id == AppointmentService.appointment_id)
        )
        if dimension == Dimension.provider:
            dim_value = (Provider.first_name + " " + Provider.last_name).label("dimension_value")
            query = query.join(Provider, Provider.id == AppointmentService.provider_id)
        elif dimension == Dimension.service:
            dim_value = Service.name.label("dimension_value")
            query = query.join(Service, Service.id == AppointmentService.service_id)
        else:  # source
            dim_value = Patient.source.label("dimension_value")
            query = query.join(Patient, Patient.id == Appointment.patient_id)

    query = query.add_columns(dim_value).group_by(period, dim_value).order_by(period)
    rows = (await db.execute(query)).all()
    return [
        CustomReportPoint(period=row.period, dimension_value=row.dimension_value, value=int(row.value))
        for row in rows
    ]


async def list_custom_reports(db: AsyncSession) -> list[CustomReport]:
    """Return every saved custom report, oldest first."""
    query = select(CustomReport).order_by(CustomReport.created_date)
    return list((await db.execute(query)).scalars().all())


async def count_custom_reports(db: AsyncSession) -> int:
    """Return how many custom reports are currently saved (for the soft cap)."""
    return (await db.execute(select(func.count(CustomReport.id)))).scalar_one()


async def create_custom_report(
    db: AsyncSession, title: str, metric: Metric, dimension: Dimension, time_grain: TimeGrain
) -> CustomReport:
    """Insert and return a new saved custom report.

    The id is a fresh surrogate (`rpt_<12 hex chars>`) since, unlike every
    other entity in this app, saved reports don't come from seed data and
    so have no natural key to reuse.
    """
    report = CustomReport(
        id=f"rpt_{secrets.token_hex(6)}",
        title=title,
        metric=metric.value,
        dimension=dimension.value,
        time_grain=time_grain.value,
        created_date=datetime.utcnow(),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


async def delete_custom_report(db: AsyncSession, report_id: str) -> bool:
    """Delete a saved custom report. Returns False if no report had that id."""
    report = await db.get(CustomReport, report_id)
    if report is None:
        return False
    await db.delete(report)
    await db.commit()
    return True
