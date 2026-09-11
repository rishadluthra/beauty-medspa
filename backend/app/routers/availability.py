"""HTTP routes for the walk-in availability checker."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.availability import check_availability, get_default_availability_check_time
from app.schemas.availability import AvailabilityResponse

router = APIRouter(prefix="/api/availability", tags=["availability"])


@router.get("", response_model=AvailabilityResponse)
async def get_availability(
    service_id: str,
    at: datetime | None = None,
    db: AsyncSession = Depends(get_db),
) -> AvailabilityResponse:
    """Which providers can take a walk-in for `service_id` at `at` (defaults to "right now"
    against this dataset -- see `get_default_availability_check_time`), and for anyone
    who's busy, when they free up.
    """
    if at is None:
        at = await get_default_availability_check_time(db)
    result = await check_availability(db, service_id, at)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Service {service_id} not found")
    return result
