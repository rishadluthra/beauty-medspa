"""SQLAlchemy ORM model for the `providers` table.

Maps to the client's `Provider` contract in the repo-root `models.py` /
`seed_data/provider.json`. A provider is the staff member who performs a
service on an appointment (see AppointmentService.provider_id).
"""

from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Provider(Base):
    """A staff member (e.g. nurse, doctor) who performs services."""

    __tablename__ = "providers"

    # Natural key from seed data ("prv_*"), not a surrogate integer PK.
    id: Mapped[str] = mapped_column(String, primary_key=True)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    created_date: Mapped[datetime] = mapped_column(nullable=False)
