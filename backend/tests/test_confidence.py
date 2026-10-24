import sys, os, asyncio
# Add project root to PYTHONPATH to import the 'backend' package
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
import pytest
from backend.services.confidence import compute_total_confidence

# Helper to run async functions in pytest
def test_compute_total_confidence_first_time_user(monkeypatch):
    # Stub frequency_score to return a fixed value
    async def fake_frequency_score(lat, lng, db):
        return 0.2
    monkeypatch.setattr('backend.services.confidence.frequency_score', fake_frequency_score)

    description = "Pothole on main street"
    media_urls = []  # no media
    lat, lng = 12.34, 56.78
    user_doc = {"total_reports": 0, "verified_reports": 0}
    db = None  # not used due to stub

    result = asyncio.run(compute_total_confidence(
        description=description,
        media_urls=media_urls,
        lat=lat,
        lng=lng,
        user_doc=user_doc,
        db=db,
    ))

    # Expected calculation
    M = 0.0  # no media
    F = 0.2
    U = 0.0  # first‑time user
    R = 0.5  # default road vulnerability
    # Base weights (media and user dropped)
    base_weights = {"w_media": 0.0, "w_freq": 0.35, "w_user": 0.0, "w_road": 0.10}
    total = base_weights["w_freq"] + base_weights["w_road"]
    w_freq = base_weights["w_freq"] / total
    w_road = base_weights["w_road"] / total
    expected_score = (w_freq * F + w_road * R) * 100
    expected_score = round(expected_score, 2)

    assert result["confidence_score"] == expected_score
    assert result["media_alignment_score"] == round(M * 100, 2)


def test_compute_total_confidence_regular_user(monkeypatch):
    async def fake_frequency_score(lat, lng, db):
        return 0.6
    monkeypatch.setattr('backend.services.confidence.frequency_score', fake_frequency_score)

    description = "Fallen tree blocking lane"
    media_urls = ["http://example.com/image1.jpg"]
    lat, lng = 10.0, 20.0
    user_doc = {"total_reports": 5, "verified_reports": 4}
    db = None

    result = asyncio.run(compute_total_confidence(
        description=description,
        media_urls=media_urls,
        lat=lat,
        lng=lng,
        user_doc=user_doc,
        db=db,
    ))

    M = 1.0
    F = 0.6
    U = (4 + 1.0) / (5 + 2.0)  # Laplace smoothing
    R = 0.5
    base_weights = {"w_media": 0.40, "w_freq": 0.35, "w_user": 0.15, "w_road": 0.10}
    total = sum(base_weights.values())
    weights = {k: v / total for k, v in base_weights.items()}
    expected_score = (
        weights["w_media"] * M +
        weights["w_freq"] * F +
        weights["w_user"] * U +
        weights["w_road"] * R
    ) * 100
    expected_score = round(expected_score, 2)

    assert result["confidence_score"] == expected_score
    assert result["media_alignment_score"] == round(M * 100, 2)
