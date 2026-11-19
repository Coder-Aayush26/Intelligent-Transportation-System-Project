import pytest
from unittest.mock import patch
from starlette.testclient import TestClient
from backend.main import app
from backend.database import get_db
import backend.services.confidence as conf_mod
from tests.test_category_reporting import MockDB, _make_realistic_scene_b64, _make_solid_color_b64

mock_db = MockDB()
app.dependency_overrides[get_db] = lambda: mock_db
client = TestClient(app)

print("=== TEST 1: Gibberish description 'cedcc' ===")
res1 = client.post("/incidents", json={
    "category": "Road Blockage",
    "description": "cedcc",
    "lat": 22.25,
    "lng": 73.21,
    "media_urls": ["https://res.cloudinary.com/hb0sukix/image/upload/v1795075010/kpgmpstyemfkubcaael3.avif"]
})
print("Status:", res1.status_code)
print("Detail:", res1.json().get("detail"))
assert res1.status_code == 422
assert "gibberish" in res1.json().get("detail") or "brief" in res1.json().get("detail")

print("\n=== TEST 2: Real Gemini Vision on user dummy avatar with plausible description ===")
res2 = client.post("/incidents", json={
    "category": "Road Blockage",
    "description": "Heavy tree branch and fallen barrier blocking traffic completely",
    "lat": 22.25,
    "lng": 73.21,
    "media_urls": ["https://res.cloudinary.com/hb0sukix/image/upload/v1795075010/kpgmpstyemfkubcaael3.avif"]
})
print("Status:", res2.status_code)
print("Detail:", res2.json().get("detail"))
assert res2.status_code == 422
assert "Report rejected by Stage-1 AI Verification" in res2.json().get("detail")

print("\n=== TEST 3: Offline Heuristic on dummy avatar icon with plausible description ===")
with patch.object(conf_mod, "get_gemini_api_key", return_value=""):
    res3 = client.post("/incidents", json={
        "category": "Road Blockage",
        "description": "Heavy tree branch and fallen barrier blocking traffic completely",
        "lat": 22.25,
        "lng": 73.21,
        "media_urls": ["https://res.cloudinary.com/hb0sukix/image/upload/v1795075010/kpgmpstyemfkubcaael3.avif"]
    })
    print("Offline Status:", res3.status_code)
    print("Offline Detail:", res3.json().get("detail"))
    assert res3.status_code == 422
    assert "Report rejected by Stage-1 AI Verification" in res3.json().get("detail")

print("\n=== TEST 4: Offline Heuristic on Solid Monochromatic Block ===")
solid_b64 = _make_solid_color_b64()
with patch.object(conf_mod, "get_gemini_api_key", return_value=""):
    res4 = client.post("/incidents", json={
        "category": "Accident",
        "description": "Two sedans collided on the highway blocking two lanes",
        "lat": 22.25,
        "lng": 73.21,
        "media_urls": [solid_b64]
    })
    print("Solid Block Status:", res4.status_code)
    print("Solid Block Detail:", res4.json().get("detail"))
    assert res4.status_code == 422
    assert "Report rejected by Stage-1 AI Verification" in res4.json().get("detail")

print("\n=== TEST 5: Genuine Photo + Genuine Description (Heuristic Mode) ===")
real_b64 = _make_realistic_scene_b64(tint="traffic")
with patch.object(conf_mod, "get_gemini_api_key", return_value=""):
    res5 = client.post("/incidents", json={
        "category": "Road Blockage",
        "description": "Large tree branch and debris blocking right lane on main road",
        "lat": 22.25,
        "lng": 73.21,
        "media_urls": [real_b64]
    })
    print("Genuine Status:", res5.status_code)
    if res5.status_code == 201:
        print("Created ID:", res5.json().get("id"), "AI Score:", res5.json().get("aiAuthenticityScore"), "Stage:", res5.json().get("stage"))
    assert res5.status_code == 201
    assert res5.json().get("aiAuthenticityScore") >= 70

print("\n🎉 ALL 5 RIGOROUS VERIFICATION TESTS PASSED 100%!")
