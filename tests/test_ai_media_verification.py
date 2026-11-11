"""Tests for Task 3: Advanced AI Media Authenticity Verification."""
import base64
import io
from datetime import datetime, timezone
import pytest
from PIL import Image
from starlette.testclient import TestClient

from backend.main import app
from backend.database import get_db
from backend.services.confidence import (
    evaluate_media_alignment,
    compute_total_confidence,
    _pre_inspect_image_bytes,
    _heuristic_media_alignment,
)


def _make_solid_color_b64(width=100, height=100, color="red") -> str:
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"


def _make_tiny_b64(width=10, height=10) -> str:
    img = Image.new("RGB", (width, height), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"


def _make_gradient_photo_b64(width=150, height=150) -> str:
    """Create a multi-toned image simulating a photographic scene."""
    img = Image.new("RGB", (width, height))
    pix = img.load()
    for x in range(width):
        for y in range(height):
            # Rich variation with road-like gray, asphalt, and vehicle colors
            r = (x * 7 + y * 3) % 256
            g = (x * 3 + y * 11) % 256
            b = (x * 5 + y * 13) % 256
            pix[x, y] = (r, g, b)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"


def test_solid_monochromatic_dummy_rejection():
    """Flat monochromatic colors (red, white, black) must be rejected with 0.0 score."""
    red_b64 = _make_solid_color_b64(100, 100, color="red")
    score, assessment, details = evaluate_media_alignment(
        "Overturned car on the highway blocking two lanes",
        [red_b64],
        return_details=True,
    )
    assert score == 0.0
    assert details["evidence_quality"] == "synthetic_or_dummy"
    assert details["description_consistency"] == "irrelevant_or_fabricated"
    assert details["is_real_world_scene"] is False
    assert "Monochromatic" in details["detected_scene"] or "flat" in details["detected_scene"].lower()


def test_tiny_resolution_dummy_rejection():
    """Sub-50x50 resolution images must be rejected as insufficient/synthetic."""
    tiny_b64 = _make_tiny_b64(16, 16)
    score, assessment, details = evaluate_media_alignment(
        "Traffic bottleneck due to road closure",
        [tiny_b64],
        return_details=True,
    )
    assert score == 0.0
    assert details["evidence_quality"] == "synthetic_or_dummy"
    assert "too small" in details["assessment"].lower() or "resolution" in details["reasoning"].lower()


def test_corrupted_payload_rejection():
    """Corrupted base64 payload should gracefully return 0.0 without crashing."""
    corrupt_b64 = "data:image/jpeg;base64,NOT_A_VALID_BASE64_STRING!@#$"
    score, assessment, details = evaluate_media_alignment(
        "Severe waterlogging under bridge",
        [corrupt_b64],
        return_details=True,
    )
    assert score == 0.0
    assert details["evidence_quality"] == "synthetic_or_dummy"


def test_description_mismatch_vs_verified_match_heuristic():
    """Local heuristic evaluates description context against photographic traits."""
    img_b64 = _make_gradient_photo_b64()
    header, b64_str = img_b64.split(",", 1)
    raw_bytes = base64.b64decode(b64_str)

    # 1. Non-incident description (mismatch)
    mismatch_res = _heuristic_media_alignment("Having coffee at a quiet cafe indoors", raw_bytes)
    assert mismatch_res["score"] <= 0.30
    assert mismatch_res["description_consistency"] == "inconsistent_mismatch"

    # 2. Authentic road incident description (match)
    match_res = _heuristic_media_alignment("Heavy collision between two cars with bumper damage", raw_bytes)
    assert match_res["score"] >= 0.80
    assert match_res["description_consistency"] == "verified_match"
    assert match_res["is_real_world_scene"] is True


def test_confidence_penalizes_dummy_media_compared_to_no_media():
    """Uploading a dummy graphic must result in lower total confidence than uploading NO media at all."""
    dummy_b64 = _make_solid_color_b64(100, 100, color="blue")
    score_dummy, _, _ = evaluate_media_alignment("Accident on bridge", [dummy_b64], return_details=True)
    assert score_dummy == 0.0

    # Confidence with dummy media (w1 * 0.0)
    conf_dummy = compute_total_confidence(
        description="Accident on bridge",
        media_urls=[dummy_b64],
        media_score=score_dummy,
        report_count=1,
        reporter_reliability=3.0,
        category="Accident",
    )

    # Confidence with no media (neutral default w1 * 0.50)
    conf_no_media = compute_total_confidence(
        description="Accident on bridge",
        media_urls=[],
        media_score=None,
        report_count=1,
        reporter_reliability=3.0,
        category="Accident",
    )

    # Confidence with authentic verified media (w1 * 0.88)
    conf_authentic = compute_total_confidence(
        description="Accident on bridge",
        media_urls=["https://example.com/real.jpg"],
        media_score=0.88,
        report_count=1,
        reporter_reliability=3.0,
        category="Accident",
    )

    assert conf_dummy < conf_no_media < conf_authentic
    # Specifically:
    # conf_dummy: (0.40 * 0.0 + 0.35 * 0.40 + 0.15 * 0.60 + 0.10 * 0.70) * 100 = 30
    # conf_no_media: (0.40 * 0.5 + 0.35 * 0.40 + 0.15 * 0.60 + 0.10 * 0.70) * 100 = 50
    # conf_authentic: (0.40 * 0.88 + 0.35 * 0.40 + 0.15 * 0.60 + 0.10 * 0.70) * 100 = 65
    assert conf_dummy == 30
    assert conf_no_media == 50
    assert conf_authentic == 65


# -------------------------------------------------------------
# End-to-End API Integration with Mock Database
# -------------------------------------------------------------
class MockCollection:
    def __init__(self):
        self.docs = []

    def find(self, query=None):
        query = query or {}
        results = []
        for d in self.docs:
            match = True
            for k, v in query.items():
                if isinstance(v, dict):
                    if "$in" in v and d.get(k) not in v["$in"]:
                        match = False
                        break
                    if "$gte" in v and not (d.get(k) is not None and d.get(k) >= v["$gte"]):
                        match = False
                        break
                    if "$lte" in v and not (d.get(k) is not None and d.get(k) <= v["$lte"]):
                        match = False
                        break
                elif d.get(k) != v:
                    match = False
                    break
            if match:
                results.append(d)
        
        class Cursor:
            def __init__(self, data):
                self._data = data
            async def to_list(self, length=None):
                return list(self._data)
            def sort(self, *args, **kwargs):
                return self
        return Cursor(results)

    async def find_one(self, query):
        for d in self.docs:
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                return dict(d)
        return None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        class Res:
            inserted_id = doc.get("_id")
        return Res()

    async def update_one(self, filter_q, update_q):
        for d in self.docs:
            match = True
            for k, v in filter_q.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update_q:
                    d.update(update_q["$set"])
                return
        return

    async def update_many(self, filter_q, update_q):
        for d in self.docs:
            match = True
            for k, v in filter_q.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update_q:
                    d.update(update_q["$set"])


class MockDB:
    def __init__(self):
        self.incidents = MockCollection()
        self.verifications = MockCollection()
        self.users = MockCollection()


@pytest.fixture
def test_client():
    mock_db = MockDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app)
    yield client, mock_db
    app.dependency_overrides.clear()


def test_api_incident_with_dummy_media(test_client):
    """Submitting an incident with a dummy monochromatic image is rejected by Stage-1 AI screening."""
    client, mock_db = test_client
    dummy_b64 = _make_solid_color_b64(100, 100, color="green")

    payload = {
        "category": "Road Hazard",
        "description": "Massive tree branch collapsed onto the right lane",
        "lat": 12.9716,
        "lng": 77.5946,
        "location": "Cubbon Park North",
        "severity": "High",
        "media_urls": [dummy_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 422, res.text
    detail = res.json()["detail"]
    assert "Report rejected by Stage-1 AI Verification" in detail
    assert "Authenticity score is 0%" in detail
    assert "requires ≥70%" in detail
