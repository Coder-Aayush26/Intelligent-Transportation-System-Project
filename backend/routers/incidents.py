"""Incidents router — CRUD endpoints for traffic incidents."""
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..schemas import IncidentCreate, IncidentOut, StatsOut

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _confidence_from_verifications(verif_list) -> int:
    """Simple rule: base 50 + 5 per confirm - 8 per contradict, capped 5-99."""
    confirmations = sum(1 for v in verif_list if v.get("verdict") == "confirm")
    contradictions = sum(1 for v in verif_list if v.get("verdict") == "contradict")
    score = 50 + confirmations * 5 - contradictions * 8
    return max(5, min(99, score))


@router.get("/", response_model=List[IncidentOut])
async def list_incidents(db = Depends(get_db)):
    """Return all currently active incidents."""
    incidents_cursor = db.incidents.find({"is_active": 1})
    incidents = await incidents_cursor.to_list(length=200)
    
    result = []
    for inc in incidents:
        verif_cursor = db.verifications.find({"incident_id": inc["id"]})
        verif = await verif_cursor.to_list(length=500)
        inc["confidence"] = _confidence_from_verifications(verif)
        result.append(IncidentOut.from_mongo_doc(inc, verif))
    return result


@router.post("/", response_model=IncidentOut, status_code=201)
async def create_incident(payload: IncidentCreate, db = Depends(get_db)):
    """Create a new incident report."""
    incident_id = f"inc-{uuid.uuid4().hex[:8]}"
    
    inc_doc = {
        "_id": incident_id,
        "id": incident_id,
        "category": payload.category,
        "location": payload.location,
        "full_location": payload.full_location,
        "lat": payload.lat,
        "lng": payload.lng,
        "severity": payload.severity,
        "confidence": 50,  # starts at 50; rises/falls with verifications
        "description": payload.description,
        "reporter": payload.reporter,
        "source": payload.source,
        "media_count": 0,
        "ai_assessment": "Pending",
        "map_position_top": "50%",
        "map_position_left": "50%",
        "reported_at_full": datetime.utcnow(),
        "is_active": 1,
    }
    
    await db.incidents.insert_one(inc_doc)
    return IncidentOut.from_mongo_doc(inc_doc, [])


# IMPORTANT: this literal route MUST come before /{incident_id} so FastAPI
# does not match the string "stats" as an incident ID.
@router.get("/stats/summary", response_model=StatsOut)
async def get_stats(db = Depends(get_db)):
    """Aggregated dashboard stats."""
    active_cursor = db.incidents.find({"is_active": 1})
    active_incidents = await active_cursor.to_list(length=200)
    
    high_conf = [i for i in active_incidents if i.get("confidence", 50) >= 80]
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_reports = await db.incidents.count_documents({
        "reported_at_full": {"$gte": today_start}
    })
    
    verified = 0
    for inc in active_incidents:
        verif_count = await db.verifications.count_documents({
            "incident_id": inc["id"],
            "verdict": "confirm",
        })
        if verif_count >= 1:
            verified += 1
            
    return StatsOut(
        totalActive=len(active_incidents),
        highConfidence=len(high_conf),
        reportsToday=today_reports,
        verifiedToday=verified,
    )


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident(incident_id: str, db = Depends(get_db)):
    """Return a single incident by ID."""
    inc = await db.incidents.find_one({"id": incident_id})
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    verif_cursor = db.verifications.find({"incident_id": inc["id"]})
    verif = await verif_cursor.to_list(length=500)
    
    inc["confidence"] = _confidence_from_verifications(verif)
    return IncidentOut.from_mongo_doc(inc, verif)
