"""FastAPI routers.

Each module defines an APIRouter for one area of the API (patients,
analytics, ...). Routers are intentionally thin: they parse/validate
request parameters and delegate to functions in `app.repositories` for the
actual query logic, so the same query functions can be reused outside the
REST layer (e.g. by a future natural-language-query service).
"""
