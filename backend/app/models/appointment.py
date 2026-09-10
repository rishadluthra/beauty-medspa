from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_date: Mapped[datetime] = mapped_column(nullable=False)

    # Relationship to Patient for SQLAlchemy async session flush ordering
    patient: Mapped["Patient"] = relationship("Patient", foreign_keys=[patient_id])
