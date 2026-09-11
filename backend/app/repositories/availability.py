"""Repository functions for the walk-in availability checker.

Answers a front desk agent's actual question for a walk-in: "if I book this
service right now, which providers can take it, and when does whoever's
busy free up?" -- not a general scheduling/booking system, just a read-only
check against existing (non-cancelled) bookings.

Every provider in this seed dataset has historically performed every
service (verified directly: all 10 services have all 10 providers in their
booking history) -- there's no real "which providers do this service"
constraint to apply here, so every provider is checked for every service.
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, AppointmentService, Provider, Service
from app.repositories.patients import get_reference_now
from app.schemas.availability import AvailabilityResponse, ProviderAvailability


async def get_default_availability_check_time(db: AsyncSession) -> datetime:
    """"Right now," projected onto this dataset's reference day.

    This frozen seed dataset's schedule lives around its own reference date
    (see `get_reference_now`), not the real calendar date -- checking
    availability against the real `datetime.utcnow()` would always land on a
    day with no bookings at all, making every provider trivially "available"
    and the whole feature useless as a demo of real conflict-checking.
    Combining the reference day's date with the real current time-of-day
    gives a moment that actually falls within this dataset's booked
    schedule, while still varying like a real "right now" would.
    """
    reference_now = await get_reference_now(db)
    now = datetime.utcnow()
    return datetime.combine(reference_now.date(), now.time())


async def check_availability(db: AsyncSession, service_id: str, at: datetime) -> AvailabilityResponse | None:
    """For the given service, is each provider free at `at`, and if not, until when?

    A provider conflicts if they have an existing, non-cancelled
    `AppointmentService` whose window overlaps `[at, at + service.duration)`
    -- the standard interval-overlap test (`existing.start < requested_end
    AND existing.end > at`), not an exact-match check, since a walk-in could
    land in the middle of an existing booking. `busy_until` is the latest
    end time among any of a provider's conflicting bookings, so the agent
    knows the earliest moment that provider is free again. Returns `None`
    if `service_id` doesn't exist.
    """
    service = (await db.execute(select(Service).where(Service.id == service_id))).scalar_one_or_none()
    if service is None:
        return None

    requested_end = at + timedelta(minutes=service.duration)

    providers = (await db.execute(
        select(Provider).order_by(Provider.last_name.asc(), Provider.first_name.asc())
    )).scalars().all()

    conflicts_query = (
        select(AppointmentService.provider_id, AppointmentService.end)
        .join(Appointment, Appointment.id == AppointmentService.appointment_id)
        .where(
            Appointment.status != "cancelled",
            AppointmentService.start < requested_end,
            AppointmentService.end > at,
        )
    )
    busy_until_by_provider: dict[str, datetime] = {}
    for provider_id, end in (await db.execute(conflicts_query)).all():
        busy_until_by_provider[provider_id] = max(busy_until_by_provider.get(provider_id, end), end)

    provider_items = [
        ProviderAvailability(
            provider_id=provider.id, provider_name=f"{provider.first_name} {provider.last_name}",
            available=provider.id not in busy_until_by_provider,
            busy_until=busy_until_by_provider.get(provider.id),
        )
        for provider in providers
    ]
    # Available providers first (what the agent actually needs to act on), each
    # group keeping the name-sorted order the query already returned.
    provider_items.sort(key=lambda item: not item.available)

    return AvailabilityResponse(
        service_id=service.id, service_name=service.name, service_duration_minutes=service.duration,
        at=at, providers=provider_items,
    )
