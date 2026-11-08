"""Verifications router — community confirmation/contradiction/resolution of incidents."""
from datetime import datetime
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..schemas import VerificationCreate, VerificationOut
from ..auth import get_current_user_optional

router = APIRouter(tags=["verifications"])


def _calculate_confidence(verif_list) -> int:
    """Calculate confidence based on community confirmations and contradictions."""
    confirmations = sum(1 for v in verif_list if v.get("verdict") == "confirm")
    contradictions = sum(1 for v in verif_list if v.get("verdict") == "contradict")
    resolutions = sum(1 for v in verif_list if v.get("verdict") == "resolve")
    score = 50 + (confirmations * 5) - (contradictions * 8) - (resolutions * 20)
    return max(5, min(99, score))


@router.post("/incidents/{incident_id}/verify", response_model=VerificationOut, status_code=201)
@router.post("/incidents/{incident_id}/verify/", response_model=VerificationOut, status_code=201)
async def verify_incident(
    incident_id: str,
    payload: VerificationCreate,
    db = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Submit a community verification (confirm, contradict, or resolve) for an incident."""
    if payload.verdict not in ("confirm", "contradict", "resolve"):
        raise HTTPException(status_code=422, detail="verdict must be 'confirm', 'contradict', or 'resolve'")

    inc = await db.incidents.find_one({"id": incident_id})
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    user_id = str(current_user.get("_id", current_user.get("id", ""))) if current_user else payload.user_id
    user_name = current_user.get("name") if current_user else None

    # Check if user already submitted a verification for this incident
    existing_verif = None
    if user_id:
        existing_verif = await db.verifications.find_one({"incident_id": incident_id, "user_id": str(user_id)})

    if existing_verif:
        doc_id = existing_verif["_id"]
        await db.verifications.update_one(
            {"_id": doc_id},
            {"$set": {"verdict": payload.verdict, "updated_at": datetime.utcnow()}}
        )
    else:
        doc_id = uuid.uuid4().hex
        v_doc = {
            "_id": doc_id,
            "incident_id": incident_id,
            "user_id": str(user_id) if user_id else None,
            "user_name": user_name,
            "verdict": payload.verdict,
            "created_at": datetime.utcnow(),
        }
        await db.verifications.insert_one(v_doc)

    # Re-calculate confidence and verification stats
    verif_cursor = db.verifications.find({"incident_id": incident_id})
    all_verifs = await verif_cursor.to_list(length=500)
    new_conf = _calculate_confidence(all_verifs)
    confirmations = sum(1 for v in all_verifs if v.get("verdict") == "confirm")
    contradictions = sum(1 for v in all_verifs if v.get("verdict") == "contradict")

    incident_updates = {"confidence": new_conf}
    if payload.verdict == "resolve":
        incident_updates["status"] = "Resolved"

    await db.incidents.update_one(
        {"id": incident_id},
        {"$set": incident_updates}
    )

    return VerificationOut(
        id=str(doc_id),
        incident_id=incident_id,
        verdict=payload.verdict,
        new_confidence=new_conf,
        confirmations=confirmations,
        contradictions=contradictions,
    )
