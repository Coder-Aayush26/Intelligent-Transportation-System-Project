"""Location router — geocoding and reverse-geocoding via OpenStreetMap Nominatim with server caching."""
import json
import math
import time
import urllib.parse
import urllib.request
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/location", tags=["location"])

# Server-side in-memory cache to respect Nominatim policy and optimize performance
# key -> (data, expire_timestamp)
_GEOCODE_CACHE: dict = {}
CACHE_TTL_SECONDS = 3600  # 1 hour

NOMINATIM_HEADERS = {
    "User-Agent": "ITS-Intelligent-Transportation-System/1.0 (contact: admin@its.local)"
}

# Major surveyed Indore transit hubs, arterial junctions, landmarks and medical centers
INDORE_SURVEYED_LANDMARKS = [
    {"name": "Devi Ahilyabai Holkar Airport", "lat": 22.7219, "lng": 75.8043, "keywords": ["devi ahilya airport", "devi ahilyabai airport", "indore airport", "dabhm airport", "idr airport"]},
    {"name": "Indore Railway Junction & Sarwate", "lat": 22.7164, "lng": 75.8679, "keywords": ["indore junction", "indore railway station", "sarwate bus stand", "sarwate", "chhotigwaltoli", "indore station"]},
    {"name": "Vijay Nagar Square", "lat": 22.7533, "lng": 75.8937, "keywords": ["vijay nagar", "vijaynagar", "scheme 54", "scheme 78", "c21 mall indore", "malhar mega mall"]},
    {"name": "Palasia Square", "lat": 22.7244, "lng": 75.8839, "keywords": ["palasia", "old palasia", "new palasia", "chappan", "56 dukan", "chappan dukan"]},
    {"name": "Bhanwarkuan Square", "lat": 22.6924, "lng": 75.8672, "keywords": ["bhanwarkuan", "bhawarkua", "bhanwar kuan", "bhanwarkuwa", "davv", "takshashila"]},
    {"name": "Rajwada Palace & Sarafa", "lat": 22.7186, "lng": 75.8556, "keywords": ["rajwada", "sarafa", "khajuri", "malharganj"]},
    {"name": "Crystal IT Park", "lat": 22.6852, "lng": 75.8732, "keywords": ["crystal it park", "indore it park", "ring road it park"]},
    {"name": "TCS & Infosys Campus", "lat": 22.7780, "lng": 75.8280, "keywords": ["super corridor", "tcs indore", "infosys indore", "super corridor tcs"]},
    {"name": "Indore Bypass (MR-10 Junction)", "lat": 22.7660, "lng": 75.9380, "keywords": ["indore bypass", "mr10 bypass", "mr-10 bypass"]},
    {"name": "Radisson Square", "lat": 22.7560, "lng": 75.9140, "keywords": ["radisson indore", "star square", "radisson square"]},
    {"name": "Khajrana Ganesh Temple", "lat": 22.7315, "lng": 75.9080, "keywords": ["khajrana", "khajrana ganesh", "khajrana square"]},
    {"name": "Geeta Bhawan Square", "lat": 22.7155, "lng": 75.8812, "keywords": ["geeta bhawan", "geeta bhavan", "gita bhavan", "manorama raje"]},
    {"name": "LIG Square", "lat": 22.7380, "lng": 75.8880, "keywords": ["lig square", "lig indore", "anup talkies"]},
    {"name": "Navlakha Square", "lat": 22.7020, "lng": 75.8730, "keywords": ["navlakha", "navlakha square"]},
    {"name": "Regal Square & High Court", "lat": 22.7200, "lng": 75.8720, "keywords": ["regal square", "indore high court", "regal chouraha"]},
    {"name": "Pipliyahana Square (World Cup Square)", "lat": 22.7100, "lng": 75.9020, "keywords": ["pipliyahana", "world cup square", "world cup chouraha"]},
    {"name": "Bengali Square", "lat": 22.7220, "lng": 75.9090, "keywords": ["bengali square", "kanadia road indore"]},
    {"name": "Bapat Square", "lat": 22.7525, "lng": 75.8770, "keywords": ["bapat square", "sukhlia indore"]},
    {"name": "Super Corridor Roundabout", "lat": 22.7520, "lng": 75.8160, "keywords": ["super corridor roundabout", "gandhi nagar indore"]},
    {"name": "Tower Square & Agrasen Chouraha", "lat": 22.6970, "lng": 75.8695, "keywords": ["tower square", "agrasen chouraha", "sapna sangeeta"]},
    {"name": "Annapurna Temple & Road", "lat": 22.6960, "lng": 75.8360, "keywords": ["annapurna temple", "annpurna temple", "annapurna road indore"]},
    {"name": "Mhow Naka", "lat": 22.7060, "lng": 75.8480, "keywords": ["mhow naka", "mhow square"]},
    {"name": "Bada Ganpati", "lat": 22.7230, "lng": 75.8420, "keywords": ["bada ganpati", "bada ganpati indore"]},
    {"name": "Phoenix Citadel Mall", "lat": 22.7680, "lng": 75.9420, "keywords": ["phoenix citadel", "citadel mall indore", "phoenix mall indore"]},
    {"name": "Treasure Island (TI) Mall", "lat": 22.7210, "lng": 75.8760, "keywords": ["ti mall", "treasure island mall indore", "tukoganj mall"]},
    {"name": "SAIMS / Aurobindo Hospital", "lat": 22.7880, "lng": 75.8550, "keywords": ["aurobindo hospital", "saims indore", "bhawrasla"]},
    {"name": "Rau Circle & IIM Indore", "lat": 22.6280, "lng": 75.8080, "keywords": ["iim indore", "rau circle"]},
    {"name": "Gangwal Bus Stand", "lat": 22.7110, "lng": 75.8430, "keywords": ["gangwal bus stand", "gangwal indore"]},
    {"name": "Patnipura & Pardesipura", "lat": 22.7350, "lng": 75.8810, "keywords": ["patnipura", "pardesipura", "subhash nagar indore"]},
    {"name": "Choithram Hospital & Square", "lat": 22.6820, "lng": 75.8600, "keywords": ["choithram hospital", "choithram square"]},
    {"name": "Bombay Hospital", "lat": 22.7580, "lng": 75.8970, "keywords": ["bombay hospital indore", "bombay hospital square"]},
    {"name": "Mahalaxmi Nagar", "lat": 22.7630, "lng": 75.8980, "keywords": ["mahalaxmi nagar", "mahalaxmi nagar indore"]},
    {"name": "MR-9 Square", "lat": 22.7480, "lng": 75.8950, "keywords": ["mr 9 square", "mr-9 square", "mr9 square"]},
    {"name": "Silicon City", "lat": 22.6450, "lng": 75.8150, "keywords": ["silicon city indore", "silicon city rau"]},
    {"name": "Bicholi Mardana", "lat": 22.7150, "lng": 75.9260, "keywords": ["bicholi mardana", "bicholi indore"]},
    {"name": "Ranjeet Hanuman", "lat": 22.7090, "lng": 75.8390, "keywords": ["ranjeet hanuman", "ranjit hanuman temple"]},
    {"name": "Robot Square", "lat": 22.7420, "lng": 75.9120, "keywords": ["robot square", "robot chouraha"]},
    {"name": "Nipania", "lat": 22.7650, "lng": 75.9150, "keywords": ["nipania indore", "nipaniya indore"]},
]

