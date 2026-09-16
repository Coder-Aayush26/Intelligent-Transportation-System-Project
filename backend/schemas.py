"""Pydantic schemas — request/response shapes for the API.

These are the contracts the React frontend depends on.
Field names use camelCase aliases so JSON responses match
the existing mockData.js field names — no frontend changes needed.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


# ---------- Incident ----------

class IncidentCreate(BaseModel):
    category: str
    severity: str = "Medium"
    description: str
    location: str = "Unknown"
    full_location: str = "Unknown"
    lat: float = 0.0
    lng: float = 0.0
    reporter: str = "Anonymous"
    source: str = "Web App"


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str = Field(alias="_id")  # In Mongo, we'll store custom 'id' or map '_id' -> id. For now we use custom string 'id'
    category: str
    location: str
    fullLocation: str = ""
    coords: dict = {}
    reportedAt: str = ""
    reportedTimeFull: str = ""
    severity: str
    confidence: int
    reporter: str
    description: Optional[str] = ""
    source: str
    mediaCount: int = 0
    verifications: int = 0
    aiAssessment: Optional[str] = None
    nearbyVerifications: int = 0
    contradictions: int = 0
    avgReliability: float = 0.0
    mapPosition: dict = {}

    @classmethod
    def from_mongo_doc(cls, inc: dict, verif_list: list[dict]):
        confirmations = sum(1 for v in verif_list if v.get("verdict") == "confirm")
        contradictions = sum(1 for v in verif_list if v.get("verdict") == "contradict")
        
        reported_at_full = inc.get("reported_at_full")
        
        return cls(
            _id=inc.get("id"), # Map custom 'id' field
            category=inc.get("category", "Unknown"),
            location=inc.get("location", ""),
            fullLocation=inc.get("full_location", ""),
            coords={"lat": inc.get("lat", 0.0), "lng": inc.get("lng", 0.0)},
            reportedAt=_relative_time(reported_at_full),
            reportedTimeFull=_format_dt(reported_at_full),
            severity=inc.get("severity", "Medium"),
            confidence=inc.get("confidence", 50),
            reporter=inc.get("reporter", "Anonymous"),
            description=inc.get("description", ""),
            source=inc.get("source", "Web App"),
            mediaCount=inc.get("media_count", 0),
            verifications=len(verif_list),
            aiAssessment=inc.get("ai_assessment"),
            nearbyVerifications=confirmations,
            contradictions=contradictions,
            avgReliability=4.0,
            mapPosition={"top": inc.get("map_position_top", "50%"), "left": inc.get("map_position_left", "50%")},
        )


# ---------- Verification ----------

class VerificationCreate(BaseModel):
    verdict: str   # "confirm" | "contradict"
    user_id: Optional[int] = None


class VerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str = Field(alias="_id")
    incident_id: str
    verdict: str


# ---------- User ----------

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: int
    name: str
    fullName: str = ""
    email: str
    memberSince: str = ""
    reliabilityScore: float = 3.0
    reliabilityLabel: str = "Average"
    scoreFactors: list[str] = []
    recentActivity: list[dict] = []


# ---------- Stats ----------

class StatsOut(BaseModel):
    totalActive: int
    highConfidence: int
    reportsToday: int
    verifiedToday: int


# ---------- helpers ----------

def _relative_time(dt: datetime) -> str:
    if not isinstance(dt, datetime):
        return "recently"
    diff = datetime.utcnow() - dt
    minutes = int(diff.total_seconds() / 60)
    if minutes < 1:
        return "just now"
    if minutes < 60:
        return f"{minutes} min{'s' if minutes != 1 else ''} ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    days = hours // 24
    return f"{days} day{'s' if days != 1 else ''} ago"


def _format_dt(dt: datetime) -> str:
    """Cross-platform datetime formatter (%-d is Linux-only)."""
    if not isinstance(dt, datetime):
        return ""
    # %d gives zero-padded day; lstrip removes the leading zero on single-digit days.
    day = dt.strftime("%d").lstrip("0") or "0"
    return dt.strftime(f"{day} %b %Y, %I:%M %p")
