"""SQLAlchemy ORM model for the `services` table.

Maps to the client's `Service` contract in the repo-root `models.py` /
`seed_data/service.json`. A service is a billable offering (e.g. a
particular treatment) that gets attached to appointments via
AppointmentService.
"""

from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Service(Base):
    """A billable offering with a fixed price and expected duration."""

    __tablename__ = "services"

    # Natural key from seed data ("svc_*"), not a surrogate integer PK.
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    # Integer cents, never a float — avoids floating-point rounding issues
    # in money math. Matches Payment.amount's convention.
    price: Mapped[int] = mapped_column(nullable=False)
    duration: Mapped[int] = mapped_column(nullable=False)  # minutes
    created_date: Mapped[datetime] = mapped_column(nullable=False)
