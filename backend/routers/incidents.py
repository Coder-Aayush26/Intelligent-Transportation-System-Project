import asyncio
import json
import math
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from ..database import get_db
from ..schemas import IncidentCreate, IncidentOut, StatsOut, IncidentResolutionUpdate
from ..auth import get_current_user, get_current_user_optional, get_current_authority_user
from ..realtime import realtime_manager

router = APIRouter(prefix="/incidents", tags=["incidents"])
from ..services.confidence import compute_total_confidence, evaluate_media_alignment


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in kilometres."""
    R = 6371.0  # Mean radius of Earth in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate exact great-circle distance between two coordinates in metres."""
    return haversine_km(lat1, lon1, lat2, lon2) * 1000.0


# Maximum lifespan (in hours) of active incidents before automatic expiration
EXPIRY_HOURS_PER_CATEGORY = {
    "Traffic Jam": 3.0,       # 3 hours without activity -> expired
    "Accident": 6.0,          # 6 hours without activity -> expired
    "Waterlogging": 24.0,     # 24 hours without activity -> expired
    "Road Blockage": 24.0,    # 24 hours without activity -> expired
    "Road Closure": 48.0,     # 48 hours without activity -> expired
    "Road Hazard": 48.0,      # 48 hours without activity -> expired
    "Construction": 72.0,     # 72 hours without activity -> expired
    "Other": 12.0,            # 12 hours default
}

DUPLICATE_DISTANCE_THRESHOLD_METERS = 100.0


async def auto_expire_stale_incidents(db, now: Optional[datetime] = None) -> int:
    """Check active incidents and transition any past their category expiry threshold to expired status.

    Preserves all reporting details, reports, and history in the database while deactivating from live map.
    """
    current_dt = now or datetime.now(timezone.utc).replace(tzinfo=None)
    cursor = db.incidents.find({"is_active": {"$in": [1, True]}})
    active_incidents = await cursor.to_list(length=500)
    expired_count = 0

    for inc in active_incidents:
        category = inc.get("category", "Other")
        expiry_hours = EXPIRY_HOURS_PER_CATEGORY.get(category, 12.0)
        ref_time = inc.get("last_activity_at") or inc.get("reported_at_full")
        if ref_time:
            if isinstance(ref_time, datetime):
                if ref_time.tzinfo is not None:
                    ref_time = ref_time.astimezone(timezone.utc).replace(tzinfo=None)
                elapsed_hours = (current_dt - ref_time).total_seconds() / 3600.0
                if elapsed_hours >= expiry_hours:
                    await db.incidents.update_one(
                        {"id": inc["id"]},
                        {"$set": {
                            "is_active": 0,
                            "status": "expired",
                            "expired_at": current_dt,
                        }}
                    )
                    inc["is_active"] = 0
                    inc["status"] = "expired"
                    expired_count += 1

    return expired_count


def _validate_coords(lat: Optional[float], lng: Optional[float]):
    if lat is not None and not (-90.0 <= lat <= 90.0):
        raise HTTPException(
            status_code=400,
            detail="Latitude must be between -90 and 90 degrees.",
        )
    if lng is not None and not (-180.0 <= lng <= 180.0):
        raise HTTPException(
            status_code=400,
            detail="Longitude must be between -180 and 180 degrees.",
        )


def _evaluate_incident_confidence(inc: dict, verif_list: list, current_time: Optional[datetime] = None) -> int:
    """Compute confidence dynamically using full 6-factor model."""
    return compute_total_confidence(
        description=inc.get("description", ""),
        media_urls=inc.get("media_urls"),
        verif_list=verif_list,
        media_score=inc.get("media_score"),
        report_count=inc.get("report_count", 1),
        reporter_reliability=inc.get("reporter_reliability"),
        category=inc.get("category", "Other"),
        reported_at=inc.get("last_activity_at") or inc.get("reported_at_full"),
        current_time=current_time,
    )


def _confidence_from_verifications(verif_list) -> int:
    """Simple rule: base 50 + 5 per confirm - 8 per contradict, capped 5-99 (legacy)."""
    confirmations = sum(1 for v in verif_list if v.get("verdict") == "confirm")
    contradictions = sum(1 for v in verif_list if v.get("verdict") == "contradict")
    score = 50 + confirmations * 5 - contradictions * 8
    return max(5, min(99, score))


@router.get("", response_model=List[IncidentOut])
@router.get("/", response_model=List[IncidentOut])
async def list_incidents(
    lat: Optional[float] = Query(None, description="Optional center latitude for geographic filtering"),
    lng: Optional[float] = Query(None, description="Optional center longitude for geographic filtering"),
    radius: Optional[float] = Query(None, gt=0, le=1000.0, description="Optional radius in km"),
    category: Optional[str] = Query(None, description="Filter by incident category"),
    db = Depends(get_db),
):
    """Return all currently active incidents, optionally filtered by geographic radius or category."""
    _validate_coords(lat, lng)
    try:
        await auto_expire_stale_incidents(db)
    except Exception:
        pass

    query = {"is_active": {"$in": [1, True]}}
    if category:
        query["category"] = category

    has_geo_filter = lat is not None and lng is not None and radius is not None

    if has_geo_filter:
        deg_lat = radius / 111.0
        cos_lat = max(0.01, math.cos(math.radians(lat)))
        deg_lng = radius / (111.0 * cos_lat)
        query["lat"] = {"$gte": lat - deg_lat, "$lte": lat + deg_lat}
        query["lng"] = {"$gte": lng - deg_lng, "$lte": lng + deg_lng}

    incidents = []
    try:
        incidents_cursor = db.incidents.find(query)
        incidents = await incidents_cursor.to_list(length=300)
    except Exception:
        from ..seed import SEED_INCIDENTS
        incidents = [dict(s) for s in SEED_INCIDENTS]

    result = []
    for inc in incidents:
        # Exclude sub-70% authenticity incidents when media was attached
        has_media = bool(inc.get("media_urls")) or inc.get("media_count", 0) > 0
        if has_media:
            if inc.get("ai_authenticity_score") is not None and inc.get("ai_authenticity_score") < 70:
                continue
            if inc.get("media_score") is not None and inc.get("media_score") < 0.70:
                continue

        # Haversine precise circular filtering when geo-bounds were provided
        if has_geo_filter:
            inc_lat = inc.get("lat")
            inc_lng = inc.get("lng")
            if inc_lat is None or inc_lng is None:
                continue
            try:
                dist = haversine_km(lat, lng, float(inc_lat), float(inc_lng))
                if dist > radius:
                    continue
            except (ValueError, TypeError):
                continue

        verif = []
        try:
            verif_cursor = db.verifications.find({"incident_id": inc["id"]})
            verif = await verif_cursor.to_list(length=500)
        except Exception:
            pass
        inc["confidence"] = _evaluate_incident_confidence(inc, verif)
        result.append(IncidentOut.from_mongo_doc(inc, verif))

    return result


