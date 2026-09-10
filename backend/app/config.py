from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/beauty_medspa"
    cors_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
