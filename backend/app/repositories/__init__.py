"""Data-access layer.

Each module in this package exposes typed, parameterized, reusable async
query functions against the database (patients, analytics, ...). These
functions are the single source of truth for how data is fetched and
aggregated — FastAPI routers call them as thin wrappers, and they are also
designed to be callable directly by a future AI/natural-language-query
service (as "tools") without needing bespoke endpoints. Keeping query logic
here rather than inline in routers is what makes the architecture AI-ready.
"""
