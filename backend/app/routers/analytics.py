from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories import analytics as analytics_repo
from app.schemas.analytics import AppointmentStatusItem, OverviewStats, ProviderUtilizationItem, RevenuePoint, SourceBreakdownItem, TopServiceItem

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewStats)
async def overview(db: AsyncSession = Depends(get_db)) -> OverviewStats:
    return await analytics_repo.get_overview_stats(db)


@router.get("/revenue-over-time", response_model=list[RevenuePoint])
async def revenue_over_time(db: AsyncSession = Depends(get_db)) -> list[RevenuePoint]:
    return await analytics_repo.get_revenue_over_time(db)


@router.get("/patients-by-source", response_model=list[SourceBreakdownItem])
async def patients_by_source(db: AsyncSession = Depends(get_db)) -> list[SourceBreakdownItem]:
    return await analytics_repo.get_patients_by_source(db)


@router.get("/top-services", response_model=list[TopServiceItem])
async def top_services(db: AsyncSession = Depends(get_db)) -> list[TopServiceItem]:
    return await analytics_repo.get_top_services(db)


@router.get("/provider-utilization", response_model=list[ProviderUtilizationItem])
async def provider_utilization(db: AsyncSession = Depends(get_db)) -> list[ProviderUtilizationItem]:
    return await analytics_repo.get_provider_utilization(db)


@router.get("/appointment-status", response_model=list[AppointmentStatusItem])
async def appointment_status(db: AsyncSession = Depends(get_db)) -> list[AppointmentStatusItem]:
    return await analytics_repo.get_appointment_status_breakdown(db)
