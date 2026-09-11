"""Request/response schemas for custom views and the "All Graphs" order.

Both features share one shape -- an ordered list of chart-reference
strings -- so `GraphOrder`/`GraphOrderUpdate` and `CustomView`/
`CustomViewCreate` are deliberately parallel. A chart ref is either
`"default:<key>"` (one of `app.repositories.custom_views.DEFAULT_CHART_KEYS`)
or `"custom:<report_id>"` (a saved `CustomReport.id`); validated loosely
(non-empty strings) rather than against a strict pattern, matching this
app's general preference for not over-validating an internal, non-security-
sensitive shape.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class GraphOrder(BaseModel):
    """The current display order for the Analytics page's "All Graphs" tab."""

    chart_refs: list[str]


class GraphOrderUpdate(BaseModel):
    """Request body for `PUT /api/graph-order` (full replacement, not a patch)."""

    chart_refs: list[str] = Field(min_length=1)


class CustomViewCreate(BaseModel):
    """Request body for `POST /api/custom-views`."""

    name: str = Field(min_length=1, max_length=80)
    chart_refs: list[str] = Field(min_length=1)


class CustomView(BaseModel):
    """A saved custom view: a named, ordered list of chart references."""

    id: str
    name: str
    chart_refs: list[str]
    created_date: datetime
