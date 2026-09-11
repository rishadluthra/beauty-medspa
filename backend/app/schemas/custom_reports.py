"""Request/response schemas for the self-serve "Build Custom Analytics" feature.

`Metric`, `Dimension`, and `TimeGrain` are the fixed option lists the
frontend's modal offers -- FastAPI/Pydantic reject any other value at the
request boundary, so `app.repositories.custom_reports` never has to
defend against an unrecognized value reaching its query-building branches.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Metric(str, Enum):
    """What to measure, per (period, dimension value) bucket."""

    appointment_count = "appointment_count"
    revenue_cents = "revenue_cents"
    unique_patient_count = "unique_patient_count"


class Dimension(str, Enum):
    """What to break the metric down by."""

    provider = "provider"
    service = "service"
    source = "source"


class TimeGrain(str, Enum):
    """How to bucket time along the x-axis."""

    month = "month"
    quarter = "quarter"


class CustomReportCreate(BaseModel):
    """Request body for `POST /api/custom-reports`."""

    title: str = Field(min_length=1, max_length=80)
    metric: Metric
    dimension: Dimension
    time_grain: TimeGrain


class CustomReportPoint(BaseModel):
    """One (period, dimension value) cell of a custom report's pivot data."""

    period: str  # "YYYY-MM" or "YYYY-Q#", depending on the report's time_grain
    dimension_value: str  # human-readable (e.g. a provider's full name, not their id)
    value: int  # a count, or integer cents for revenue_cents


class CustomReport(BaseModel):
    """A saved custom report, with its pivot data computed inline.

    Returned by both create and list so the frontend never needs a second
    round trip just to render a report it already has the id for.
    """

    id: str
    title: str
    metric: Metric
    dimension: Dimension
    time_grain: TimeGrain
    created_date: datetime
    data: list[CustomReportPoint]
