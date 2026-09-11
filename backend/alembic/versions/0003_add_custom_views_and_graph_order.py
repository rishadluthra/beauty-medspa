"""add custom_views and graph_order tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-11

Backs the "Create Custom View" / reorderable "All Graphs" tab feature.
Like 0002's custom_reports table, neither of these has a counterpart in
the client's seed data -- see `app.models.custom_view` / `app.models.graph_order`.
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "custom_views",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("chart_refs", sa.ARRAY(sa.String()), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_custom_views_created_date", "custom_views", ["created_date"])

    op.create_table(
        "graph_order",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("chart_refs", sa.ARRAY(sa.String()), nullable=False),
        sa.Column("updated_date", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("graph_order")
    op.drop_index("ix_custom_views_created_date", table_name="custom_views")
    op.drop_table("custom_views")
