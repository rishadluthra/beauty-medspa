"""SQLAlchemy ORM model for the `patients` table.

Maps to the client's `Patient` contract in the repo-root `models.py` /
`seed_data/patient.json`. A patient has many appointments and many payments
(see Appointment.patient_id / Payment.patient_id).
"""

from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Patient(Base):
    """A patient record: demographics plus acquisition `source`."""

    __tablename__ = "patients"

    # Natural key: the client's seed data uses prefixed string IDs
    # ("pat_*") rather than surrogate integers/UUIDs, so we preserve them
    # as-is as the primary key instead of mapping to a synthetic int PK.
    id: Mapped[str] = mapped_column(String, primary_key=True)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    date_of_birth: Mapped[datetime] = mapped_column(nullable=False)
    gender: Mapped[str] = mapped_column(String, nullable=False)
    address: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    # Marketing channel the patient was acquired through (in_person, phone,
    # instagram, tiktok, google, website); indexed since analytics queries
    # group/filter by this.
    source: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_date: Mapped[datetime] = mapped_column(nullable=False, index=True)
