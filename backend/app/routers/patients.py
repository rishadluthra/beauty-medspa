"""HTTP routes for patient listing.

Thin wrapper over `app.repositories.patients`: parses/validates query
params and delegates all filtering/sorting/pagination/aggregation logic to
the repository layer (see `app.repositories.__init__` for why that split
matters — the repository functions are meant to be reusable outside the
REST layer too).
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.patients import (
    PatientFilters,
    PatientListContext,
    get_calendar_month,
    get_patient_detail,
    list_patients,
    list_rebooking_opportunities,
    list_schedule_for_date,
    list_todays_appointments,
    list_upcoming_appointments,
)
from app.schemas.patient import (
    CalendarMonthResponse,
    PatientDetailResponse,
    PatientListResponse,
    RebookingOpportunitiesResponse,
    TodaysAppointmentsResponse,
    UpcomingAppointmentsResponse,
)

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=PatientListResponse)
async def get_patients(
    search: str | None = None,
    source: str | None = None,
    gender: str | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    age_min: int | None = Query(None, ge=0),
    age_max: int | None = Query(None, ge=0),
    min_total_spent_cents: int | None = Query(None, ge=0),
    sort: str = "name",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PatientListResponse:
    """List patients for the Patient Table page.

    Supports free-text search (name/email/phone), exact-match filters
    (source, gender), a created-date range (created_from/created_to, both
    inclusive), an age range (age_min/age_max, both inclusive, computed
    from date_of_birth as of today), a minimum-lifetime-spend filter
    (min_total_spent_cents, for finding high-value patients), sorting, and
    pagination — all applied server-side by `list_patients`. `page_size`
    is capped at 100 to keep responses bounded.
    """
    filters = PatientFilters(
        search=search, source=source, gender=gender, created_from=created_from, created_to=created_to,
        age_min=age_min, age_max=age_max, min_total_spent_cents=min_total_spent_cents,
    )
    return await list_patients(db, filters, sort=sort, page=page, page_size=page_size)


# Registered BEFORE `/{patient_id}` below -- FastAPI matches routes in
# registration order, so a static path declared after the "/{patient_id}"
# dynamic route would never be reached (it would always match
# "/{patient_id}" first, with e.g. patient_id="today").
@router.get("/today", response_model=TodaysAppointmentsResponse)
async def get_todays_appointments(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
    provider_id: str | None = None,
    service_id: str | None = None,
    sort: str = "time",
    db: AsyncSession = Depends(get_db),
) -> TodaysAppointmentsResponse:
    """The full schedule for "today" -- the front desk dashboard's default view.

    See `list_todays_appointments` for what "today" means against this
    static seed dataset, and why this is one row per scheduled service
    rather than one row per patient. `provider_id`/`service_id`, if given,
    narrow this to one provider's and/or one service's own schedule for the
    day. `sort` picks the display order -- "time" (default), "patient_name",
    or "provider_name".
    """
    return await list_todays_appointments(
        db, page=page, page_size=page_size, provider_id=provider_id, service_id=service_id, sort=sort,
    )


@router.get("/upcoming", response_model=UpcomingAppointmentsResponse)
async def get_upcoming_appointments(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    provider_id: str | None = None,
    only_tomorrow: bool = False,
    db: AsyncSession = Depends(get_db),
) -> UpcomingAppointmentsResponse:
    """List patients by their soonest appointment after today, for planning ahead.

    See `list_upcoming_appointments` for what "today" (and therefore
    "after today") means against this static seed dataset. `provider_id`,
    if given, narrows this to that provider's own upcoming schedule.
    `only_tomorrow`, if set, further narrows the window to just the single
    day right after "today" -- see `list_upcoming_appointments` for why.
    """
    return await list_upcoming_appointments(
        db, page=page, page_size=page_size, provider_id=provider_id, only_tomorrow=only_tomorrow,
    )


@router.get("/rebooking-opportunities", response_model=RebookingOpportunitiesResponse)
async def get_rebooking_opportunities(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> RebookingOpportunitiesResponse:
    """Patients who have been seen before but have nothing scheduled going forward -- the
    front desk's rebooking/outreach worklist.

    See `list_rebooking_opportunities` for the exact qualifying criteria and sort order.
    """
    return await list_rebooking_opportunities(db, page=page, page_size=page_size)


@router.get("/calendar", response_model=CalendarMonthResponse)
async def get_calendar(
    month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$", description="YYYY-MM; defaults to the dataset's reference month"),
    db: AsyncSession = Depends(get_db),
) -> CalendarMonthResponse:
    """Day-by-day appointment density for one calendar month, for the Calendar view's grid.

    See `get_calendar_month` for what "defaults to the reference month" means against this
    static seed dataset when `month` is omitted.
    """
    year_int, month_int = (int(part) for part in month.split("-")) if month else (None, None)
    return await get_calendar_month(db, year=year_int, month=month_int)


@router.get("/day", response_model=TodaysAppointmentsResponse)
async def get_day_schedule(
    date: date,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
    provider_id: str | None = None,
    service_id: str | None = None,
    sort: str = "time",
    db: AsyncSession = Depends(get_db),
) -> TodaysAppointmentsResponse:
    """The full schedule for one specific day, for the Calendar view's day drill-down.

    Same shape as `/today`, for a caller-chosen `date` (YYYY-MM-DD) instead of always the
    dataset's reference "today". `provider_id`/`service_id`/`sort` behave identically to
    `/today`'s own.
    """
    return await list_schedule_for_date(
        db, date, page=page, page_size=page_size, provider_id=provider_id, service_id=service_id, sort=sort,
    )


@router.get("/{patient_id}", response_model=PatientDetailResponse)
async def get_patient(
    patient_id: str,
    ctx: str | None = None,
    sort: str = "name",
    search: str | None = None,
    source: str | None = None,
    gender: str | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    age_min: int | None = Query(None, ge=0),
    age_max: int | None = Query(None, ge=0),
    min_total_spent_cents: int | None = Query(None, ge=0),
    db: AsyncSession = Depends(get_db),
) -> PatientDetailResponse:
    """One patient's full profile plus their complete appointment history, for the Patient Detail page.

    This is the drill-down from an All Patients or Rebooking Opportunities row: every
    appointment, every service performed within it (with provider and time), and its
    payment if any — none of which the table view (or the analytics aggregates) ever
    surfaces per-patient. (A Today's Appointments / Calendar schedule row links to
    `GET /api/appointments/{appointment_id}` instead -- see `app.routers.appointments`
    -- since that schedule is one row per scheduled *service*, not per patient.)

    `ctx` ("all" | "rebooking") tells the Previous/Next buttons which source list the
    agent actually navigated from, so they walk that list's own order instead of a fixed
    global one -- see `PatientListContext`. The remaining params are "all"'s own scope:
    `sort`/`search`/`source`/`gender`/`created_from`/`created_to`/`age_min`/`age_max`/
    `min_total_spent_cents`, identical in meaning to `GET /api/patients`. Omitting `ctx`
    (a direct link, a global-search result, or any other entry point with no real list
    to scope to) falls back to the old fixed global name-sorted order.
    """
    context = PatientListContext(
        kind=ctx or "all",
        filters=PatientFilters(
            search=search, source=source, gender=gender,
            created_from=created_from, created_to=created_to,
            age_min=age_min, age_max=age_max, min_total_spent_cents=min_total_spent_cents,
        ),
        sort=sort,
    )
    detail = await get_patient_detail(db, patient_id, context)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return detail
