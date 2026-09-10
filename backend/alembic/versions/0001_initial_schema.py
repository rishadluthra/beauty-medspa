"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "patients",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("date_of_birth", sa.DateTime(), nullable=False),
        sa.Column("gender", sa.String(), nullable=False),
        sa.Column("address", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_patients_source", "patients", ["source"])
    op.create_index("ix_patients_created_date", "patients", ["created_date"])

    op.create_table(
        "providers",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "services",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("duration", sa.Integer(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "appointments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("patient_id", sa.String(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_appointments_patient_id", "appointments", ["patient_id"])
    op.create_index("ix_appointments_status", "appointments", ["status"])

    op.create_table(
        "appointment_services",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("appointment_id", sa.String(), sa.ForeignKey("appointments.id"), nullable=False),
        sa.Column("service_id", sa.String(), sa.ForeignKey("services.id"), nullable=False),
        sa.Column("provider_id", sa.String(), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("start", sa.DateTime(), nullable=False),
        sa.Column("end", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_appointment_services_appointment_id", "appointment_services", ["appointment_id"])
    op.create_index("ix_appointment_services_service_id", "appointment_services", ["service_id"])
    op.create_index("ix_appointment_services_provider_id", "appointment_services", ["provider_id"])
    op.create_index("ix_appointment_services_start", "appointment_services", ["start"])

    op.create_table(
        "payments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("patient_id", sa.String(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("date", sa.DateTime(), nullable=False),
        sa.Column("method", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("provider_id", sa.String(), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("appointment_id", sa.String(), sa.ForeignKey("appointments.id"), nullable=False),
        sa.Column("service_id", sa.String(), sa.ForeignKey("services.id"), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_payments_patient_id", "payments", ["patient_id"])
    op.create_index("ix_payments_appointment_id", "payments", ["appointment_id"])
    op.create_index("ix_payments_date", "payments", ["date"])
    op.create_index("ix_payments_status", "payments", ["status"])


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("appointment_services")
    op.drop_table("appointments")
    op.drop_table("services")
    op.drop_table("providers")
    op.drop_table("patients")
