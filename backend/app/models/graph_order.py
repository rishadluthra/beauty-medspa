"""SQLAlchemy ORM model for the `graph_order` table.

Backs the "All Graphs" tab's manually-reorderable display order. Always
exactly one row (the fixed id `"singleton"`) -- there's only ever one "All
Graphs" tab, shared across every viewer (this app has no per-user auth),
so a single-row table is simpler than a dedicated key-value config table
for the one setting this app currently needs to persist outside the
per-entity tables. See `app.repositories.custom_views.get_graph_order` for
how the row is lazily created (seeded with the 7 default chart keys) the
first time it's read.
"""

from datetime import datetime

from sqlalchemy import ARRAY, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GraphOrder(Base):
    """The single persisted display order for the Analytics page's "All Graphs" tab."""

    __tablename__ = "graph_order"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    chart_refs: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    updated_date: Mapped[datetime] = mapped_column(nullable=False)
