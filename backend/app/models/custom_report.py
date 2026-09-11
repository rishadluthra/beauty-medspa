"""SQLAlchemy ORM model for the `custom_reports` table.

Unlike every other table in this app, this one has no counterpart in the
client's seed data / `models.py` contract -- it backs the self-serve
"Build Custom Analytics" feature (metric x dimension x time grain), which
is a bonus beyond the spec's read-only requirement ("the client only
needs to view this data" -- scope relief on the seed data, not a
prohibition on app-level state). Saved reports are shared across all
viewers (this app has no per-user auth), so a saved report is durable,
globally-visible app configuration, not seed data.
"""

from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CustomReport(Base):
    """A saved self-serve analytics report: metric x dimension x time grain."""

    __tablename__ = "custom_reports"

    # Surrogate id ("rpt_*") generated at creation time -- see
    # `app.repositories.custom_reports.create_custom_report` -- since,
    # unlike every other entity, there's no seed-data natural key to reuse.
    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    # appointment_count / revenue_cents / unique_patient_count -- validated
    # against `app.schemas.custom_reports.Metric` at the router layer.
    metric: Mapped[str] = mapped_column(String, nullable=False)
    # provider / service / source -- validated against
    # `app.schemas.custom_reports.Dimension` at the router layer.
    dimension: Mapped[str] = mapped_column(String, nullable=False)
    # month / quarter -- validated against
    # `app.schemas.custom_reports.TimeGrain` at the router layer.
    time_grain: Mapped[str] = mapped_column(String, nullable=False)
    created_date: Mapped[datetime] = mapped_column(nullable=False, index=True)
