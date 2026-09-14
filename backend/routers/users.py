"""Users router — current user profile endpoint."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Incident, Verification
from ..schemas import UserOut

router = APIRouter(prefix="/users", tags=["users"])

SCORE_FACTORS = [
    "Accurate Reports",
    "Helpful Verifications",
    "Timely Responses",
    "Community Feedback",
]


@router.get("/me", response_model=UserOut)
def get_current_user(db: Session = Depends(get_db)):
    """Return the currently logged-in user (mock auth — always user id=1)."""
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Build recent activity from DB
    incidents = db.query(Incident).filter(Incident.reporter == user.name).all()
    activity = []
    for inc in incidents[:5]:
        verif_count = db.query(Verification).filter(
            Verification.incident_id == inc.id,
            Verification.verdict == "confirm",
        ).count()
        status = "Verified" if verif_count >= 2 else "Pending"
        tone = "verified" if status == "Verified" else "pending"
        activity.append({
            "text": f"Reported: {inc.category} at {inc.location}",
            "time": "recently",
            "status": status,
            "tone": tone,
        })

    return UserOut(
        id=user.id,
        name=user.name,
        fullName=user.full_name,
        email=user.email,
        memberSince=user.member_since,
        reliabilityScore=user.reliability_score,
        reliabilityLabel=user.reliability_label,
        scoreFactors=SCORE_FACTORS,
        recentActivity=activity,
    )
