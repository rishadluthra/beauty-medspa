"""Shared SQLAlchemy declarative base class for all ORM models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Common declarative base every model inherits from.

    Having a single shared base (rather than each model defining its own)
    is what lets SQLAlchemy's metadata/table registry and Alembic
    autogeneration see all models together.
    """

    pass
