from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import analytics, patients

app = FastAPI(title="Beauty Med Spa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(analytics.router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
