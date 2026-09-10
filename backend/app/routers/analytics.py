"""HTTP routes for the Analytics Dashboard page.

Each route is a thin, 1:1 wrapper over a function in
`app.repositories.analytics` — no aggregation/filtering logic lives here.
See `app.repositories.__init__` and `app.repositories.analytics` for why
the query logic lives in the repository layer instead of inline in these
handlers (it keeps the same functions reusable by a future AI query
service).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories import analytics as analytics_repo
from app.schemas.analytics import AppointmentStatusItem, DemographicsResponse, OverviewStats, PaymentStatusItem, ProviderUtilizationItem, RevenuePoint, SourceBreakdownItem, TopServiceItem

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewStats)
async def overview(db: AsyncSession = Depends(get_db)) -> OverviewStats:
    """Top-line KPIs (patients, revenue, appointments, etc.) for the dashboard header."""
    return await analytics_repo.get_overview_stats(db)


@router.get("/revenue-over-time", response_model=list[RevenuePoint])
async def revenue_over_time(db: AsyncSession = Depends(get_db)) -> list[RevenuePoint]:
    """Monthly revenue time series (paid payments only)."""
    return await analytics_repo.get_revenue_over_time(db)


@router.get("/patients-by-source", response_model=list[SourceBreakdownItem])
async def patients_by_source(db: AsyncSession = Depends(get_db)) -> list[SourceBreakdownItem]:
    """Patient counts by marketing source."""
    return await analytics_repo.get_patients_by_source(db)


@router.get("/top-services", response_model=list[TopServiceItem])
async def top_services(db: AsyncSession = Depends(get_db)) -> list[TopServiceItem]:
    """Most-booked services with booking counts and revenue."""
    return await analytics_repo.get_top_services(db)


@router.get("/provider-utilization", response_model=list[ProviderUtilizationItem])
async def provider_utilization(db: AsyncSession = Depends(get_db)) -> list[ProviderUtilizationItem]:
    """Per-provider appointment counts and revenue."""
    return await analytics_repo.get_provider_utilization(db)


@router.get("/appointment-status", response_model=list[AppointmentStatusItem])
async def appointment_status(db: AsyncSession = Depends(get_db)) -> list[AppointmentStatusItem]:
    """Appointment counts by status (pending/confirmed/cancelled)."""
    return await analytics_repo.get_appointment_status_breakdown(db)


@router.get("/payment-status", response_model=list[PaymentStatusItem])
async def payment_status(db: AsyncSession = Depends(get_db)) -> list[PaymentStatusItem]:
    """Payment counts by status (pending/paid/failed)."""
    return await analytics_repo.get_payment_status_breakdown(db)


@router.get("/demographics", response_model=DemographicsResponse)
async def demographics(db: AsyncSession = Depends(get_db)) -> DemographicsResponse:
    """Patient counts by gender and age bucket."""
    return await analytics_repo.get_patient_demographics(db)
