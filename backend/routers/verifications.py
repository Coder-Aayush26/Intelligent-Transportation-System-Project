"""Verifications router — community confirmation/contradiction of incidents."""
from datetime import datetime, timezone
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..schemas import VerificationCreate, VerificationOut
from ..auth import get_current_user_optional

router = APIRouter(tags=["verifications"])


@router.post("/incidents/{incident_id}/verify", response_model=VerificationOut, status_code=201)
@router.post("/incidents/{incident_id}/verify/", response_model=VerificationOut, status_code=201)
async def verify_incident(
    incident_id: str,
    payload: VerificationCreate,
    db = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Submit a community verification (confirm or contradict) for an incident."""
    if payload.verdict not in ("confirm", "contradict"):
        raise HTTPException(status_code=422, detail="verdict must be 'confirm' or 'contradict'")

    inc = await db.incidents.find_one({"id": incident_id})
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    voter_reliability = 3.0
    if current_user and current_user.get("reliability_score") is not None:
        voter_reliability = float(current_user["reliability_score"])
    elif payload.user_id:
        user_doc = await db.users.find_one({"$or": [{"id": payload.user_id}, {"_id": payload.user_id}]})
        if user_doc and user_doc.get("reliability_score") is not None:
            voter_reliability = float(user_doc["reliability_score"])

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    doc_id = uuid.uuid4().hex
    v_doc = {
        "_id": doc_id,
        "incident_id": incident_id,
        "user_id": payload.user_id or (str(current_user.get("_id", current_user.get("id", ""))) if current_user else None),
        "verdict": payload.verdict,
        "voter_reliability": voter_reliability,
        "created_at": now,
    }

    await db.verifications.insert_one(v_doc)
    await db.incidents.update_one({"id": incident_id}, {"$set": {"last_activity_at": now}})

    return VerificationOut(
        id=doc_id,
        incident_id=incident_id,
        verdict=payload.verdict
    )