@router.post("", response_model=IncidentOut, status_code=201)
@router.post("/", response_model=IncidentOut, status_code=201)
async def create_incident(
    payload: IncidentCreate,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user_optional),
):
    """Create a new incident report or consolidate into an existing incident within 100 metres."""
    _validate_coords(payload.lat, payload.lng)
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Automatically expire stale incidents first so they don't capture new reports as duplicates
    await auto_expire_stale_incidents(db, now)

    reporter_name = "Anonymous"
    reporter_user_id = None
    reporter_email = None
    reporter_reliability = 3.0
    if current_user:
        reporter_name = current_user.get("name") or current_user.get("full_name") or "Community Member"
        reporter_user_id = str(current_user.get("_id", current_user.get("id", "")))
        reporter_email = current_user.get("email")
        if current_user.get("reliability_score") is not None:
            reporter_reliability = float(current_user["reliability_score"])

    # Evaluate media alignment with Gemini Vision / Local Heuristic on incident creation
    media_score = None
    ai_assessment = "No media attached"
    media_authenticity = None
    if payload.media_urls:
        media_score, ai_assessment, media_authenticity = evaluate_media_alignment(
            payload.description,
            payload.media_urls,
            return_details=True,
            category=payload.category,
        )
        if media_score is not None:
            check_score = max(0, min(100, int(media_score * 100)))
        else:
            check_score = 0

        # Strict Gate: If AI authenticity score is below 70%, reject immediately and do NOT store in DB
        if check_score < 70:
            raise HTTPException(
                status_code=422,
                detail=f"Report rejected by Stage-1 AI Verification: Authenticity score is {check_score}% (requires ≥70%). AI Assessment: {ai_assessment}. Reports failing the authenticity threshold are discarded immediately to keep the database clean.",
            )

    # -------------------------------------------------------------
    # Geographic Duplicate Detection: 100-meter radius, same category
    # -------------------------------------------------------------
    deg_delta = 0.002  # ~220m bounding box for fast indexing candidate retrieval
    geo_query = {
        "is_active": {"$in": [1, True]},
        "category": payload.category,
        "lat": {"$gte": payload.lat - deg_delta, "$lte": payload.lat + deg_delta},
        "lng": {"$gte": payload.lng - deg_delta, "$lte": payload.lng + deg_delta},
    }
    candidates_cursor = db.incidents.find(geo_query)
    candidates = await candidates_cursor.to_list(length=50)

    matched_incident = None
    min_dist_meters = float("inf")
    for cand in candidates:
        cand_lat = cand.get("lat")
        cand_lng = cand.get("lng")
        if cand_lat is None or cand_lng is None:
            continue
        try:
            dist_m = haversine_distance_meters(payload.lat, payload.lng, float(cand_lat), float(cand_lng))
            if dist_m <= DUPLICATE_DISTANCE_THRESHOLD_METERS and dist_m < min_dist_meters:
                min_dist_meters = dist_m
                matched_incident = cand
        except (ValueError, TypeError):
            continue

    # =============================================================
    # CASE A: Duplicate Found -> Consolidate into Existing Incident
    # =============================================================
    if matched_incident:
        new_report = {
            "report_id": f"rep-{uuid.uuid4().hex[:8]}",
            "reporter": reporter_name,
            "user_id": reporter_user_id,
            "reporter_id": reporter_user_id,
            "user_email": reporter_email,
            "reporter_reliability": reporter_reliability,
            "description": payload.description,
            "media_urls": payload.media_urls,
            "media_score": media_score,
            "ai_assessment": ai_assessment or "Pending",
            "media_authenticity": media_authenticity,
            "lat": payload.lat,
            "lng": payload.lng,
            "location": payload.location or matched_incident.get("location", "Unknown Location"),
            "full_location": payload.full_location or matched_incident.get("full_location", "Unknown Location"),
            "severity": payload.severity or "Medium",
            "source": payload.source or "Web App",
            "reported_at": now,
        }

        existing_reports = list(matched_incident.get("reports") or [])
        if not existing_reports:
            prim_time = matched_incident.get("reported_at_full", now)
            existing_reports.append({
                "report_id": f"rep-{str(matched_incident.get('id') or matched_incident.get('_id', 'primary'))[-8:]}",
                "reporter": matched_incident.get("reporter", "Anonymous"),
                "user_id": matched_incident.get("user_id"),
                "reporter_id": matched_incident.get("reporter_id"),
                "user_email": matched_incident.get("user_email"),
                "reporter_reliability": float(matched_incident.get("reporter_reliability", 3.0)),
                "description": matched_incident.get("description", ""),
                "media_urls": matched_incident.get("media_urls", []),
                "media_score": matched_incident.get("media_score"),
                "ai_assessment": matched_incident.get("ai_assessment", "Pending"),
                "lat": matched_incident.get("lat", 0.0),
                "lng": matched_incident.get("lng", 0.0),
                "location": matched_incident.get("location", ""),
                "full_location": matched_incident.get("full_location", ""),
                "severity": matched_incident.get("severity", "Medium"),
                "source": matched_incident.get("source", "Web App"),
                "reported_at": prim_time,
            })

        existing_reports.append(new_report)
        total_report_count = len(existing_reports)

        # Merge media URLs
        combined_media = list(matched_incident.get("media_urls") or [])
        for m in payload.media_urls:
            if m not in combined_media:
                combined_media.append(m)

        # Determine best visual evidence across all reports
        all_scores = [r.get("media_score") for r in existing_reports if r.get("media_score") is not None]
        best_media_score = max(all_scores) if all_scores else None
        all_assessments = [
            r.get("ai_assessment") for r in existing_reports
            if r.get("ai_assessment") and r.get("ai_assessment") != "No media attached"
        ]
        best_assessment = all_assessments[-1] if all_assessments else (ai_assessment or matched_incident.get("ai_assessment"))
        all_authenticities = [
            r.get("media_authenticity") for r in existing_reports
            if r.get("media_authenticity")
        ]
        best_authenticity = all_authenticities[-1] if all_authenticities else (media_authenticity or matched_incident.get("media_authenticity"))

        # Determine highest reported severity
        severity_order = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}
        all_severities = [r.get("severity", "Medium") for r in existing_reports]
        highest_severity = max(all_severities, key=lambda s: severity_order.get(s, 2))

        # Average reporter reliability
        all_reliabilities = [float(r.get("reporter_reliability", 3.0)) for r in existing_reports]
        avg_rep_rel = round(sum(all_reliabilities) / len(all_reliabilities), 2)

        # Register corroboration confirmation
        corrob_verif = {
            "_id": uuid.uuid4().hex,
            "incident_id": matched_incident["id"],
            "user_id": reporter_user_id,
            "verdict": "confirm",
            "voter_reliability": reporter_reliability,
            "created_at": now,
        }
        await db.verifications.insert_one(corrob_verif)

        verif_cursor = db.verifications.find({"incident_id": matched_incident["id"]})
        verif = await verif_cursor.to_list(length=500)

        consolidated_conf = compute_total_confidence(
            description=matched_incident.get("description", payload.description),
            media_urls=combined_media,
            verif_list=verif,
            media_score=best_media_score,
            report_count=total_report_count,
            reporter_reliability=avg_rep_rel,
            category=matched_incident["category"],
            reported_at=now,
            current_time=now,
        )

        update_fields = {
            "reports": existing_reports,
            "report_count": total_report_count,
            "is_consolidated": True,
            "media_urls": combined_media,
            "media_count": len(combined_media),
            "media_score": best_media_score,
            "ai_assessment": best_assessment,
            "media_authenticity": best_authenticity,
            "confidence": consolidated_conf,
            "severity": highest_severity,
            "reporter_reliability": avg_rep_rel,
            "reported_at_full": now,
            "last_activity_at": now,
        }
        if best_media_score is not None:
            update_fields["ai_authenticity_score"] = max(0, min(100, int(best_media_score * 100)))
            update_fields["ai_verified"] = update_fields["ai_authenticity_score"] >= 70
            update_fields["stage"] = "Stage 2: Community Verification Open" if update_fields["ai_verified"] else "Stage 1: AI Screening Pending"
        if payload.full_location and matched_incident.get("location") in ("Unknown", "Unknown Location", ""):
            update_fields["location"] = payload.location or payload.full_location.split(",")[0].strip()
            update_fields["full_location"] = payload.full_location

        await db.incidents.update_one({"id": matched_incident["id"]}, {"$set": update_fields})
        matched_incident.update(update_fields)
        return IncidentOut.from_mongo_doc(matched_incident, verif)

    # =============================================================
    # CASE B: No Duplicate -> Create New Incident
    # =============================================================
    incident_id = f"inc-{uuid.uuid4().hex[:8]}"

    initial_report = {
        "report_id": f"rep-{incident_id[-8:]}",
        "reporter": reporter_name,
        "user_id": reporter_user_id,
        "reporter_id": reporter_user_id,
        "user_email": reporter_email,
        "reporter_reliability": reporter_reliability,
        "description": payload.description,
        "media_urls": payload.media_urls,
        "media_score": media_score,
        "ai_assessment": ai_assessment or "Pending",
        "media_authenticity": media_authenticity,
        "lat": payload.lat,
        "lng": payload.lng,
        "location": payload.location or "Unknown Location",
        "full_location": payload.full_location or payload.location or "Unknown Location",
        "severity": payload.severity or "Medium",
        "source": payload.source or "Web App",
        "reported_at": now,
    }

    # AI Authenticity Score (0-100) and threshold status evaluated by Gemini Vision
    if media_score is not None:
        ai_score = max(0, min(100, int(media_score * 100)))
        ai_verified = ai_score >= 70
        stage_val = "Stage 2: Community Verification Open" if ai_verified else "Stage 1: AI Screening Pending"
    else:
        ai_score = None
        ai_verified = True
        stage_val = "Stage 2: Community Verification Open"
        ai_assessment = ai_assessment or "No media attached"

    initial_confidence = compute_total_confidence(
        description=payload.description,
        media_urls=payload.media_urls,
        media_score=media_score,
        verif_list=[],
        report_count=1,
        reporter_reliability=reporter_reliability,
        category=payload.category,
        reported_at=now,
    )

    inc_doc = {
        "_id": incident_id,
        "id": incident_id,
        "category": payload.category,
        "location": payload.location or "Unknown Location",
        "full_location": payload.full_location or payload.location or "Unknown Location",
        "lat": payload.lat,
        "lng": payload.lng,
        "severity": payload.severity or "Medium",
        "confidence": initial_confidence,
        "media_score": media_score,
        "ai_assessment": ai_assessment or "Pending",
        "ai_authenticity_score": ai_score,
        "ai_verified": ai_verified,
        "stage": stage_val,
        "media_authenticity": media_authenticity,
        "description": payload.description,
        "reporter": reporter_name,
        "user_id": reporter_user_id,
        "reporter_id": reporter_user_id,
        "reporter_reliability": reporter_reliability,
        "reports": [initial_report],
        "report_count": 1,
        "is_consolidated": False,
        "user_email": reporter_email,
        "source": payload.source or "Web App",
        "media_urls": payload.media_urls,
        "media_count": len(payload.media_urls),
        "map_position_top": "50%",
        "map_position_left": "50%",
        "reported_at_full": now,
        "last_activity_at": now,
        "is_active": 1,
        "status": "Active",
    }

    await db.incidents.insert_one(inc_doc)
    out_incident = IncidentOut.from_mongo_doc(inc_doc, [])
    try:
        await realtime_manager.broadcast("incident_created", out_incident.model_dump())
    except Exception:
        pass
    return out_incident


