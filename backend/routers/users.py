"""Users router — current user profile, avatar, settings, and location endpoints (JWT-protected)."""
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status

from ..database import get_db
from ..auth import get_current_user
from ..schemas import UserOut, UserProfileUpdate, UserSettingsUpdate, UserLocationUpdate, _relative_time

router = APIRouter(prefix="/users", tags=["users"])

DEFAULT_SETTINGS: Dict[str, Any] = {
    "notificationRadius": 2.0,
    "nearbyVerificationRequests": True,
    "nearbyNewIncidents": True,
    "highSeverityAlerts": True,
    "categories": {
        "Accident": True,
        "Congestion": True,
        "Road Blockage": True,
        "Waterlogging": True,
        "Construction": True,
        "Hazard": True,
    },
    "locationSharingEnabled": False,
    "browserNotificationsEnabled": False,
}


async def _build_user_out(user: dict, db) -> UserOut:
    user_id_str = str(user.get("_id", ""))
    user_name = user.get("name", "")

    # Count actual reports submitted
    report_filter = {"$or": [{"reporter": user_name}, {"reporter_id": user_id_str}]}
    total_reports = await db.incidents.count_documents(report_filter)

    # Count actual verifications submitted
    verif_filter = {"$or": [{"user_id": user_id_str}, {"user_name": user_name}]}
    total_verifications = await db.verifications.count_documents(verif_filter)

    # Build real recent activity list from reports & verifications
    incidents_cursor = db.incidents.find(report_filter).sort("reported_at_full", -1).limit(5)
    recent_reports = await incidents_cursor.to_list(length=5)

    verifs_cursor = db.verifications.find(verif_filter).sort("created_at", -1).limit(5)
    recent_verifs = await verifs_cursor.to_list(length=5)

    activity: List[dict] = []
    for inc in recent_reports:
        verif_count = await db.verifications.count_documents({
            "incident_id": inc["id"],
            "verdict": "confirm",
        })
        status_label = "Verified" if verif_count >= 2 else "Pending"
        tone = "verified" if status_label == "Verified" else "pending"
        activity.append({
            "text": f"Reported: {inc.get('category')} at {inc.get('location') or 'Location'}",
            "time": _relative_time(inc.get("reported_at_full")),
            "status": status_label,
            "tone": tone,
            "type": "report",
            "sort_time": inc.get("reported_at_full") or datetime.min,
        })

    for v in recent_verifs:
        verdict_str = "Confirmed" if v.get("verdict") == "confirm" else "Contradicted"
        inc_doc = await db.incidents.find_one({"id": v.get("incident_id")})
        cat = inc_doc.get("category") if inc_doc else "Incident"
        loc = inc_doc.get("location") if inc_doc else "Road"
        activity.append({
            "text": f"{verdict_str}: {cat} at {loc}",
            "time": _relative_time(v.get("created_at")),
            "status": verdict_str,
            "tone": "verified" if v.get("verdict") == "confirm" else "warn",
            "type": "verification",
            "sort_time": v.get("created_at") or datetime.min,
        })

    # Sort combined activity descending
    activity.sort(key=lambda x: x.get("sort_time", datetime.min), reverse=True)
    # Strip sort_time key before returning
    for a in activity:
        a.pop("sort_time", None)
    activity = activity[:6]

    # Data-driven reliability and factors
    total_actions = total_reports + total_verifications
    if total_actions == 0:
        reliability_score = user.get("reliability_score", 3.0)
        reliability_label = "New Member (No activity yet)"
        score_factors = [
            "Baseline score assigned upon account creation",
            "Submit accurate reports to build community trust",
            "Verify nearby incidents to earn reliability points",
        ]
    else:
        reliability_score = user.get("reliability_score", 3.0)
        reliability_label = user.get("reliability_label", "Active Contributor")
        score_factors = [
            f"Accurate Reports ({total_reports} submitted)",
            f"Community Verifications ({total_verifications} contributed)",
            "Temporal consistency & proximity checks active",
        ]

    # Merge user settings with default settings
    stored_settings = user.get("settings") or {}
    merged_settings = {**DEFAULT_SETTINGS, **stored_settings}
    if "categories" in stored_settings:
        merged_settings["categories"] = {**DEFAULT_SETTINGS["categories"], **stored_settings["categories"]}

    return UserOut(
        id=user_id_str,
        name=user_name,
        fullName=user.get("full_name") or user_name,
        email=user.get("email", ""),
        avatarUrl=user.get("avatar_url") or user.get("avatarUrl") or None,
        memberSince=user.get("member_since", ""),
        reliabilityScore=reliability_score,
        reliabilityLabel=reliability_label,
        totalReports=total_reports,
        totalVerifications=total_verifications,
        scoreFactors=score_factors,
        recentActivity=activity,
        settings=merged_settings,
    )


