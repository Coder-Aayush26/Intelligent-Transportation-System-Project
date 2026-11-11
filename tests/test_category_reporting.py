"""Comprehensive test suite for Incident Reporting across all Categories with Stage-1 AI Verification.

Verifies that genuine photographic evidence for every incident category passes Stage-1 AI screening (>=70%),
while synthetic/monochromatic dummy graphics are strictly rejected with HTTP 422.
"""
import base64
import io
import pytest
from PIL import Image
from starlette.testclient import TestClient

from backend.main import app
from backend.database import get_db


def _make_realistic_scene_b64(width=160, height=120, tint="blue") -> str:
    """Generate a multi-tonal, high-entropy photographic payload simulating a real outdoor scene."""
    img = Image.new("RGB", (width, height))
    pix = img.load()
    for x in range(width):
        for y in range(height):
            if tint == "water":
                # Deep blues, gray water ripples, muddy tones, and reflections
                r = (x * 4 + y * 2) % 180
                g = (x * 3 + y * 5 + 40) % 220
                b = (x * 6 + y * 7 + 80) % 255
            elif tint == "accident":
                # Asphalt dark gray, vehicle red, metal silver
                r = (x * 9 + y * 3) % 240
                g = (x * 2 + y * 2) % 160
                b = (x * 3 + y * 8) % 170
            elif tint == "traffic":
                # Tail lights red, street lights yellow, road black
                r = (x * 7 + y * 6) % 255
                g = (x * 3 + y * 4) % 190
                b = (x * 2 + y * 2) % 150
            else:
                # General outdoor street scene
                r = (x * 5 + y * 3) % 230
                g = (x * 4 + y * 6) % 230
                b = (x * 3 + y * 7) % 230
            pix[x, y] = (r, g, b)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"


def _make_solid_color_b64(width=100, height=100, color="red") -> str:
    """Generate an obvious monochromatic flat color block (dummy)."""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"


def _make_tiny_b64(width=16, height=16) -> str:
    """Generate an unacceptably tiny icon/pixel image."""
    img = Image.new("RGB", (width, height), color="navy")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"


class MockCollection:
    def __init__(self):
        self.docs = []

    def find(self, query=None):
        query = query or {}
        results = []
        for d in self.docs:
            match = True
            for k, v in query.items():
                if k == "$or" and isinstance(v, list):
                    or_match = False
                    for cond in v:
                        for ck, cv in cond.items():
                            if d.get(ck) == cv:
                                or_match = True
                                break
                        if or_match:
                            break
                    if not or_match:
                        match = False
                        break
                elif isinstance(v, dict):
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
            def __init__(self, items):
                self._items = items
            def sort(self, *args, **kwargs):
                return self
            def limit(self, *args, **kwargs):
                return self
            async def to_list(self, length=None):
                return list(self._items)

        return Cursor(results)

    async def find_one(self, query):
        cursor = self.find(query)
        items = await cursor.to_list()
        return items[0] if items else None

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

    async def count_documents(self, query):
        cursor = self.find(query)
        items = await cursor.to_list()
        return len(items)


class MockDB:
    def __init__(self):
        self.incidents = MockCollection()
        self.verifications = MockCollection()
        self.users = MockCollection()


@pytest.fixture
def client():
    mock_db = MockDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


# ==============================================================================
# CATEGORY TEST CASES
# ==============================================================================

