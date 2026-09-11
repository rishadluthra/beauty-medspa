"""SQLAlchemy ORM model for the `custom_views` table.

Backs the "Create Custom View" feature: a named, user-curated dashboard
that's just an ORDERED LIST of references to graphs that already exist
elsewhere -- either a fixed default chart (`"default:<key>"`, see
`app.repositories.custom_views.DEFAULT_CHART_KEYS`) or a saved custom
report (`"custom:<report_id>"`). A view is deliberately a live pointer
list, not a data snapshot: it stores no chart data of its own, so every
graph it shows always reflects current data, and deleting the underlying
custom report a view points to just means that one card quietly stops
appearing (no dangling-reference errors) rather than the view needing to
be kept in sync on every report delete.

Like `CustomReport`, this table has no seed-data counterpart -- it's part
of the same bonus self-serve analytics feature, sharing that feature's
non-GET endpoints.
"""

from datetime import datetime

from sqlalchemy import ARRAY, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CustomView(Base):
    """A named, ordered list of chart references -- a user-curated dashboard tab."""

    __tablename__ = "custom_views"

    # Surrogate id ("view_*"), same pattern as CustomReport's "rpt_*".
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Ordered array of "default:<key>" / "custom:<report_id>" strings.
    # A Postgres ARRAY column (not a join table) since order is exactly
    # what's being stored and a join table would need its own position
    # column to express that anyway -- this is simpler for a list that's
    # always read/written as a whole, never queried by individual element.
    chart_refs: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    created_date: Mapped[datetime] = mapped_column(nullable=False, index=True)
