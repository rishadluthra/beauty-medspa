from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories import analytics as analytics_repo
from app.schemas.analytics import OverviewStats, RevenuePoint

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewStats)
async def overview(db: AsyncSession = Depends(get_db)) -> OverviewStats:
    return await analytics_repo.get_overview_stats(db)


@router.get("/revenue-over-time", response_model=list[RevenuePoint])
async def revenue_over_time(db: AsyncSession = Depends(get_db)) -> list[RevenuePoint]:
    return await analytics_repo.get_revenue_over_time(db)
