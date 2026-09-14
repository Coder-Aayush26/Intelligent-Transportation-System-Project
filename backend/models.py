"""ORM models — maps Python classes to database tables.

Shape mirrors the mock data in src/data/mockData.js so the
frontend components need no changes to field names.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, index=True)
    category = Column(String, nullable=False)
    location = Column(String, nullable=False)
    full_location = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    severity = Column(String, nullable=False, default="Medium")
    confidence = Column(Integer, nullable=False, default=50)
    description = Column(Text, nullable=True)
    reporter = Column(String, nullable=False, default="Anonymous")
    source = Column(String, nullable=False, default="Web App")
    media_count = Column(Integer, nullable=False, default=0)
    ai_assessment = Column(String, nullable=True)
    map_position_top = Column(String, nullable=False, default="50%")
    map_position_left = Column(String, nullable=False, default="50%")
    reported_at_full = Column(DateTime, nullable=False, default=datetime.utcnow)
    is_active = Column(Integer, nullable=False, default=1)

    verifications = relationship("Verification", back_populates="incident",
                                 cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    member_since = Column(String, nullable=False)
    reliability_score = Column(Float, nullable=False, default=3.0)
    reliability_label = Column(String, nullable=False, default="Average")


class Verification(Base):
    __tablename__ = "verifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verdict = Column(String, nullable=False)   # "confirm" | "contradict"
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="verifications")
