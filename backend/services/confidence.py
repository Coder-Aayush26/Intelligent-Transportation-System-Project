import math
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Placeholder for media-description alignment – returns 1.0 if media present, else 0.0
import os
from .gemini_evaluation import evaluate_media_alignment, GeminiEvaluationError

async def get_media_alignment(description: str, media_urls: List[str]) -> float:
    """Return a media‑description alignment score.

    - If no URLs are supplied, returns ``0.0``.
    - If ``GEMINI_API_KEY`` is not configured, falls back to the historic placeholder
      behaviour of returning ``1.0`` when media is present.
    - When the key is present, calls the Gemini service; any failure (network, API,
      malformed response) results in ``0.0`` so the scoring engine can drop the
      media component.
    """
    if not media_urls:
        return 0.0
    # Legacy fallback when the Gemini API key is absent.
    if not os.getenv("GEMINI_API_KEY"):
        return 1.0
    try:
        # Use the first URL for evaluation.
        return await evaluate_media_alignment(description, media_urls[0])
    except GeminiEvaluationError:
        # Failure – treat as missing/unevaluable media.
        return 0.0

    if media_urls:
        return 1.0
    return 0.0

# Placeholder for road vulnerability – returns a static 0.5 (mid‑range) for now
def get_road_vulnerability(lat: float, lng: float) -> float:
    # In a real system, query OSM / government data.
    return 0.5

# Frequency score – uses exponential decay based on recent nearby incidents
async def frequency_score(lat: float, lng: float, db) -> float:
    # Look for incidents within 500 m (≈0.0045°) and last 30 minutes
    deg_radius = 0.5 / 111.0  # 0.5 km approx in degrees
    time_cutoff = datetime.utcnow() - timedelta(minutes=30)
    recent = await db.incidents.find({
        "lat": {"$gte": lat - deg_radius, "$lte": lat + deg_radius},
        "lng": {"$gte": lng - deg_radius, "$lte": lng + deg_radius},
        "reported_at_full": {"$gte": time_cutoff},
        "is_active": 1,
    }).count()
    N = max(recent, 1)
    lam = 0.5
    return 1 - math.exp(-lam * (N - 1))

# User reliability – Laplace smoothing
def user_reliability(total_reports: int, verified_reports: int) -> float:
    alpha = 1.0
    beta = 2.0
    if total_reports == 0:
        return 0.0  # caller will drop the factor
    return (verified_reports + alpha) / (total_reports + beta)

# Normalise dynamic weights – input dict with base weights (may be zero for dropped factors)
def normalize_weights(base_weights: Dict[str, float]) -> Dict[str, float]:
    active = {k: v for k, v in base_weights.items() if v > 0}
    total = sum(active.values())
    return {k: (v / total if total > 0 else 0) for k, v in active.items()}

# Main scoring function
async def compute_total_confidence(
    description: str,
    media_urls: List[str],
    lat: float,
    lng: float,
    user_doc: Dict[str, Any],
    db,
) -> Dict[str, float]:
    # 1️⃣ Media alignment M
    M = await get_media_alignment(description, media_urls)
    # 2️⃣ Frequency F (async DB query)
    F = await frequency_score(lat, lng, db)
    # 3️⃣ User reliability U
    total_r = user_doc.get("total_reports", 0)
    verified_r = user_doc.get("verified_reports", 0)
    U = user_reliability(total_r, verified_r)
    # 4️⃣ Road vulnerability R
    R = get_road_vulnerability(lat, lng)

    # Base weights (may be zero when factor is dropped)
    base_weights = {
        "w_media": 0.40 if media_urls else 0.0,
        "w_freq": 0.35,
        "w_user": 0.15 if total_r > 0 else 0.0,
        "w_road": 0.10,
    }
    # Normalise active weights to sum to 1
    weights = normalize_weights(base_weights)

    # Compute total confidence (0‑100 scale)
    C_total = (
        weights.get("w_media", 0) * M +
        weights.get("w_freq", 0) * F +
        weights.get("w_user", 0) * U +
        weights.get("w_road", 0) * R
    ) * 100

    return {
        "confidence_score": round(C_total, 2),
        "media_alignment_score": round(M * 100, 2),
    }
