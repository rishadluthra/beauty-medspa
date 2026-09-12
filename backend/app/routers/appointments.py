"""HTTP routes for a single appointment's detail.

Thin wrapper over `app.repositories.appointments`: parses/validates query params and
delegates to the repository layer -- see `app.repositories.__init__` for why that split
matters.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.appointments import ScheduleContext, get_appointment_detail
from app.schemas.appointment import AppointmentDetailResponse

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


@router.get("/{appointment_id}", response_model=AppointmentDetailResponse)
async def get_appointment(
    appointment_id: str,
    ctx: str | None = None,
    service_id: int | None = None,
    provider_id: str | None = None,
    filter_service_id: str | None = None,
    sort: str = "time",
    sort_dir: str = "asc",
    date: date | None = None,
    db: AsyncSession = Depends(get_db),
) -> AppointmentDetailResponse:
    """One appointment's full detail, for the Appointment Detail page -- the drill-down
    from a Today's Appointments / Calendar schedule row (see `get_appointment_detail`
    for why that's a different destination than a Patient Table/Rebooking row).

    `ctx` ("today" | "day") and `date` (only meaningful for `ctx=day`) say which schedule
    window Previous/Next should walk -- the reference "today", or a specific calendar
    day -- mirroring `GET /api/patients/today` and `GET /api/patients/day`. `provider_id`/
    `filter_service_id`/`sort` narrow and order that window the same way those endpoints'
    own `provider_id`/`service_id`/`sort` do (named `filter_service_id` here specifically
    to avoid confusion with this endpoint's own `service_id`, below). `service_id`
    identifies the specific schedule row that was actually clicked (an appointment can
    have more than one service scheduled at different times), used both to compute
    Previous/Next and to tell the frontend which service line to highlight.
    """
    context = ScheduleContext(
        kind=ctx or "today", target_date=date, provider_id=provider_id,
        filter_service_id=filter_service_id, sort=sort, sort_dir=sort_dir,
    )
    detail = await get_appointment_detail(db, appointment_id, service_id, context)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Appointment {appointment_id} not found")
    return detail
