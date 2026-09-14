"""Pydantic schemas — request/response shapes for the API.

These are the contracts the React frontend depends on.
Field names use camelCase aliases so JSON responses match
the existing mockData.js field names — no frontend changes needed.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


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

    id: str
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
    def from_orm_incident(cls, inc, verif_list):
        confirmations = sum(1 for v in verif_list if v.verdict == "confirm")
        contradictions = sum(1 for v in verif_list if v.verdict == "contradict")
        return cls(
            id=inc.id,
            category=inc.category,
            location=inc.location,
            fullLocation=inc.full_location,
            coords={"lat": inc.lat, "lng": inc.lng},
            reportedAt=_relative_time(inc.reported_at_full),
            reportedTimeFull=_format_dt(inc.reported_at_full),
            severity=inc.severity,
            confidence=inc.confidence,
            reporter=inc.reporter,
            description=inc.description or "",
            source=inc.source,
            mediaCount=inc.media_count,
            verifications=len(verif_list),
            aiAssessment=inc.ai_assessment,
            nearbyVerifications=confirmations,
            contradictions=contradictions,
            avgReliability=4.0,
            mapPosition={"top": inc.map_position_top, "left": inc.map_position_left},
        )


# ---------- Verification ----------

class VerificationCreate(BaseModel):
    verdict: str   # "confirm" | "contradict"
    user_id: Optional[int] = None


class VerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
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
