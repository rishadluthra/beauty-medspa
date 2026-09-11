"""Repository functions for querying services.

Small, matching `app.repositories.providers` -- both exist mainly to
populate lookups elsewhere (the schedule views' provider filter; the
walk-in availability checker's service picker), not as a page of their own.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Service
from app.schemas.service import ServiceListItem, ServiceListResponse


async def list_services(db: AsyncSession) -> ServiceListResponse:
    """Every service, sorted by name -- there are only a handful, so no pagination."""
    rows = (await db.execute(select(Service).order_by(Service.name.asc()))).scalars().all()
    return ServiceListResponse(
        items=[
            ServiceListItem(id=service.id, name=service.name, duration=service.duration, price_cents=service.price)
            for service in rows
        ]
    )
