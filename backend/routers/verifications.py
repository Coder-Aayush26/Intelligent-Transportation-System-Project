"""Verifications router — community confirmation/contradiction/resolution of incidents."""
from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..schemas import VerificationCreate, VerificationOut
from ..auth import get_current_user_optional, is_authority_user
from ..realtime import realtime_manager
from ..services.confidence import compute_total_confidence
from .incidents import haversine_distance_meters

router = APIRouter(tags=["verifications"])


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

    # ── Gate 1: Stage-1 AI Verification Threshold (Minimum 70% Authenticity) ──
    ai_score = inc.get("ai_authenticity_score")
    if ai_score is None and inc.get("media_score") is not None:
        ai_score = int(inc["media_score"] * 100)

    # If media was attached and scored below 70%, voting is locked
    if inc.get("media_urls") and ai_score is not None and ai_score < 70:
        raise HTTPException(
            status_code=403,
            detail=f"Community voting is locked: This incident has not passed Stage-1 AI verification (Authenticity Score: {ai_score}% < 70% required threshold).",
        )

    # ── Gate 2: Geographic Proximity Restriction (1000 meters / 1.0 km) ──
    voter_lat = payload.user_lat
    voter_lng = payload.user_lng
    if (voter_lat is None or voter_lng is None) and current_user:
        last_loc = current_user.get("last_known_location") or {}
        voter_lat = last_loc.get("lat")
        voter_lng = last_loc.get("lng")

    inc_lat = inc.get("lat")
    inc_lng = inc.get("lng")

    if voter_lat is not None and voter_lng is not None and inc_lat is not None and inc_lng is not None:
        try:
            dist_meters = haversine_distance_meters(float(voter_lat), float(voter_lng), float(inc_lat), float(inc_lng))
            if dist_meters > 1000.0:
                raise HTTPException(
                    status_code=403,
                    detail=f"Proximity restriction: You are {dist_meters:.0f} meters away ({(dist_meters / 1000.0):.2f} km). Community verification is strictly limited to road users within 1,000 meters (1.0 km) of the incident.",
                )
        except (ValueError, TypeError):
            pass

    user_id = str(current_user.get("_id", current_user.get("id", ""))) if current_user else (str(payload.user_id) if payload.user_id else None)
    user_name = current_user.get("name") if current_user else None

    # Determine voter reliability and authority status
    user_doc = None
    voter_reliability = 3.0
    if current_user and current_user.get("reliability_score") is not None:
        voter_reliability = float(current_user["reliability_score"])
    elif payload.user_id:
        user_doc = await db.users.find_one({"$or": [{"id": payload.user_id}, {"_id": payload.user_id}]})
        if user_doc and user_doc.get("reliability_score") is not None:
            voter_reliability = float(user_doc["reliability_score"])

    is_authority = False
    if current_user:
        is_authority = is_authority_user(current_user)
    elif user_doc:
        is_authority = is_authority_user(user_doc)

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Check if user already submitted a verification for this incident
    existing_verif = None
    if user_id:
        existing_verif = await db.verifications.find_one({"incident_id": incident_id, "user_id": str(user_id)})

    if existing_verif:
        doc_id = existing_verif["_id"]
        await db.verifications.update_one(
            {"_id": doc_id},
            {"$set": {
                "verdict": payload.verdict,
                "voter_reliability": voter_reliability,
                "updated_at": now,
            }}
        )
    else:
        doc_id = uuid.uuid4().hex
        v_doc = {
            "_id": doc_id,
            "incident_id": incident_id,
            "user_id": user_id,
            "user_name": user_name,
            "verdict": payload.verdict,
            "voter_reliability": voter_reliability,
            "created_at": now,
        }
        await db.verifications.insert_one(v_doc)

    # Re-calculate confidence with full 6-factor model incorporating voter reliability
    verif_cursor = db.verifications.find({"incident_id": incident_id})
    all_verifs = await verif_cursor.to_list(length=500)
    confirmations = sum(1 for v in all_verifs if v.get("verdict") == "confirm")
    contradictions = sum(1 for v in all_verifs if v.get("verdict") == "contradict")

    new_conf = compute_total_confidence(
        description=inc.get("description", ""),
        media_urls=inc.get("media_urls", []),
        media_score=inc.get("media_score"),
        verif_list=all_verifs,
        report_count=inc.get("report_count", 1),
        reporter_reliability=float(inc.get("reporter_reliability", 3.0)),
        category=inc.get("category", "Other"),
        reported_at=inc.get("reported_at_full"),
        current_time=now,
    )

    # Count community votes from all_verifs
    confirmations = sum(1 for v in all_verifs if v.get("verdict") == "confirm")
    contradictions = sum(1 for v in all_verifs if v.get("verdict") == "contradict")
    resolve_votes = sum(1 for v in all_verifs if v.get("verdict") == "resolve")

    # Consensus resolution criteria:
    # - Official traffic authority or admin resolves immediately
    # - Citizens require consensus: at least 3 resolve votes and resolve votes > confirmations
    community_consensus_resolve = (resolve_votes >= 3 and resolve_votes > confirmations)

    incident_updates = {
        "confidence": new_conf,
        "last_activity_at": now,
    }

    resolver_name = None
    if current_user:
        resolver_name = current_user.get("name") or current_user.get("full_name")

    if payload.verdict == "resolve":
        if is_authority:
            incident_updates["status"] = "Resolved"
            incident_updates["is_active"] = 0
            incident_updates["resolved_by"] = resolver_name or "Traffic Authority Officer"
            incident_updates["resolved_at"] = now
        elif community_consensus_resolve:
            incident_updates["status"] = "Resolved"
            incident_updates["is_active"] = 0
            incident_updates["resolved_by"] = f"Community Consensus ({resolve_votes} Road Users)"
            incident_updates["resolved_at"] = now
        # Note: If single citizen votes "resolve" without quorum or authority,
        # the vote is recorded in db.verifications, but incident status remains active.
    elif payload.verdict == "confirm":
        # If community previously marked it resolved, but new confirmations arrive that overturn the consensus
        prev_resolver = str(inc.get("resolved_by") or "")
        is_official_resolution = any(k in prev_resolver.lower() for k in ("traffic authority", "police", "official", "admin"))
        if inc.get("status") == "Resolved" and not is_official_resolution and not is_authority:
            if confirmations >= resolve_votes:
                incident_updates["status"] = "Active"
                incident_updates["is_active"] = 1
                incident_updates["resolved_by"] = None
                incident_updates["resolved_at"] = None

    await db.incidents.update_one(
        {"id": incident_id},
        {"$set": incident_updates}
    )

    final_status = incident_updates.get("status", inc.get("status", "Active"))
    final_is_active = incident_updates.get("is_active", inc.get("is_active", 1)) in (1, True)

    try:
        await realtime_manager.broadcast("incident_verified", {
            "incident_id": incident_id,
            "confidence": new_conf,
            "verifications": len(all_verifs),
            "nearbyVerifications": confirmations,
            "contradictions": contradictions,
            "resolveVotes": resolve_votes,
            "status": final_status,
            "isActive": final_is_active,
        })
        if final_status == "Resolved" and inc.get("status") != "Resolved":
            await realtime_manager.broadcast("incident_resolved", {
                "id": incident_id,
                "status": "Resolved",
                "isActive": False,
                "resolvedBy": incident_updates.get("resolved_by", "Community Consensus"),
                "resolvedAt": now.isoformat(),
            })
    except Exception:
        pass

    return VerificationOut(
        id=str(doc_id),
        incident_id=incident_id,
        verdict=payload.verdict,
        new_confidence=new_conf,
        confirmations=confirmations,
        contradictions=contradictions,
        resolutions=resolve_votes,
        status=final_status,
        is_active=final_is_active,
        isActive=final_is_active,
    )
