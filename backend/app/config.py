"""Application configuration.

Loads runtime settings from environment variables (falling back to a local
`.env` file) via pydantic-settings, so the same code works unchanged across
local dev, CI, and the deployed environment — only the environment differs.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application settings, populated from env vars / `.env`.

    Field names are matched case-insensitively against env vars by
    pydantic-settings (e.g. `DATABASE_URL` -> `database_url`).
    """

    # asyncpg driver URL for the async SQLAlchemy engine (see app/db.py).
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/beauty_medspa"
    # Comma-separated list of origins allowed to call this API (see app/main.py's
    # CORS setup) — in production this is restricted to the deployed frontend URL.
    cors_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env")


# Singleton settings instance imported throughout the app instead of
# re-reading the environment/`.env` file in multiple places.
settings = Settings()
