"""Users router — current user profile endpoint (JWT-protected)."""
from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..auth import get_current_user
from ..schemas import UserOut

router = APIRouter(prefix="/users", tags=["users"])

SCORE_FACTORS = [
    "Accurate Reports",
    "Helpful Verifications",
    "Timely Responses",
    "Community Feedback",
]


@router.get("/me", response_model=UserOut)
@router.get("/me/", response_model=UserOut)
async def get_me(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
):
    """Return the currently logged-in user's profile."""
    user = current_user
    user_name = user.get("name")
    user_id = str(user.get("_id", ""))

    # Build recent activity from actual incident reports
    incidents_cursor = db.incidents.find({
        "$or": [
            {"user_id": user_id},
            {"reporter": user_name},
        ]
    }).sort("reported_at_full", -1).limit(10)
    incidents = await incidents_cursor.to_list(length=10)

    activity = []
    for inc in incidents:
        verif_count = await db.verifications.count_documents({
            "incident_id": inc["id"],
            "verdict": "confirm",
        })
        status_label = "Verified" if verif_count >= 2 else "Pending"
        tone = "verified" if status_label == "Verified" else "pending"
        activity.append({
            "text": f"Reported: {inc.get('category')} at {inc.get('location')}",
            "time": "recently",
            "status": status_label,
            "tone": tone,
        })

    return UserOut(
        id=user_id,
        name=user.get("name", ""),
        fullName=user.get("full_name", user.get("name", "")),
        email=user.get("email", ""),
        memberSince=user.get("member_since", ""),
        reliabilityScore=user.get("reliability_score", 3.0),
        reliabilityLabel=user.get("reliability_label", "New Member"),
        scoreFactors=SCORE_FACTORS,
        recentActivity=activity,
    )
