"""Verifications router — community confirmation/contradiction of incidents."""
from datetime import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..schemas import VerificationCreate, VerificationOut

router = APIRouter(tags=["verifications"])


@router.post("/incidents/{incident_id}/verify", response_model=VerificationOut, status_code=201)
async def verify_incident(
    incident_id: str,
    payload: VerificationCreate,
    db = Depends(get_db),
):
    """Submit a community verification (confirm or contradict) for an incident."""
    if payload.verdict not in ("confirm", "contradict"):
        raise HTTPException(status_code=422, detail="verdict must be 'confirm' or 'contradict'")

    inc = await db.incidents.find_one({"id": incident_id})
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    doc_id = uuid.uuid4().hex
    v_doc = {
        "_id": doc_id,
        "incident_id": incident_id,
        "user_id": payload.user_id,
        "verdict": payload.verdict,
        "created_at": datetime.utcnow()
    }
    
    await db.verifications.insert_one(v_doc)
    # Recompute incident confidence using the new scoring engine
    from ..services.confidence import compute_total_confidence
    inc = await db.incidents.find_one({"id": incident_id})
    if inc:
        # Determine user document for reliability factor (use verifier if provided)
        user_doc = {}
        if payload.user_id:
            user_doc = await db.users.find_one({"_id": payload.user_id}) or {}
        conf_result = await compute_total_confidence(
            description=inc.get("description", ""),
            media_urls=inc.get("media_urls", []),
            lat=inc.get("lat", 0.0),
            lng=inc.get("lng", 0.0),
            user_doc=user_doc,
            db=db,
        )
        await db.incidents.update_one(
            {"id": incident_id},
            {"$set": {
                "confidence_score": conf_result["confidence_score"],
                "media_alignment_score": conf_result["media_alignment_score"],
                "confidence": int(conf_result["confidence_score"])},
            },
        )
    return VerificationOut(
        id=doc_id,
        incident_id=incident_id,
        verdict=payload.verdict
    )