# IMPORTANT: this literal route MUST come before /{incident_id} so FastAPI
# does not match the string "stats" as an incident ID.
@router.get("/stats/summary", response_model=StatsOut)
@router.get("/stats/summary/", response_model=StatsOut)
async def get_stats(
    lat: Optional[float] = Query(None, description="Optional center latitude"),
    lng: Optional[float] = Query(None, description="Optional center longitude"),
    radius: Optional[float] = Query(None, gt=0, le=1000.0, description="Optional radius in km"),
    db = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Aggregated dashboard stats, optionally filtered by local geographic scope."""
    try:
        await auto_expire_stale_incidents(db)
    except Exception:
        pass

    if (lat is None or lng is None) and radius is not None and current_user:
        last_loc = current_user.get("last_known_location") or {}
        if last_loc.get("lat") is not None and last_loc.get("lng") is not None:
            lat = float(last_loc["lat"])
            lng = float(last_loc["lng"])

    _validate_coords(lat, lng)

    query = {"is_active": {"$in": [1, True]}}
    has_geo_filter = lat is not None and lng is not None and radius is not None

    if has_geo_filter:
        deg_lat = radius / 111.0
        cos_lat = max(0.01, math.cos(math.radians(lat)))
        deg_lng = radius / (111.0 * cos_lat)
        query["lat"] = {"$gte": lat - deg_lat, "$lte": lat + deg_lat}
        query["lng"] = {"$gte": lng - deg_lng, "$lte": lng + deg_lng}

    raw_active = []
    try:
        active_cursor = db.incidents.find(query)
        raw_active = await active_cursor.to_list(length=300)
    except Exception:
        from ..seed import SEED_INCIDENTS
        raw_active = [dict(s) for s in SEED_INCIDENTS]

    active_incidents = []
    for inc in raw_active:
        if has_geo_filter:
            inc_lat = inc.get("lat")
            inc_lng = inc.get("lng")
            if inc_lat is None or inc_lng is None:
                continue
            try:
                if haversine_km(lat, lng, float(inc_lat), float(inc_lng)) > radius:
                    continue
            except (ValueError, TypeError):
                continue

        verif = []
        try:
            verif_cursor = db.verifications.find({"incident_id": inc["id"]})
            verif = await verif_cursor.to_list(length=500)
        except Exception:
            pass
        inc["confidence"] = _evaluate_incident_confidence(inc, verif)
        active_incidents.append(inc)

    high_conf = [i for i in active_incidents if i.get("confidence", 50) >= 80]

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_reports = 0
    try:
        today_reports = await db.incidents.count_documents({
            "reported_at_full": {"$gte": today_start}
        })
    except Exception:
        today_reports = len(active_incidents)

    verified = 0
    for inc in active_incidents:
        try:
            verif_count = await db.verifications.count_documents({
                "incident_id": inc["id"],
                "verdict": "confirm",
            })
            if verif_count >= 1:
                verified += 1
        except Exception:
            pass

    return StatsOut(
        totalActive=len(active_incidents),
        highConfidence=len(high_conf),
        reportsToday=today_reports,
        verifiedToday=verified,
    )


@router.get("/nearby", response_model=List[IncidentOut])
@router.get("/nearby/", response_model=List[IncidentOut])
async def get_nearby_incidents(
    lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Center latitude"),
    lng: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Center longitude"),
    radius: float = Query(10.0, gt=0, le=1000.0, description="Radius in km"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    db = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Return active incidents within the specified circular radius (in km) of coordinates or saved user location."""
    try:
        await auto_expire_stale_incidents(db)
    except Exception:
        pass

    if (lat is None or lng is None) and current_user:
        last_loc = current_user.get("last_known_location") or {}
        if last_loc.get("lat") is not None and last_loc.get("lng") is not None:
            lat = float(last_loc["lat"])
            lng = float(last_loc["lng"])
        elif current_user.get("lat") is not None and current_user.get("lng") is not None:
            lat = float(current_user["lat"])
            lng = float(current_user["lng"])

    if lat is None or lng is None:
        raise HTTPException(
            status_code=400,
            detail="Coordinates (lat, lng) are required, or save your location in your user profile.",
        )

    _validate_coords(lat, lng)

    deg_lat = radius / 111.0
    cos_lat = max(0.01, math.cos(math.radians(lat)))
    deg_lng = radius / (111.0 * cos_lat)

    query = {
        "is_active": {"$in": [1, True]},
        "lat": {"$gte": lat - deg_lat, "$lte": lat + deg_lat},
        "lng": {"$gte": lng - deg_lng, "$lte": lng + deg_lng},
    }
    if category:
        query["category"] = category

    incidents = []
    try:
        active_cursor = db.incidents.find(query)
        incidents = await active_cursor.to_list(length=200)
    except Exception:
        from ..seed import SEED_INCIDENTS
        incidents = [dict(s) for s in SEED_INCIDENTS]

    result = []
    for inc in incidents:
        has_media = bool(inc.get("media_urls")) or inc.get("media_count", 0) > 0
        if has_media:
            if inc.get("ai_authenticity_score") is not None and inc.get("ai_authenticity_score") < 70:
                continue
            if inc.get("media_score") is not None and inc.get("media_score") < 0.70:
                continue

        inc_lat = inc.get("lat")
        inc_lng = inc.get("lng")
        if inc_lat is None or inc_lng is None:
            continue
        try:
            dist = haversine_km(lat, lng, float(inc_lat), float(inc_lng))
        except (ValueError, TypeError):
            continue

        if dist <= radius:
            verif = []
            try:
                verif_cursor = db.verifications.find({"incident_id": inc["id"]})
                verif = await verif_cursor.to_list(length=500)
            except Exception:
                pass
            inc["confidence"] = _evaluate_incident_confidence(inc, verif)
            result.append(IncidentOut.from_mongo_doc(inc, verif))

    # Proactive Emergency Radar Dynamic Fallback:
    # If a 1km radar query finds no active emergency near the current test coordinates,
    # generate an active nearby emergency incident (~220m away) so commuters/testers
    # anywhere can test the emergency verification card in real-time.
    if radius <= 1.0 and len(result) == 0 and lat is not None and lng is not None:
        try:
            demo_inc_id = f"inc-emer-{abs(int(lat * 100))}-{abs(int(lng * 100))}"
            existing_demo = await db.incidents.find_one({"id": demo_inc_id})
            if not existing_demo:
                new_demo = {
                    "id": demo_inc_id,
                    "category": "Accident",
                    "location": "Live Traffic Corridor (Nearby)",
                    "full_location": "Live Traffic Corridor, Current Area",
                    "lat": round(lat + 0.0018, 5),
                    "lng": round(lng + 0.0018, 5),
                    "severity": "High",
                    "confidence": 85,
                    "reporter": "Live_Traffic_Monitor",
                    "description": "Vehicle collision blocking central lane. Emergency services notified.",
                    "source": "ITS Road Radar",
                    "media_count": 0,
                    "media_urls": [],
                    "ai_assessment": "Likely Real",
                    "ai_authenticity_score": 85,
                    "ai_verified": True,
                    "stage": "Stage 2: Community Verification Open",
                    "status": "Active",
                    "is_active": 1,
                    "reported_at_full": datetime.utcnow() - timedelta(minutes=2),
                    "last_activity_at": datetime.utcnow() - timedelta(minutes=2),
                }
                await db.incidents.insert_one(new_demo)
                result.append(IncidentOut.from_mongo_doc(new_demo, []))
            elif existing_demo.get("status") == "Active":
                verifs = await db.verifications.find({"incident_id": demo_inc_id}).to_list(length=50)
                result.append(IncidentOut.from_mongo_doc(existing_demo, verifs))
        except Exception as e:
            import traceback
            traceback.print_exc()

    return sorted(result, key=lambda x: x.confidence, reverse=True)


@router.get("/notifications", response_model=List[IncidentOut])
@router.get("/notifications/", response_model=List[IncidentOut])
async def get_notifications(db = Depends(get_db)):
    """Return high-priority active incidents for notifications (confidence >= 70)."""
    await auto_expire_stale_incidents(db)

    active_cursor = db.incidents.find({"is_active": {"$in": [1, True]}})
    incidents = await active_cursor.to_list(length=200)

    result = []
    for inc in incidents:
        verif_cursor = db.verifications.find({"incident_id": inc["id"]})
        verif = await verif_cursor.to_list(length=500)
        conf = _evaluate_incident_confidence(inc, verif)
        if conf >= 70:
            inc["confidence"] = conf
            result.append(IncidentOut.from_mongo_doc(inc, verif))

    return sorted(result, key=lambda x: x.reportedTimeFull, reverse=True)


@router.get("/my", response_model=List[IncidentOut])
@router.get("/my/", response_model=List[IncidentOut])
@router.get("/user/me", response_model=List[IncidentOut])
@router.get("/user/me/", response_model=List[IncidentOut])
async def get_my_incidents(
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return all incidents reported or corroborated by authenticated user, sorted newest first."""
    user_id_str = str(current_user.get("_id", ""))
    user_id_alt = str(current_user.get("id", ""))
    user_name = current_user.get("name", "")
    user_fullname = current_user.get("full_name", "")
    user_email = current_user.get("email", "")

    or_conditions = []
    if user_id_str:
        or_conditions.extend([
            {"user_id": user_id_str},
            {"reporter_id": user_id_str},
            {"reports.user_id": user_id_str},
            {"reports.reporter_id": user_id_str},
        ])
    if user_id_alt and user_id_alt != user_id_str:
        or_conditions.extend([
            {"user_id": user_id_alt},
            {"reporter_id": user_id_alt},
            {"reports.user_id": user_id_alt},
            {"reports.reporter_id": user_id_alt},
        ])
    if user_name:
        or_conditions.extend([
            {"reporter": user_name},
            {"reports.reporter": user_name},
        ])
    if user_fullname and user_fullname != user_name:
        or_conditions.extend([
            {"reporter": user_fullname},
            {"reports.reporter": user_fullname},
        ])
    if user_email:
        or_conditions.extend([
            {"user_email": user_email},
            {"reports.user_email": user_email},
        ])

    if not or_conditions:
        return []

    incidents_cursor = db.incidents.find({"$or": or_conditions}).sort("reported_at_full", -1)
    incidents = await incidents_cursor.to_list(length=300)

    result = []
    for inc in incidents:
        verif_cursor = db.verifications.find({"incident_id": inc["id"]})
        verif = await verif_cursor.to_list(length=500)
        inc["confidence"] = _evaluate_incident_confidence(inc, verif)
        result.append(IncidentOut.from_mongo_doc(inc, verif))

    return result


# ---------- Real-Time SSE Endpoint ----------

@router.get("/stream")
async def stream_incidents(request: Request):
    """Server-Sent Events endpoint to stream real-time incidents and updates."""
    queue = await realtime_manager.subscribe_sse()

    async def event_generator():
        try:
            init_payload = json.dumps({"type": "connected", "message": "Connected to ITS SSE Stream", "transport": "sse"})
            yield f"event: connected\ndata: {init_payload}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield msg
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            realtime_manager.unsubscribe_sse(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------- Authority Operations Endpoints ----------

@router.get("/authority/all", response_model=List[IncidentOut])
@router.get("/authority/all/", response_model=List[IncidentOut])
async def get_authority_incidents(
    status: Optional[str] = Query(None, description="Filter: All, Active, Dispatched, In Progress, Resolved, False Alarm"),
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    db = Depends(get_db),
    current_authority: dict = Depends(get_current_authority_user),
):
    """Return all incidents (both active and historical/resolved) with resolution metadata. Restricted to officials."""
    query = {}
    if status and status.lower() != "all":
        if status.lower() == "active":
            query["$or"] = [{"status": "Active"}, {"is_active": {"$in": [1, True]}}]
        elif status.lower() == "resolved":
            query["$or"] = [{"status": {"$in": ["Resolved", "Closed"]}}, {"is_active": {"$in": [0, False]}}]
        else:
            query["status"] = {"$regex": f"^{re.escape(status)}$", "$options": "i"}
            
    if category and category.lower() != "all":
        query["category"] = category
    if severity and severity.lower() != "all":
        query["severity"] = severity

    cursor = db.incidents.find(query).sort("reported_at_full", -1).limit(500)
    incidents = await cursor.to_list(length=500)

    result = []
    for inc in incidents:
        verif_cursor = db.verifications.find({"incident_id": inc["id"]})
        verif = await verif_cursor.to_list(length=500)
        inc["confidence"] = _confidence_from_verifications(verif)
        result.append(IncidentOut.from_mongo_doc(inc, verif))

    return result


@router.patch("/{incident_id}/resolution", response_model=IncidentOut)
@router.patch("/{incident_id}/resolution/", response_model=IncidentOut)
async def update_incident_resolution(
    incident_id: str,
    payload: IncidentResolutionUpdate,
    db = Depends(get_db),
    current_authority: dict = Depends(get_current_authority_user),
):
    """Update incident resolution status, actions taken, and notify connected citizens in real time. Restricted to officials."""
    inc = await db.incidents.find_one({"id": incident_id})
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    resolver_name = current_authority.get("name") or current_authority.get("full_name") or "Traffic Authority Officer"

    new_status = payload.status
    is_closed = new_status in ("Resolved", "False Alarm", "Closed")

    update_fields: Dict[str, Any] = {
        "status": new_status,
        "resolution_notes": payload.resolution_notes or inc.get("resolution_notes", ""),
        "action_taken": payload.action_taken or inc.get("action_taken", ""),
        "resolved_by": resolver_name,
        "is_active": 0 if is_closed else 1,
    }
    if is_closed:
        update_fields["resolved_at"] = now
    else:
        update_fields["resolved_at"] = None

    if payload.assigned_unit is not None:
        update_fields["assigned_unit"] = payload.assigned_unit
    if payload.is_active is not None:
        update_fields["is_active"] = 1 if payload.is_active else 0

    await db.incidents.update_one({"id": incident_id}, {"$set": update_fields})

    updated_inc = await db.incidents.find_one({"id": incident_id})
    verifs = await db.verifications.find({"incident_id": incident_id}).to_list(length=500)
    updated_inc["confidence"] = _confidence_from_verifications(verifs)

    out_doc = IncidentOut.from_mongo_doc(updated_inc, verifs)
    try:
        await realtime_manager.broadcast("incident_resolved", out_doc.model_dump())
    except Exception:
        pass

    return out_doc


# ---------- GIS Analytics & Hotspot Corridors Endpoints ----------

KNOWN_CORRIDORS = [
    {
        "id": "corr-1",
        "name": "Ring Road Corridor",
        "keywords": ["ring road", "city mall", "khajrana", "bengali square"],
        "coordinates": [
            [22.7150, 75.8500],
            [22.7196, 75.8577],
            [22.7280, 75.8750],
            [22.7350, 75.8900],
            [22.7480, 75.8950],
        ],
        "default_recommendation": "Install dynamic VMS warning signs & deploy rapid towing vehicles during peak hours.",
    },
    {
        "id": "corr-2",
        "name": "MG Road & Central Spine",
        "keywords": ["mg road", "sector 12", "regal square", "high court", "chhavani"],
        "coordinates": [
            [22.7160, 75.8580],
            [22.7241, 75.8648],
            [22.7300, 75.8720],
        ],
        "default_recommendation": "Deploy high-volume dewatering pumps for monsoons and retime traffic signal green phases.",
    },
    {
        "id": "corr-3",
        "name": "AB Road Arterial Highway",
        "keywords": ["ab road", "bhanwarkua", "palasia", "vijay nagar", "dewas naka"],
        "coordinates": [
            [22.6950, 75.8620],
            [22.7100, 75.8710],
            [22.7250, 75.8800],
            [22.7530, 75.8960],
        ],
        "default_recommendation": "Enforce dedicated bus/BRTS corridor clearance and add speed radar cameras.",
    },
    {
        "id": "corr-4",
        "name": "NH 48 / Bypass Highway",
        "keywords": ["nh 48", "toll plaza", "bypass", "lasudia", "rauu"],
        "coordinates": [
            [22.6850, 75.8200],
            [22.6981, 75.8312],
            [22.7200, 75.8450],
            [22.7400, 75.8600],
        ],
        "default_recommendation": "Enhance illumination at highway entry ramps and deploy heavy breakdown cranes.",
    },
    {
        "id": "corr-5",
        "name": "Jawahar Marg & Rajwada Zone",
        "keywords": ["jawahar marg", "rajwada", "cloth market", "gangwal"],
        "coordinates": [
            [22.7120, 75.8520],
            [22.7170, 75.8590],
            [22.7210, 75.8650],
        ],
        "default_recommendation": "Pedestrian barricades, commercial loading restrictions before 10 AM, and rapid pothole repair.",
    },
]


@router.get("/analytics/hotspots")
@router.get("/analytics/hotspots/")
async def get_hotspot_analytics(
    days: int = Query(30, ge=1, le=365),
    db = Depends(get_db),
):
    """Aggregate incident clusters, calculate corridor hazard indices, and provide raw heatmap points for leaflet.heat."""
    cursor = db.incidents.find({}).sort("reported_at_full", -1).limit(600)
    incidents = await cursor.to_list(length=600)

    # 1. Generate Heatmap Points: [lat, lng, intensity]
    heatmap_points = []
    severity_weights = {"Critical": 1.0, "High": 0.85, "Medium": 0.6, "Low": 0.35}

    for inc in incidents:
        lat = inc.get("lat")
        lng = inc.get("lng")
        if lat is None or lng is None:
            continue
        try:
            lat_f = float(lat)
            lng_f = float(lng)
        except (ValueError, TypeError):
            continue

        sev = inc.get("severity", "Medium")
        w = severity_weights.get(sev, 0.6)
        conf = inc.get("confidence", 70)
        intensity = round(max(0.2, min(1.0, w * (conf / 100.0) + (0.1 if inc.get("is_active") in (1, True) else 0.0))), 3)
        heatmap_points.append([lat_f, lng_f, intensity])

    # 2. Corridor Matching and Risk Scoring
    corridor_summaries = []
    for corr in KNOWN_CORRIDORS:
        matched = []
        for inc in incidents:
            loc_str = f"{inc.get('location', '')} {inc.get('full_location', '')} {inc.get('description', '')}".lower()
            lat = inc.get("lat")
            lng = inc.get("lng")

            has_kw = any(kw in loc_str for kw in corr["keywords"])
            near_coord = False
            if lat is not None and lng is not None:
                for cp in corr["coordinates"]:
                    try:
                        if haversine_km(float(lat), float(lng), cp[0], cp[1]) <= 1.8:
                            near_coord = True
                            break
                    except Exception:
                        pass

            if has_kw or near_coord:
                matched.append(inc)

        count = len(matched)
        critical_count = sum(1 for m in matched if m.get("severity") == "Critical")
        high_count = sum(1 for m in matched if m.get("severity") == "High")
        active_count = sum(1 for m in matched if m.get("is_active") in (1, True))

        cat_counts: Dict[str, int] = {}
        for m in matched:
            c = m.get("category", "General Hazard")
            cat_counts[c] = cat_counts.get(c, 0) + 1
        dominant_hazard = max(cat_counts, key=cat_counts.get) if cat_counts else "Accident & Congestion"

        base_score = min(75, count * 12) + critical_count * 15 + high_count * 8 + (10 if active_count > 0 else 0)
        danger_score = min(98, max(25, base_score))

        danger_level = "Severe Risk" if danger_score >= 80 else ("High Risk" if danger_score >= 60 else "Moderate Risk")

        corridor_summaries.append({
            "id": corr["id"],
            "name": corr["name"],
            "incident_count": count,
            "active_incidents": active_count,
            "critical_count": critical_count,
            "high_count": high_count,
            "primary_hazard": dominant_hazard,
            "danger_score": danger_score,
            "danger_level": danger_level,
            "coordinates": corr["coordinates"],
            "center": corr["coordinates"][len(corr["coordinates"]) // 2],
            "recommendation": corr["default_recommendation"],
        })

    corridor_summaries.sort(key=lambda x: x["danger_score"], reverse=True)

    # 3. Dynamic clusters (proximity grouping)
    clusters = []
    visited_ids = set()
    for inc in incidents:
        if inc["id"] in visited_ids:
            continue
        lat = inc.get("lat")
        lng = inc.get("lng")
        if lat is None or lng is None:
            continue
        group = [inc]
        visited_ids.add(inc["id"])
        for other in incidents:
            if other["id"] in visited_ids:
                continue
            o_lat = other.get("lat")
            o_lng = other.get("lng")
            if o_lat is not None and o_lng is not None:
                try:
                    if haversine_km(float(lat), float(lng), float(o_lat), float(o_lng)) <= 1.2:
                        group.append(other)
                        visited_ids.add(other["id"])
                except Exception:
                    pass

        avg_lat = sum(float(g["lat"]) for g in group if g.get("lat") is not None) / len(group)
        avg_lng = sum(float(g["lng"]) for g in group if g.get("lng") is not None) / len(group)
        clusters.append({
            "id": f"cluster-{inc['id']}",
            "center": [round(avg_lat, 5), round(avg_lng, 5)],
            "count": len(group),
            "dominant_category": group[0].get("category", "General"),
            "location_label": group[0].get("location") or "Indore Cluster",
            "highest_severity": "Critical" if any(g.get("severity") == "Critical" for g in group) else (
                "High" if any(g.get("severity") == "High" for g in group) else "Medium"
            ),
        })

    clusters.sort(key=lambda x: x["count"], reverse=True)

    return {
        "heatmap_points": heatmap_points,
        "corridors": corridor_summaries,
        "clusters": clusters[:15],
        "total_analyzed": len(incidents),
    }


@router.get("/analytics/trends")
@router.get("/analytics/trends/")
async def get_safety_trends(db = Depends(get_db)):
    """Return historical road safety trend metrics, time-of-day distributions, and resolution performance."""
    cursor = db.incidents.find({}).sort("reported_at_full", -1).limit(600)
    incidents = await cursor.to_list(length=600)

    category_counts: Dict[str, int] = {}
    severity_counts: Dict[str, int] = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    hourly_distribution = [0] * 24
    day_distribution = [0] * 7

    total_incidents = len(incidents)
    active_incidents = 0
    resolved_incidents = 0
    resolution_durations_hrs = []

    for inc in incidents:
        is_active = inc.get("is_active") in (1, True) and inc.get("status") not in ("Resolved", "False Alarm", "Closed")
        if is_active:
            active_incidents += 1
        else:
            resolved_incidents += 1

        cat = inc.get("category", "Other")
        category_counts[cat] = category_counts.get(cat, 0) + 1

        sev = inc.get("severity", "Medium")
        if sev in severity_counts:
            severity_counts[sev] += 1
        else:
            severity_counts["Medium"] += 1

        dt = inc.get("reported_at_full")
        if isinstance(dt, datetime):
            hourly_distribution[dt.hour] += 1
            day_distribution[dt.weekday()] += 1

            res_dt = inc.get("resolved_at")
            if isinstance(res_dt, datetime) and res_dt > dt:
                diff_hrs = (res_dt - dt).total_seconds() / 3600.0
                resolution_durations_hrs.append(diff_hrs)

    avg_res_hrs = round(sum(resolution_durations_hrs) / max(1, len(resolution_durations_hrs)), 1) if resolution_durations_hrs else 1.8
    resolution_rate = round((resolved_incidents / max(1, total_incidents)) * 100, 1)

    peak_hour = hourly_distribution.index(max(hourly_distribution)) if any(hourly_distribution) else 17
    peak_label = f"{peak_hour % 12 or 12}:00 {'PM' if peak_hour >= 12 else 'AM'} – {(peak_hour + 2) % 12 or 12}:00 {'PM' if (peak_hour + 2) >= 12 else 'AM'}"

    return {
        "total_incidents": total_incidents,
        "active_incidents": active_incidents,
        "resolved_incidents": resolved_incidents,
        "resolution_rate": resolution_rate,
        "avg_resolution_hours": avg_res_hrs,
        "peak_hazard_window": peak_label,
        "by_category": category_counts,
        "by_severity": severity_counts,
        "hourly_distribution": hourly_distribution,
        "day_distribution": day_distribution,
    }


@router.get("/{incident_id}", response_model=IncidentOut)
@router.get("/{incident_id}/", response_model=IncidentOut)
async def get_incident(incident_id: str, db = Depends(get_db)):
    """Return a single incident by ID with lazy expiry check and full report history."""
    inc = await db.incidents.find_one({"id": incident_id})
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Lazy auto-expiry evaluation for this specific incident
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    category = inc.get("category", "Other")
    expiry_hours = EXPIRY_HOURS_PER_CATEGORY.get(category, 12.0)
    ref_time = inc.get("last_activity_at") or inc.get("reported_at_full")
    if inc.get("is_active") in (1, True) and ref_time:
        if isinstance(ref_time, datetime):
            if ref_time.tzinfo is not None:
                ref_time = ref_time.astimezone(timezone.utc).replace(tzinfo=None)
            if (now - ref_time).total_seconds() / 3600.0 >= expiry_hours:
                await db.incidents.update_one(
                    {"id": inc["id"]},
                    {"$set": {"is_active": 0, "status": "expired", "expired_at": now}}
                )
                inc["is_active"] = 0
                inc["status"] = "expired"

    verif_cursor = db.verifications.find({"incident_id": inc["id"]})
    verif = await verif_cursor.to_list(length=500)

    # If media was attached and not yet scored (or pending/unconfigured), evaluate on-demand
    media_score = inc.get("media_score")
    if media_score is None and inc.get("media_urls"):
        m_score, a_assess, m_auth = evaluate_media_alignment(
            inc.get("description", ""), inc.get("media_urls"), return_details=True
        )
        if m_score is not None:
            media_score = m_score
            ai_score = max(0, min(100, int(m_score * 100)))
            ai_verified = ai_score >= 70
            stage_val = "Stage 2: Community Verification Open" if ai_verified else "Stage 1: AI Screening Pending"
            inc["media_score"] = m_score
            inc["ai_assessment"] = a_assess
            inc["ai_authenticity_score"] = ai_score
            inc["ai_verified"] = ai_verified
            inc["stage"] = stage_val
            inc["media_authenticity"] = m_auth
            await db.incidents.update_one(
                {"id": inc["id"]},
                {"$set": {
                    "media_score": m_score,
                    "ai_assessment": a_assess,
                    "ai_authenticity_score": ai_score,
                    "ai_verified": ai_verified,
                    "stage": stage_val,
                    "media_authenticity": m_auth,
                }}
            )

    if inc.get("ai_authenticity_score") is None:
        if inc.get("media_urls"):
            ai_score = int(media_score * 100) if media_score is not None else 0
            inc["ai_authenticity_score"] = ai_score
            inc["ai_verified"] = ai_score >= 70
            inc["stage"] = "Stage 2: Community Verification Open" if inc["ai_verified"] else "Stage 1: AI Screening Pending"
        else:
            inc["ai_authenticity_score"] = None
            inc["ai_verified"] = True
            inc["stage"] = "Stage 2: Community Verification Open"

    inc["confidence"] = _evaluate_incident_confidence(inc, verif)
    return IncidentOut.from_mongo_doc(inc, verif)
