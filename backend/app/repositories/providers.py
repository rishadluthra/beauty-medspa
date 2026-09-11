"""Repository functions for querying providers.

Small compared to `app.repositories.patients`, but kept as its own module
(matching the one-entity-per-module pattern there) since providers are a
distinct entity a future natural-language-query service should be able to
look up directly, not just a side effect of patient/appointment queries.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Provider
from app.schemas.provider import ProviderListItem, ProviderListResponse


async def list_providers(db: AsyncSession) -> ProviderListResponse:
    """Every provider, sorted by name -- there are only a handful, so no pagination.

    Used to populate the provider filter on the schedule views (Today's
    Appointments / Upcoming Appointments), so a front desk agent can check
    what a specific provider has coming up.
    """
    rows = (await db.execute(
        select(Provider).order_by(Provider.last_name.asc(), Provider.first_name.asc())
    )).scalars().all()
    return ProviderListResponse(
        items=[
            ProviderListItem(id=provider.id, first_name=provider.first_name, last_name=provider.last_name)
            for provider in rows
        ]
    )
