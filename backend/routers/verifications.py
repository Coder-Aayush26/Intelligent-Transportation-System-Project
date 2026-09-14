"""Verifications router — community confirmation/contradiction of incidents."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Incident, Verification
from ..schemas import VerificationCreate, VerificationOut

router = APIRouter(tags=["verifications"])


@router.post("/incidents/{incident_id}/verify", response_model=VerificationOut, status_code=201)
def verify_incident(
    incident_id: str,
    payload: VerificationCreate,
    db: Session = Depends(get_db),
):
    """Submit a community verification (confirm or contradict) for an incident."""
    if payload.verdict not in ("confirm", "contradict"):
        raise HTTPException(status_code=422, detail="verdict must be 'confirm' or 'contradict'")

    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    v = Verification(
        incident_id=incident_id,
        user_id=payload.user_id,
        verdict=payload.verdict,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v
