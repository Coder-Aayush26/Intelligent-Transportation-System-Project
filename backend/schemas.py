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
    media_urls: List[str] = []


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
    mediaUrls: List[str] = []
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
            id=inc.get("id") or str(inc.get("_id", "")),
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
            mediaCount=len(inc.get("media_urls", [])) or inc.get("media_count", 0),
            mediaUrls=inc.get("media_urls", []),
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
    id: str
    incident_id: str
    verdict: str


# ---------- User & Settings ----------

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserSettingsUpdate(BaseModel):
    notificationRadius: Optional[float] = None
    nearbyVerificationRequests: Optional[bool] = None
    nearbyNewIncidents: Optional[bool] = None
    highSeverityAlerts: Optional[bool] = None
    categories: Optional[Dict[str, bool]] = None
    locationSharingEnabled: Optional[bool] = None
    browserNotificationsEnabled: Optional[bool] = None


class UserLocationUpdate(BaseModel):
    lat: float
    lng: float


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: Any = "0"
    name: str
    fullName: str = ""
    email: str
    avatarUrl: Optional[str] = None
    memberSince: str = ""
    reliabilityScore: Optional[float] = 3.0
    reliabilityLabel: Optional[str] = "Average"
    totalReports: int = 0
    totalVerifications: int = 0
    scoreFactors: list[str] = []
    recentActivity: list[dict] = []
    settings: Optional[Dict[str, Any]] = None


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
