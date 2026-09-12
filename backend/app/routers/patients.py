"""HTTP routes for patient listing.

Thin wrapper over `app.repositories.patients`: parses/validates query
params and delegates all filtering/sorting/pagination/aggregation logic to
the repository layer (see `app.repositories.__init__` for why that split
matters — the repository functions are meant to be reusable outside the
REST layer too).
"""

import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import TypeAdapter, ValidationError
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
from app.schemas.patient_filters import PatientFilterCondition

router = APIRouter(prefix="/api/patients", tags=["patients"])

_FILTER_LIST_ADAPTER = TypeAdapter(list[PatientFilterCondition])


def _parse_filters(filters: str | None) -> list[PatientFilterCondition]:
    """Parses the `filters` query param -- a JSON-encoded array of `{field, operator,
    value(s)}` conditions (see `app.schemas.patient_filters`) -- into validated
    `PatientFilterCondition`s. A single query param carrying JSON (rather than one query
    param per field, as this endpoint used to have) is what lets the filter set scale to
    any column/operator combination without a growing, bespoke list of named params here.

    Raises `HTTPException(400)` for malformed JSON or a condition that fails Pydantic's
    own structural validation (e.g. `between` missing `value2`) -- `list_patients` itself
    raises `ValueError` (also turned into a 400, at the call site below) for the second
    validation pass that needs the field/operator registry (unknown field, wrong operator
    for that field's type), since that check lives with the query-building code.
    """
    if not filters:
        return []
    try:
        raw = json.loads(filters)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"'filters' is not valid JSON: {exc}") from exc
    try:
        return _FILTER_LIST_ADAPTER.validate_python(raw)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid filter condition: {exc}") from exc


@router.get("", response_model=PatientListResponse)
async def get_patients(
    search: str | None = None,
    filters: str | None = Query(None, description="JSON-encoded array of {field, operator, value(s)} conditions"),
    sort: str = "name",
    sort_dir: str = "asc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PatientListResponse:
    """List patients for the Patient Table page.

    Supports free-text search (name/email/phone), an arbitrary set of per-column
    typed filter conditions (`filters` -- see `app.schemas.patient_filters` for which
    columns/operators exist), column-driven sorting (`sort`/`sort_dir`), and pagination
    — all applied server-side by `list_patients`. `page_size` is capped at 100 to keep
    responses bounded.
    """
    conditions = _parse_filters(filters)
    patient_filters = PatientFilters(search=search, filters=conditions)
    try:
        return await list_patients(db, patient_filters, sort=sort, sort_dir=sort_dir, page=page, page_size=page_size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
    sort_dir: str = "asc",
    db: AsyncSession = Depends(get_db),
) -> TodaysAppointmentsResponse:
    """The full schedule for "today" -- the front desk dashboard's default view.

    See `list_todays_appointments` for what "today" means against this
    static seed dataset, and why this is one row per scheduled service
    rather than one row per patient. `provider_id`/`service_id`, if given,
    narrow this to one provider's and/or one service's own schedule for the
    day. `sort`/`sort_dir` pick the display order and direction -- "time"
    (default), "patient_name", "provider_name", "service_name", or "status".
    """
    return await list_todays_appointments(
        db, page=page, page_size=page_size, provider_id=provider_id, service_id=service_id, sort=sort, sort_dir=sort_dir,
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
    sort: str = "last_appointment_date",
    sort_dir: str = "desc",
    service_id: str | None = None,
    provider_id: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> RebookingOpportunitiesResponse:
    """Patients who have been seen before but have nothing scheduled going forward -- the
    front desk's rebooking/outreach worklist.

    See `list_rebooking_opportunities` for the exact qualifying criteria and default sort
    order (most-recent-visit-first) -- `sort`/`sort_dir` can pick any of its other
    columns instead ("name", "email", "last_service_name", "last_provider_name").
    `service_id`/`provider_id`, when given, narrow the worklist to patients whose LAST
    visit was that specific service/provider -- rebooking cadence varies by service, so
    "everyone overdue for Botox" is a different, real question from "everyone overdue."
    """
    return await list_rebooking_opportunities(
        db, page=page, page_size=page_size, sort=sort, sort_dir=sort_dir,
        service_id=service_id, provider_id=provider_id,
    )


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
    sort_dir: str = "asc",
    db: AsyncSession = Depends(get_db),
) -> TodaysAppointmentsResponse:
    """The full schedule for one specific day, for the Calendar view's day drill-down.

    Same shape as `/today`, for a caller-chosen `date` (YYYY-MM-DD) instead of always the
    dataset's reference "today". `provider_id`/`service_id`/`sort`/`sort_dir` behave
    identically to `/today`'s own.
    """
    return await list_schedule_for_date(
        db, date, page=page, page_size=page_size, provider_id=provider_id, service_id=service_id, sort=sort, sort_dir=sort_dir,
    )


@router.get("/{patient_id}", response_model=PatientDetailResponse)
async def get_patient(
    patient_id: str,
    ctx: str | None = None,
    sort: str | None = None,
    sort_dir: str | None = None,
    search: str | None = None,
    filters: str | None = Query(None, description="JSON-encoded array of {field, operator, value(s)} conditions"),
    service_id: str | None = None,
    provider_id: str | None = None,
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
    global one -- see `PatientListContext`. `sort`/`sort_dir`/`search`/`filters` are
    "all"'s own scope, identical in meaning to `GET /api/patients`; `service_id`/
    `provider_id` are "rebooking"'s own scope, identical in meaning to
    `GET /api/patients/rebooking-opportunities`. Omitting `sort`/`sort_dir` (a direct
    link, a global-search result, or any other entry point with no real list to scope to)
    falls back to each `ctx`'s own natural default order (name-sorted for "all", most-
    recent-visit-first for "rebooking") -- see `PatientListContext.sort`.
    """
    conditions = _parse_filters(filters)
    context = PatientListContext(
        kind=ctx or "all",
        filters=PatientFilters(search=search, filters=conditions),
        sort=sort,
        sort_dir=sort_dir,
        service_id=service_id,
        provider_id=provider_id,
    )
    try:
        detail = await get_patient_detail(db, patient_id, context)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return detail
