"""Users router — current user profile endpoint."""
from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..schemas import UserOut

router = APIRouter(prefix="/users", tags=["users"])

SCORE_FACTORS = [
    "Accurate Reports",
    "Helpful Verifications",
    "Timely Responses",
    "Community Feedback",
]


@router.get("/me", response_model=UserOut)
async def get_current_user(db = Depends(get_db)):
    """Return the currently logged-in user (mock auth — always user id=1)."""
    user = await db.users.find_one({"id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Build recent activity from DB
    incidents_cursor = db.incidents.find({"reporter": user.get("name")}).limit(5)
    incidents = await incidents_cursor.to_list(length=5)
    
    activity = []
    for inc in incidents:
        verif_count = await db.verifications.count_documents({
            "incident_id": inc["id"],
            "verdict": "confirm",
        })
        status = "Verified" if verif_count >= 2 else "Pending"
        tone = "verified" if status == "Verified" else "pending"
        activity.append({
            "text": f"Reported: {inc.get('category')} at {inc.get('location')}",
            "time": "recently",
            "status": status,
            "tone": tone,
        })

    return UserOut(
        id=user["id"],
        name=user["name"],
        fullName=user["full_name"],
        email=user["email"],
        memberSince=user["member_since"],
        reliabilityScore=user["reliability_score"],
        reliabilityLabel=user["reliability_label"],
        scoreFactors=SCORE_FACTORS,
        recentActivity=activity,
    )
