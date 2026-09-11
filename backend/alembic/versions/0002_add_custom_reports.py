"""add custom_reports table

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-11

Backs the self-serve "Build Custom Analytics" feature. Unlike every table
in 0001, this one has no counterpart in the client's seed data -- see
`app.models.custom_report` for why it still belongs in the schema.
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "custom_reports",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("metric", sa.String(), nullable=False),
        sa.Column("dimension", sa.String(), nullable=False),
        sa.Column("time_grain", sa.String(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )
    # Indexed since the list endpoint always orders by creation time.
    op.create_index("ix_custom_reports_created_date", "custom_reports", ["created_date"])


def downgrade() -> None:
    op.drop_index("ix_custom_reports_created_date", table_name="custom_reports")
    op.drop_table("custom_reports")
