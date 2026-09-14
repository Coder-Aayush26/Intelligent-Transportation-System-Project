"""SQLAlchemy engine + session factory.

Uses SQLite by default (zero config, perfect for local dev).
Set DATABASE_URL env var to switch to PostgreSQL/PostGIS:
  DATABASE_URL=postgresql+psycopg2://user:pw@localhost/its
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./its.db")

# SQLite needs check_same_thread=False for multi-threaded web use.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session and ensures it is closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