GENERIC_TERMS = {
    "airport", "station", "junction", "terminal", "flight", "railway", "train",
    "mall", "hospital", "temple", "park", "square", "chouraha", "circle", "road",
    "bypass", "toll", "bridge", "flyover", "center", "centre", "tower", "hotel", "residency",
    "court", "campus", "city", "cross", "radial", "bus", "stand"
}

def _find_surveyed_landmark(query: str):
    q = query.strip().lower()
    if q in GENERIC_TERMS:
        return None

    for lm in INDORE_SURVEYED_LANDMARKS:
        if q == lm["name"].lower():
            return lm
        if any(kw == q for kw in lm["keywords"]):
            return lm

    if len(q) >= 4:
        tokens = [t for t in q.split() if t and t not in GENERIC_TERMS]
        if tokens:
            for lm in INDORE_SURVEYED_LANDMARKS:
                if q in lm["name"].lower():
                    return lm
                if any(kw in q or (len(q) >= 8 and q in kw) for kw in lm["keywords"]):
                    return lm
    return None


class GeocodeResult(BaseModel):
    displayName: str
    lat: float
    lng: float
    type: str = "place"
    importance: float = 0.0


class ReverseResult(BaseModel):
    displayName: str
    lat: float
    lng: float
    locality: str = ""
    city: str = ""
    state: str = ""
    country: str = ""


