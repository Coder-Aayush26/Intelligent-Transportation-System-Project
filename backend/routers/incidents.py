"""Incidents router — CRUD endpoints for traffic incidents."""
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Incident, Verification
from ..schemas import IncidentCreate, IncidentOut, StatsOut

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _confidence_from_verifications(inc: Incident, verif_list) -> int:
    """Simple rule: base 50 + 5 per confirm - 8 per contradict, capped 5-99."""
    confirmations = sum(1 for v in verif_list if v.verdict == "confirm")
    contradictions = sum(1 for v in verif_list if v.verdict == "contradict")
    score = 50 + confirmations * 5 - contradictions * 8
    return max(5, min(99, score))


@router.get("/", response_model=List[IncidentOut])
def list_incidents(db: Session = Depends(get_db)):
    """Return all currently active incidents."""
    incidents = db.query(Incident).filter(Incident.is_active == 1).all()
    result = []
    for inc in incidents:
        verif = db.query(Verification).filter(Verification.incident_id == inc.id).all()
        inc.confidence = _confidence_from_verifications(inc, verif)
        result.append(IncidentOut.from_orm_incident(inc, verif))
    return result


@router.post("/", response_model=IncidentOut, status_code=201)
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    """Create a new incident report."""
    incident_id = f"inc-{uuid.uuid4().hex[:8]}"
    inc = Incident(
        id=incident_id,
        category=payload.category,
        location=payload.location,
        full_location=payload.full_location,
        lat=payload.lat,
        lng=payload.lng,
        severity=payload.severity,
        confidence=50,  # starts at 50; rises/falls with verifications
        description=payload.description,
        reporter=payload.reporter,
        source=payload.source,
        media_count=0,
        ai_assessment="Pending",
        map_position_top="50%",
        map_position_left="50%",
        reported_at_full=datetime.utcnow(),
        is_active=1,
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return IncidentOut.from_orm_incident(inc, [])


# IMPORTANT: this literal route MUST come before /{incident_id} so FastAPI
# does not match the string "stats" as an incident ID.
@router.get("/stats/summary", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    """Aggregated dashboard stats."""
    active = db.query(Incident).filter(Incident.is_active == 1).all()
    high_conf = [i for i in active if i.confidence >= 80]
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_reports = db.query(Incident).filter(
        Incident.reported_at_full >= today_start
    ).count()
    # Treat incidents with >= 1 confirmation as "verified"
    verified = 0
    for inc in active:
        verif = db.query(Verification).filter(
            Verification.incident_id == inc.id,
            Verification.verdict == "confirm",
        ).count()
        if verif >= 1:
            verified += 1
    return StatsOut(
        totalActive=len(active),
        highConfidence=len(high_conf),
        reportsToday=today_reports,
        verifiedToday=verified,
    )


@router.get("/{incident_id}", response_model=IncidentOut)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    """Return a single incident by ID."""
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    verif = db.query(Verification).filter(Verification.incident_id == inc.id).all()
    inc.confidence = _confidence_from_verifications(inc, verif)
    return IncidentOut.from_orm_incident(inc, verif)
