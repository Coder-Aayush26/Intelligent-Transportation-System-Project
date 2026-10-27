"""Incidents router — CRUD endpoints for traffic incidents."""
import math
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..database import get_db
from ..schemas import IncidentCreate, IncidentOut, StatsOut
from ..auth import get_current_user, get_current_user_optional

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


def _confidence_from_verifications(verif_list) -> int:
    """Simple rule: base 50 + 5 per confirm - 8 per contradict, capped 5-99."""
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

    incidents_cursor = db.incidents.find(query)
    incidents = await incidents_cursor.to_list(length=300)

    result = []
    for inc in incidents:
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

        verif_cursor = db.verifications.find({"incident_id": inc["id"]})
        verif = await verif_cursor.to_list(length=500)
        inc["confidence"] = compute_total_confidence(
            media_score=inc.get("media_score"),
            verif_list=verif,
            user=None,
        )
        result.append(IncidentOut.from_mongo_doc(inc, verif))

    return result


@router.post("", response_model=IncidentOut, status_code=201)
@router.post("/", response_model=IncidentOut, status_code=201)
async def create_incident(
    payload: IncidentCreate,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user_optional),
):
    """Create a new incident report."""
    _validate_coords(payload.lat, payload.lng)
    incident_id = f"inc-{uuid.uuid4().hex[:8]}"

    reporter_name = "Anonymous"
    reporter_user_id = None
    reporter_email = None
    if current_user:
        reporter_name = current_user.get("name") or current_user.get("full_name") or "Community Member"
        reporter_user_id = str(current_user.get("_id", current_user.get("id", "")))
        reporter_email = current_user.get("email")

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Evaluate media alignment once with Gemini Vision on incident creation
    media_score = None
    ai_assessment = "No media attached"
    if payload.media_urls:
        media_score, ai_assessment = evaluate_media_alignment(payload.description, payload.media_urls)

    initial_confidence = compute_total_confidence(
        media_score=media_score,
        verif_list=[],
        user=current_user,
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
        "description": payload.description,
        "reporter": reporter_name,
        "user_id": reporter_user_id,
        "reporter_id": reporter_user_id,
        "user_email": reporter_email,
        "source": payload.source or "Web App",
        "media_urls": payload.media_urls,
        "media_count": len(payload.media_urls),
        "map_position_top": "50%",
        "map_position_left": "50%",
        "reported_at_full": now,
        "is_active": 1,
    }

    await db.incidents.insert_one(inc_doc)
    return IncidentOut.from_mongo_doc(inc_doc, [])


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

    active_cursor = db.incidents.find(query)
    raw_active = await active_cursor.to_list(length=300)

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

        verif_cursor = db.verifications.find({"incident_id": inc["id"]})
        verif = await verif_cursor.to_list(length=500)
        inc["confidence"] = compute_total_confidence(
            media_score=inc.get("media_score"),
            verif_list=verif,
            user=None,
        )
        active_incidents.append(inc)

    high_conf = [i for i in active_incidents if i.get("confidence", 50) >= 80]

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_reports = await db.incidents.count_documents({
        "reported_at_full": {"$gte": today_start}
    })

    verified = 0
    for inc in active_incidents:
        verif_count = await db.verifications.count_documents({
            "incident_id": inc["id"],
            "verdict": "confirm",
        })
        if verif_count >= 1:
            verified += 1

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

    active_cursor = db.incidents.find(query)
    incidents = await active_cursor.to_list(length=200)

    result = []
    for inc in incidents:
        inc_lat = inc.get("lat")
        inc_lng = inc.get("lng")
        if inc_lat is None or inc_lng is None:
            continue
        try:
            dist = haversine_km(lat, lng, float(inc_lat), float(inc_lng))
        except (ValueError, TypeError):
            continue

        if dist <= radius:
            verif_cursor = db.verifications.find({"incident_id": inc["id"]})
            verif = await verif_cursor.to_list(length=500)
            inc["confidence"] = compute_total_confidence(
                media_score=inc.get("media_score"),
                verif_list=verif,
                user=None,
            )
            result.append(IncidentOut.from_mongo_doc(inc, verif))

    return sorted(result, key=lambda x: x.confidence, reverse=True)


@router.get("/notifications", response_model=List[IncidentOut])
@router.get("/notifications/", response_model=List[IncidentOut])
async def get_notifications(db = Depends(get_db)):
    """Return high-priority active incidents for notifications (confidence >= 70)."""
    active_cursor = db.incidents.find({"is_active": {"$in": [1, True]}})
    incidents = await active_cursor.to_list(length=200)

    result = []
    for inc in incidents:
        verif_cursor = db.verifications.find({"incident_id": inc["id"]})
        verif = await verif_cursor.to_list(length=500)
        conf = compute_total_confidence(
            media_score=inc.get("media_score"),
            verif_list=verif,
            user=None,
        )
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
    """Return all incidents reported by the authenticated user, sorted newest first."""
    user_id_str = str(current_user.get("_id", ""))
    user_id_alt = str(current_user.get("id", ""))
    user_name = current_user.get("name", "")
    user_fullname = current_user.get("full_name", "")
    user_email = current_user.get("email", "")

    or_conditions = []
    if user_id_str:
        or_conditions.extend([{"user_id": user_id_str}, {"reporter_id": user_id_str}])
    if user_id_alt and user_id_alt != user_id_str:
        or_conditions.extend([{"user_id": user_id_alt}, {"reporter_id": user_id_alt}])
    if user_name:
        or_conditions.append({"reporter": user_name})
    if user_fullname and user_fullname != user_name:
        or_conditions.append({"reporter": user_fullname})
    if user_email:
        or_conditions.append({"user_email": user_email})

    if not or_conditions:
        return []

    incidents_cursor = db.incidents.find({"$or": or_conditions}).sort("reported_at_full", -1)
    incidents = await incidents_cursor.to_list(length=300)

    result = []
    for inc in incidents:
        verif_cursor = db.verifications.find({"incident_id": inc["id"]})
        verif = await verif_cursor.to_list(length=500)
        inc["confidence"] = compute_total_confidence(
            media_score=inc.get("media_score"),
            verif_list=verif,
            user=None,
        )
        result.append(IncidentOut.from_mongo_doc(inc, verif))

    return result


@router.get("/{incident_id}", response_model=IncidentOut)
@router.get("/{incident_id}/", response_model=IncidentOut)
async def get_incident(incident_id: str, db = Depends(get_db)):
    """Return a single incident by ID."""
    inc = await db.incidents.find_one({"id": incident_id})
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    verif_cursor = db.verifications.find({"incident_id": inc["id"]})
    verif = await verif_cursor.to_list(length=500)

    inc["confidence"] = compute_total_confidence(
        media_score=inc.get("media_score"),
        verif_list=verif,
        user=None,
    )
    return IncidentOut.from_mongo_doc(inc, verif)