def _query_nominatim(url: str) -> dict | list:
    req = urllib.request.Request(url, headers=NOMINATIM_HEADERS)
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read().decode("utf-8"))


@router.get("/search", response_model=List[GeocodeResult])
@router.get("/search/", response_model=List[GeocodeResult])
def search_location(
    q: str = Query(..., min_length=2, description="Place or city name to geocode"),
    lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="User latitude for proximity biasing"),
    lng: Optional[float] = Query(None, ge=-180.0, le=180.0, description="User longitude for proximity biasing"),
):
    """Resolve a query string (e.g. 'Airport', 'Vijay Nagar') into geographic coordinates."""
    clean_q = q.strip().lower()
    now = time.time()

    cache_key = f"search:{clean_q}"
    if lat is not None and lng is not None:
        cache_key += f":{round(lat, 2)}:{round(lng, 2)}"

    if cache_key in _GEOCODE_CACHE:
        data, exp = _GEOCODE_CACHE[cache_key]
        if now < exp:
            return data

    # 1. Query OpenStreetMap Nominatim across India (with optional proximity viewbox)
    encoded_q = urllib.parse.quote(clean_q)
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={encoded_q}&countrycodes=in&limit=8&addressdetails=1"
    if lat is not None and lng is not None:
        min_lon = round(lng - 0.75, 4)
        max_lon = round(lng + 0.75, 4)
        min_lat = round(lat - 0.75, 4)
        max_lat = round(lat + 0.75, 4)
        url += f"&viewbox={min_lon},{max_lat},{max_lon},{min_lat}&bounded=0"

    raw_results = []
    try:
        raw_results = _query_nominatim(url)
    except Exception:
        raw_results = []

    results: List[GeocodeResult] = []
    if isinstance(raw_results, list):
        for item in raw_results:
            try:
                lat = float(item.get("lat", 0))
                lng = float(item.get("lon", 0))
                display_name = item.get("display_name", "")
                if display_name:
                    results.append(
                        GeocodeResult(
                            displayName=display_name,
                            lat=lat,
                            lng=lng,
                            type=item.get("type", "place"),
                            importance=float(item.get("importance", 0.0)),
                        )
                    )
            except (ValueError, TypeError):
                continue

    # 2. Check local surveyed landmark directory if external query produced no results
    if not results:
        surveyed = _find_surveyed_landmark(clean_q)
        if surveyed:
            results.append(
                GeocodeResult(
                    displayName=f"{surveyed['name']}, Indore, Madhya Pradesh",
                    lat=surveyed["lat"],
                    lng=surveyed["lng"],
                    type="landmark",
                    importance=1.0,
                )
            )

    _GEOCODE_CACHE[cache_key] = (results, now + CACHE_TTL_SECONDS)
    return results


@router.get("/reverse", response_model=ReverseResult)
@router.get("/reverse/", response_model=ReverseResult)
def reverse_geocode(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Longitude"),
):
    """Reverse-geocode latitude and longitude into a structured human-readable address."""
    lat_rounded = round(lat, 4)
    lng_rounded = round(lng, 4)
    now = time.time()

    cache_key = f"rev:{lat_rounded}:{lng_rounded}"
    if cache_key in _GEOCODE_CACHE:
        data, exp = _GEOCODE_CACHE[cache_key]
        if now < exp:
            return data

    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat_rounded}&lon={lng_rounded}&addressdetails=1"

    try:
        raw = _query_nominatim(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Reverse geocoding service unavailable: {str(e)}")

    display_name = raw.get("display_name") or f"{lat_rounded}, {lng_rounded}"
    address = raw.get("address", {})

    locality = (
        address.get("suburb")
        or address.get("neighbourhood")
        or address.get("residential")
        or address.get("road")
        or address.get("city_district")
        or address.get("city")
        or ""
    )
    city = address.get("city") or address.get("town") or address.get("village") or address.get("county") or ""
    state = address.get("state", "")
    country = address.get("country", "")

    result = ReverseResult(
        displayName=display_name,
        lat=lat_rounded,
        lng=lng_rounded,
        locality=locality,
        city=city,
        state=state,
        country=country,
    )

    _GEOCODE_CACHE[cache_key] = (result, now + CACHE_TTL_SECONDS)
    return result
