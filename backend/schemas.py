"""Pydantic schemas — request/response shapes for the API.

These are the contracts the React frontend depends on.
Field names use camelCase aliases so JSON responses match
the existing mockData.js field names — no frontend changes needed.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
import uuid
from pydantic import BaseModel, ConfigDict, Field


# ---------- Incident ----------

class IncidentReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    reportId: str
    reporter: str
    reporterReliability: float = 3.0
    description: str = ""
    severity: str = "Medium"
    location: str = ""
    fullLocation: str = ""
    coords: dict = {}
    reportedAt: str = ""
    reportedTimeFull: str = ""
    mediaUrls: List[str] = []
    mediaCount: int = 0
    source: str = "Web App"
    aiAssessment: Optional[str] = None
    mediaAuthenticity: Optional[Dict[str, Any]] = None


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
    mediaAuthenticity: Optional[Dict[str, Any]] = None
    nearbyVerifications: int = 0
    contradictions: int = 0
    avgReliability: float = 0.0
    mapPosition: dict = {}
    reportCount: int = 1
    isConsolidated: bool = False
    reports: List[IncidentReportOut] = []
    isActive: bool = True
    status: str = "active"

    @classmethod
    def from_mongo_doc(cls, inc: dict, verif_list: list[dict]):
        confirmations = sum(1 for v in verif_list if v.get("verdict") == "confirm")
        contradictions = sum(1 for v in verif_list if v.get("verdict") == "contradict")
        
        reported_at_full = inc.get("reported_at_full")

        raw_reports = inc.get("reports")
        reports_out = []
        if raw_reports:
            for r in raw_reports:
                r_time = r.get("reported_at")
                reports_out.append(IncidentReportOut(
                    reportId=r.get("report_id") or f"rep-{uuid.uuid4().hex[:8]}",
                    reporter=r.get("reporter", "Anonymous"),
                    reporterReliability=float(r.get("reporter_reliability", 3.0)),
                    description=r.get("description", ""),
                    severity=r.get("severity", "Medium"),
                    location=r.get("location", ""),
                    fullLocation=r.get("full_location", ""),
                    coords={"lat": r.get("lat", 0.0), "lng": r.get("lng", 0.0)},
                    reportedAt=_relative_time(r_time),
                    reportedTimeFull=_format_dt(r_time),
                    mediaUrls=r.get("media_urls", []),
                    mediaCount=len(r.get("media_urls", [])),
                    source=r.get("source", "Web App"),
                    aiAssessment=r.get("ai_assessment"),
                    mediaAuthenticity=r.get("media_authenticity"),
                ))
        else:
            reports_out.append(IncidentReportOut(
                reportId=f"rep-{str(inc.get('id') or inc.get('_id', 'primary'))[-8:]}",
                reporter=inc.get("reporter", "Anonymous"),
                reporterReliability=float(inc.get("reporter_reliability", 3.0)),
                description=inc.get("description", ""),
                severity=inc.get("severity", "Medium"),
                location=inc.get("location", ""),
                fullLocation=inc.get("full_location", ""),
                coords={"lat": inc.get("lat", 0.0), "lng": inc.get("lng", 0.0)},
                reportedAt=_relative_time(reported_at_full),
                reportedTimeFull=_format_dt(reported_at_full),
                mediaUrls=inc.get("media_urls", []),
                mediaCount=len(inc.get("media_urls", [])) or inc.get("media_count", 0),
                source=inc.get("source", "Web App"),
                aiAssessment=inc.get("ai_assessment"),
                mediaAuthenticity=inc.get("media_authenticity"),
            ))

        report_count = inc.get("report_count") or len(reports_out)
        is_consolidated = inc.get("is_consolidated", report_count > 1)
        is_active = bool(inc.get("is_active", 1))
        status_val = inc.get("status", "active" if is_active else "expired")

        reliabilities = []
        if raw_reports:
            for r in raw_reports:
                if r.get("reporter_reliability") is not None:
                    reliabilities.append(float(r["reporter_reliability"]))
        elif inc.get("reporter_reliability") is not None:
            reliabilities.append(float(inc["reporter_reliability"]))

        for v in (verif_list or []):
            if v.get("voter_reliability") is not None:
                reliabilities.append(float(v["voter_reliability"]))
            elif v.get("reliability_score") is not None:
                reliabilities.append(float(v["reliability_score"]))
        avg_rel = round(sum(reliabilities) / len(reliabilities), 1) if reliabilities else 4.0

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
            mediaAuthenticity=inc.get("media_authenticity"),
            nearbyVerifications=confirmations,
            contradictions=contradictions,
            avgReliability=avg_rel,
            mapPosition={"top": inc.get("map_position_top", "50%"), "left": inc.get("map_position_left", "50%")},
            reportCount=report_count,
            isConsolidated=is_consolidated,
            reports=reports_out,
            isActive=is_active,
            status=status_val,
        )


# ---------- Verification ----------

class VerificationCreate(BaseModel):
    verdict: str   # "confirm" | "contradict"
    user_id: Optional[Any] = None


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
    lat: Optional[float] = None
    lng: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


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
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    location: Optional[Dict[str, Any]] = None
    lastKnownLocation: Optional[Dict[str, Any]] = None


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