@router.get("/me", response_model=UserOut)
@router.get("/me/", response_model=UserOut)
async def get_me(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
):
    """Return the currently logged-in user's profile and settings."""
    return await _build_user_out(current_user, db)


@router.patch("/me", response_model=UserOut)
async def update_profile(
    body: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
):
    """Update profile details (name, avatar) for the authenticated user only."""
    updates: Dict[str, Any] = {}
    if body.name is not None:
        trimmed_name = body.name.strip()
        if not trimmed_name:
            raise HTTPException(status_code=400, detail="Display name cannot be empty.")
        if len(trimmed_name) > 60:
            raise HTTPException(status_code=400, detail="Name cannot exceed 60 characters.")
        updates["name"] = trimmed_name
        updates["full_name"] = trimmed_name

    if body.full_name is not None:
        trimmed_fn = body.full_name.strip()
        if trimmed_fn:
            updates["full_name"] = trimmed_fn
            if "name" not in updates:
                updates["name"] = trimmed_fn

    if body.avatar_url is not None:
        # If empty string, treat as removal
        cleaned_url = body.avatar_url.strip() if body.avatar_url else None
        updates["avatar_url"] = cleaned_url

    if updates:
        await db.users.update_one({"_id": current_user["_id"]}, {"$set": updates})
        refreshed = await db.users.find_one({"_id": current_user["_id"]})
        if refreshed:
            current_user = refreshed

    return await _build_user_out(current_user, db)


@router.get("/me/settings")
async def get_settings(
    current_user: dict = Depends(get_current_user),
):
    """Retrieve persisted notification, proximity, and location settings."""
    stored_settings = current_user.get("settings") or {}
    merged = {**DEFAULT_SETTINGS, **stored_settings}
    if "categories" in stored_settings:
        merged["categories"] = {**DEFAULT_SETTINGS["categories"], **stored_settings["categories"]}
    return merged


@router.put("/me/settings")
async def update_settings(
    body: UserSettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
):
    """Update user settings/preferences in MongoDB."""
    stored_settings = current_user.get("settings") or {}
    updated = {**DEFAULT_SETTINGS, **stored_settings}

    if body.notificationRadius is not None:
        if body.notificationRadius not in (0.5, 1.0, 2.0, 5.0, 10.0):
            # Enforce reasonable positive bounds
            if body.notificationRadius <= 0 or body.notificationRadius > 50:
                raise HTTPException(status_code=400, detail="Invalid notification radius.")
        updated["notificationRadius"] = float(body.notificationRadius)

    if body.nearbyVerificationRequests is not None:
        updated["nearbyVerificationRequests"] = bool(body.nearbyVerificationRequests)

    if body.nearbyNewIncidents is not None:
        updated["nearbyNewIncidents"] = bool(body.nearbyNewIncidents)

    if body.highSeverityAlerts is not None:
        updated["highSeverityAlerts"] = bool(body.highSeverityAlerts)

    if body.categories is not None:
        current_cats = updated.get("categories", {})
        updated["categories"] = {**current_cats, **body.categories}

    if body.locationSharingEnabled is not None:
        updated["locationSharingEnabled"] = bool(body.locationSharingEnabled)

    if body.browserNotificationsEnabled is not None:
        updated["browserNotificationsEnabled"] = bool(body.browserNotificationsEnabled)

    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"settings": updated}}
    )
    return {"status": "ok", "settings": updated}


@router.post("/me/location")
async def update_location(
    body: UserLocationUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
):
    """Record current user's live coordinates for nearby verification requests."""
    # Validate lat / lng ranges
    if not (-90.0 <= body.lat <= 90.0) or not (-180.0 <= body.lng <= 180.0):
        raise HTTPException(status_code=400, detail="Invalid latitude or longitude.")

    loc_record = {
        "lat": body.lat,
        "lng": body.lng,
        "updated_at": datetime.utcnow(),
    }
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"last_known_location": loc_record}}
    )
    return {"status": "ok", "location": loc_record}
