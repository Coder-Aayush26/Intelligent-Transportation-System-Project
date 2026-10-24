import asyncio
import pytest
from backend.services.confidence import compute_total_confidence
from backend.services.gemini_evaluation import GeminiEvaluationError

# Helper to run async compute_total_confidence in pytest

def test_compute_total_confidence_gemini_success(monkeypatch):
    # Stub frequency_score to return a fixed value
    async def fake_frequency_score(lat, lng, db):
        return 0.6
    monkeypatch.setattr('backend.services.confidence.frequency_score', fake_frequency_score)

    # Stub evaluate_media_alignment to return a Gemini score
    async def fake_evaluate_media_alignment(description, media_url):
        return 0.85
    monkeypatch.setattr('backend.services.gemini_evaluation.evaluate_media_alignment', fake_evaluate_media_alignment)

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