def test_waterlogging_report_with_genuine_photo(client):
    """Waterlogging incident with genuine photographic evidence must pass Stage-1 AI screening."""
    photo_b64 = _make_realistic_scene_b64(tint="water")
    payload = {
        "category": "Waterlogging",
        "severity": "High",
        "description": "Severe road waterlogging and flooded underpass near Palasia Square",
        "location": "Palasia Underpass",
        "lat": 22.7244,
        "lng": 75.8839,
        "media_urls": [photo_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 201, f"Failed to report waterlogging: {res.text}"
    data = res.json()

    assert data["category"] == "Waterlogging"
    assert data["aiAuthenticityScore"] is not None
    assert data["aiAuthenticityScore"] >= 70, f"Score {data['aiAuthenticityScore']} was below 70%"
    assert data["aiVerified"] is True
    assert "Stage 2" in data["stage"]
    assert "water" in data["aiAssessment"].lower() or "drainage" in data["aiAssessment"].lower()


def test_waterlogging_brief_description_passes_by_category(client):
    """Waterlogging report with brief non-keyword description must still pass Stage-1 via category matching."""
    photo_b64 = _make_realistic_scene_b64(tint="water")
    payload = {
        "category": "Waterlogging",
        "severity": "Medium",
        "description": "Near scheme 78, please avoid taking this route right now",
        "location": "Scheme 78",
        "lat": 22.7600,
        "lng": 75.8950,
        "media_urls": [photo_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 201, f"Failed brief waterlogging report: {res.text}"
    data = res.json()
    assert data["aiAuthenticityScore"] >= 70
    assert data["aiVerified"] is True


def test_accident_report_with_genuine_photo(client):
    """Accident report with real photo must pass Stage-1 AI verification."""
    photo_b64 = _make_realistic_scene_b64(tint="accident")
    payload = {
        "category": "Accident",
        "severity": "Critical",
        "description": "Two-vehicle collision with damaged front bumper blocking center lane",
        "location": "Bhanwarkua Square",
        "lat": 22.6920,
        "lng": 75.8670,
        "media_urls": [photo_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["aiAuthenticityScore"] >= 70
    assert data["aiVerified"] is True
    assert "vehicle" in data["aiAssessment"].lower() or "impact" in data["aiAssessment"].lower() or "collision" in data["aiAssessment"].lower()


def test_traffic_jam_report_with_genuine_photo(client):
    """Traffic Jam report with real photo must pass Stage-1 AI verification."""
    photo_b64 = _make_realistic_scene_b64(tint="traffic")
    payload = {
        "category": "Traffic Jam",
        "severity": "Medium",
        "description": "Heavy peak hour bottleneck with slow moving queues",
        "location": "Regal Square",
        "lat": 22.7210,
        "lng": 75.8750,
        "media_urls": [photo_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["aiAuthenticityScore"] >= 70
    assert data["aiVerified"] is True


def test_road_hazard_report_with_genuine_photo(client):
    """Road Hazard (Potholes / road surface damage) must pass Stage-1 AI verification."""
    photo_b64 = _make_realistic_scene_b64()
    payload = {
        "category": "Road Hazard",
        "severity": "High",
        "description": "Deep dangerous pothole crater in the right lane after monsoon rains",
        "location": "AB Road Vijay Nagar",
        "lat": 22.7530,
        "lng": 75.8940,
        "media_urls": [photo_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["aiAuthenticityScore"] >= 70
    assert data["aiVerified"] is True


def test_road_blockage_report_with_genuine_photo(client):
    """Road Blockage (Fallen trees, barrier obstructions) must pass Stage-1 AI verification."""
    photo_b64 = _make_realistic_scene_b64()
    payload = {
        "category": "Road Blockage",
        "severity": "High",
        "description": "Large tree branch collapsed across road obstructing both lanes",
        "location": "Race Course Road",
        "lat": 22.7250,
        "lng": 75.8780,
        "media_urls": [photo_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["aiAuthenticityScore"] >= 70
    assert data["aiVerified"] is True


def test_road_closure_report_with_genuine_photo(client):
    """Road Closure with detour / diversion must pass Stage-1 AI verification."""
    photo_b64 = _make_realistic_scene_b64()
    payload = {
        "category": "Road Closure",
        "severity": "Medium",
        "description": "Official road closure barricades set up with diversion towards ring road",
        "location": "Khajrana Road",
        "lat": 22.7310,
        "lng": 75.8890,
        "media_urls": [photo_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["aiAuthenticityScore"] >= 70
    assert data["aiVerified"] is True


def test_construction_report_with_genuine_photo(client):
    """Construction zone report must pass Stage-1 AI verification."""
    photo_b64 = _make_realistic_scene_b64()
    payload = {
        "category": "Construction",
        "severity": "Medium",
        "description": "Metro pillar construction work in progress with safety cones",
        "location": "Super Corridor",
        "lat": 22.7650,
        "lng": 75.8450,
        "media_urls": [photo_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["aiAuthenticityScore"] >= 70
    assert data["aiVerified"] is True


def test_other_category_report_with_genuine_photo(client):
    """General 'Other' roadway hazard with genuine photo must pass Stage-1 AI verification."""
    photo_b64 = _make_realistic_scene_b64()
    payload = {
        "category": "Other",
        "severity": "Low",
        "description": "Oil spill slippery surface reported on ramp",
        "location": "Bypass Entry Ramp",
        "lat": 22.7100,
        "lng": 75.8400,
        "media_urls": [photo_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["aiAuthenticityScore"] >= 70
    assert data["aiVerified"] is True


# ==============================================================================
# REJECTION & EDGE CASE TEST CASES
# ==============================================================================

def test_solid_monochromatic_dummy_image_strictly_rejected(client):
    """Submitting a flat solid green block must be rejected by Stage-1 AI screening with HTTP 422."""
    dummy_b64 = _make_solid_color_b64(100, 100, color="green")
    payload = {
        "category": "Waterlogging",
        "severity": "High",
        "description": "Severe flooding on the road",
        "location": "Palasia Square",
        "lat": 22.7244,
        "lng": 75.8839,
        "media_urls": [dummy_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 422, f"Expected 422 rejection, got {res.status_code}: {res.text}"
    detail = res.json()["detail"]
    assert "Report rejected by Stage-1 AI Verification" in detail
    assert "Authenticity score is 0%" in detail
    assert "requires ≥70%" in detail


def test_tiny_resolution_dummy_image_strictly_rejected(client):
    """Submitting an unreadable 16x16 pixel graphic must be rejected with HTTP 422."""
    tiny_b64 = _make_tiny_b64(16, 16)
    payload = {
        "category": "Accident",
        "severity": "High",
        "description": "Major crash on highway",
        "location": "NH 52",
        "lat": 22.7300,
        "lng": 75.8700,
        "media_urls": [tiny_b64],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 422, res.text
    detail = res.json()["detail"]
    assert "Report rejected by Stage-1 AI Verification" in detail
    assert "0%" in detail


def test_text_only_report_without_media_is_accepted(client):
    """Reports submitted without media bypass Stage-1 media screening and open directly to Stage-2 community verification."""
    payload = {
        "category": "Traffic Jam",
        "severity": "Low",
        "description": "Minor signal delay at intersection",
        "location": "Geeta Bhawan",
        "lat": 22.7180,
        "lng": 75.8790,
        "media_urls": [],
    }

    res = client.post("/incidents", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["aiVerified"] is True
    assert "Stage 2" in data["stage"]

