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
    q: str = Query(..., min_length=2, description="Place or city name to geocode")
):
    """Resolve a query string (e.g. 'Vadodara', 'Indore') into geographic coordinates."""
    clean_q = q.strip().lower()
    now = time.time()

    cache_key = f"search:{clean_q}"
    if cache_key in _GEOCODE_CACHE:
        data, exp = _GEOCODE_CACHE[cache_key]
        if now < exp:
            return data

    encoded_q = urllib.parse.quote(clean_q)
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={encoded_q}&limit=6&addressdetails=1"

    try:
        raw_results = _query_nominatim(url)
    except Exception as e:
        # Fallback to empty list or known major cities cache if network fails
        raise HTTPException(status_code=502, detail=f"Geocoding service unavailable: {str(e)}")

    results: List[GeocodeResult] = []
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

    _GEOCODE_CACHE[cache_key] = (results, now + CACHE_TTL_SECONDS)
    return results


@router.get("/reverse", response_model=ReverseResult)
@router.get("/reverse/", response_model=ReverseResult)
def reverse_geocode(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Longitude"),
):
    """Reverse-geocode latitude and longitude into a structured human-readable address."""
    # Round coordinates to 4 decimal places (~11 meters) for cache efficiency
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
