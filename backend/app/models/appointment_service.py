"""SQLAlchemy ORM model for the `appointment_services` table.

Maps to the client's `AppointmentService` contract in the repo-root
`models.py` / `seed_data/appointment_service.json`. This is the many-to-many
hinge of the whole schema: it links one appointment to a (service, provider,
time window) triple, and an appointment can have several of these rows
(e.g. consultation -> blood test -> X-ray, potentially with different
providers each).
"""

from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AppointmentService(Base):
    """One (service, provider, start/end) line item within an appointment."""

    __tablename__ = "appointment_services"

    # Unlike every other model in this app, this entity has no natural key
    # in the client's data model (the seed data doesn't give join rows an
    # id), so we use a surrogate auto-incrementing integer PK here instead
    # of a prefixed string id.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    appointment_id: Mapped[str] = mapped_column(ForeignKey("appointments.id"), nullable=False, index=True)
    service_id: Mapped[str] = mapped_column(ForeignKey("services.id"), nullable=False, index=True)
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)
    start: Mapped[datetime] = mapped_column(nullable=False, index=True)
    end: Mapped[datetime] = mapped_column(nullable=False)
