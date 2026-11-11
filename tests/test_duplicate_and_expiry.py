"""Tests for Task 2: Duplicate Incident Detection, Consolidation & Auto-Expiry."""
from datetime import datetime, timedelta, timezone
import pytest
from starlette.testclient import TestClient

from backend.main import app
from backend.database import get_db
from backend.routers.incidents import haversine_distance_meters, auto_expire_stale_incidents


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
                            if "." in ck:
                                parent, child = ck.split(".", 1)
                                parent_val = d.get(parent)
                                if isinstance(parent_val, list):
                                    for elem in parent_val:
                                        if elem.get(child) == cv:
                                            or_match = True
                                            break
                                elif isinstance(parent_val, dict):
                                    if parent_val.get(child) == cv:
                                        or_match = True
                            elif d.get(ck) == cv:
                                or_match = True
                            if or_match:
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
        return doc

    async def update_one(self, filter_query, update_data):
        doc = await self.find_one(filter_query)
        if doc and "$set" in update_data:
            for k, v in update_data["$set"].items():
                doc[k] = v
        return doc

    async def count_documents(self, query):
        cursor = self.find(query)
        items = await cursor.to_list()
        return len(items)


class MockDB:
    def __init__(self):
        self.incidents = MockCollection()
        self.verifications = MockCollection()
        self.users = MockCollection()


# ==========================================
# Unit Tests for Distance & Expiry Logic
# ==========================================

def test_haversine_distance_meters_accuracy():
    """Verify exact distance calculation in metres."""
    # Same point
    assert haversine_distance_meters(22.7196, 75.8577, 22.7196, 75.8577) == 0.0

    # Approx 39 metres apart
    dist = haversine_distance_meters(22.719600, 75.857700, 22.719900, 75.857900)
    assert 35.0 <= dist <= 45.0

    # Approx 315 metres apart
    dist_far = haversine_distance_meters(22.719600, 75.857700, 22.721500, 75.860000)
    assert 280.0 <= dist_far <= 350.0


# ==========================================
# Integration Tests: Duplicate Detection & Consolidation
# ==========================================

def test_duplicate_incident_consolidation_within_100m():
    """Two reports within 100m of the same category must consolidate into one primary incident."""
    mock_db = MockDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app)

    try:
        # Report 1: Primary report
        rep1_payload = {
            "category": "Accident",
            "severity": "Medium",
            "description": "Minor fender bender near intersection",
            "location": "Palasia Square",
            "full_location": "Palasia Square, AB Road, Indore",
            "lat": 22.7200,
            "lng": 75.8800,
            "source": "Mobile App",
            "media_urls": [],
        }
        res1 = client.post("/incidents", json=rep1_payload)
        assert res1.status_code == 201
        data1 = res1.json()
        primary_id = data1["id"]
        assert data1["reportCount"] == 1
        assert data1["isConsolidated"] is False
        assert len(data1["reports"]) == 1
        initial_confidence = data1["confidence"]

        # Report 2: Second user reporting ~35 metres away, same category
        rep2_payload = {
            "category": "Accident",
            "severity": "High",  # Higher severity
            "description": "Two cars blocking left lane at Palasia",
            "location": "Near Palasia Square",
            "full_location": "Near Palasia Square, Indore",
            "lat": 22.7202,
            "lng": 75.8802,
            "source": "Web App",
            "media_urls": ["https://example.com/accident_evidence.jpg"],
        }
        res2 = client.post("/incidents", json=rep2_payload)
        assert res2.status_code == 201
        data2 = res2.json()

        # Must be consolidated into primary incident
        assert data2["id"] == primary_id
        assert data2["reportCount"] == 2
        assert data2["isConsolidated"] is True
        assert len(data2["reports"]) == 2

        # Check preserved individual reports
        assert data2["reports"][0]["description"] == "Minor fender bender near intersection"
        assert data2["reports"][1]["description"] == "Two cars blocking left lane at Palasia"
        assert data2["reports"][1]["mediaUrls"] == ["https://example.com/accident_evidence.jpg"]

        # Severity should escalate to highest (High)
        assert data2["severity"] == "High"
        # Frequency F increased -> confidence must be higher than single report
        assert data2["confidence"] > initial_confidence

        # In listing, only 1 consolidated incident should appear, not 2
        list_res = client.get("/incidents")
        assert list_res.status_code == 200
        active_list = list_res.json()
        assert len(active_list) == 1
        assert active_list[0]["id"] == primary_id
        assert active_list[0]["reportCount"] == 2

    finally:
        app.dependency_overrides.clear()


def test_independent_incidents_beyond_100m():
    """Reports farther than 100m must NOT consolidate and remain independent incidents."""
    mock_db = MockDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app)

    try:
        # Report 1
        res1 = client.post("/incidents", json={
            "category": "Traffic Jam",
            "severity": "Medium",
            "description": "Slow traffic near mall",
            "location": "MG Road",
            "lat": 22.7200,
            "lng": 75.8800,
            "media_urls": [],
        })
        assert res1.status_code == 201
        id1 = res1.json()["id"]

        # Report 2: ~350m away (> 100m)
        res2 = client.post("/incidents", json={
            "category": "Traffic Jam",
            "severity": "Medium",
            "description": "Gridlock at next signal",
            "location": "MG Road Sector 2",
            "lat": 22.7230,
            "lng": 75.8810,
            "media_urls": [],
        })
        assert res2.status_code == 201
        id2 = res2.json()["id"]

        assert id1 != id2

        list_res = client.get("/incidents")
        assert len(list_res.json()) == 2

    finally:
        app.dependency_overrides.clear()


def test_different_category_within_100m_remains_independent():
    """Reports within 100m but of different categories must NOT consolidate."""
    mock_db = MockDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app)

    try:
        # Report 1: Accident
        res1 = client.post("/incidents", json={
            "category": "Accident",
            "severity": "High",
            "description": "Vehicle crash",
            "location": "Bypass Road",
            "lat": 22.7500,
            "lng": 75.8900,
            "media_urls": [],
        })
        id1 = res1.json()["id"]

        # Report 2: Waterlogging at same coordinates
        res2 = client.post("/incidents", json={
            "category": "Waterlogging",
            "severity": "Medium",
            "description": "Puddle accumulation",
            "location": "Bypass Road",
            "lat": 22.7501,
            "lng": 75.8901,
            "media_urls": [],
        })
        id2 = res2.json()["id"]

        assert id1 != id2
        list_res = client.get("/incidents")
        assert len(list_res.json()) == 2

    finally:
        app.dependency_overrides.clear()


# ==========================================
# Integration Tests: Auto-Expiry Mechanism
# ==========================================

def test_auto_expiry_deactivates_stale_incidents():
    """Incidents past their category expiry threshold are auto-expired but retain full history."""
    mock_db = MockDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app)

    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        seven_hours_ago = now - timedelta(hours=7)

        # Insert stale accident (threshold: 6.0 hours)
        stale_accident = {
            "_id": "inc-stale-acc",
            "id": "inc-stale-acc",
            "category": "Accident",
            "location": "Old Ring Road",
            "lat": 22.7000,
            "lng": 75.8500,
            "severity": "High",
            "confidence": 75,
            "reporter": "TestUser",
            "description": "Historical accident report",
            "media_urls": [],
            "reported_at_full": seven_hours_ago,
            "last_activity_at": seven_hours_ago,
            "is_active": 1,
            "status": "active",
            "report_count": 1,
            "reports": [{
                "report_id": "rep-stale-1",
                "reporter": "TestUser",
                "description": "Historical accident report",
                "reported_at": seven_hours_ago,
            }],
        }
        mock_db.incidents.docs.append(stale_accident)

        # Fresh waterlogging (threshold: 24.0 hours, 2 hours old)
        fresh_water = {
            "_id": "inc-fresh-wat",
            "id": "inc-fresh-wat",
            "category": "Waterlogging",
            "location": "Lake Road",
            "lat": 22.7100,
            "lng": 75.8600,
            "severity": "Medium",
            "confidence": 70,
            "reporter": "User2",
            "description": "Fresh waterlogging",
            "media_urls": [],
            "reported_at_full": now - timedelta(hours=2),
            "last_activity_at": now - timedelta(hours=2),
            "is_active": 1,
            "status": "active",
            "report_count": 1,
            "reports": [],
        }
        mock_db.incidents.docs.append(fresh_water)

        # GET /incidents should trigger auto-expiry
        res = client.get("/incidents")
        assert res.status_code == 200
        active_items = res.json()

        # Stale accident should be excluded from active list; fresh waterlogging remains
        active_ids = [item["id"] for item in active_items]
        assert "inc-stale-acc" not in active_ids
        assert "inc-fresh-wat" in active_ids

        # Directly fetching the expired incident via GET /incidents/{id} MUST succeed
        # and preserve the entire report history with status="expired"
        get_res = client.get("/incidents/inc-stale-acc")
        assert get_res.status_code == 200
        expired_data = get_res.json()
        assert expired_data["id"] == "inc-stale-acc"
        assert expired_data["isActive"] is False
        assert expired_data["status"] == "expired"
        assert len(expired_data["reports"]) == 1
        assert expired_data["reports"][0]["reporter"] == "TestUser"

    finally:
        app.dependency_overrides.clear()


def test_corroboration_resets_expiry_timer():
    """A fresh corroborating report updates last_activity_at and prevents premature expiry."""
    mock_db = MockDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app)

    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        five_hours_ago = now - timedelta(hours=5)

        # Accident reported 5 hours ago (Accident threshold: 6h)
        existing_acc = {
            "_id": "inc-long-acc",
            "id": "inc-long-acc",
            "category": "Accident",
            "location": "Bypass Highway",
            "lat": 22.7600,
            "lng": 75.9000,
            "severity": "High",
            "confidence": 65,
            "reporter": "InitialReporter",
            "description": "Initial crash report",
            "media_urls": [],
            "reported_at_full": five_hours_ago,
            "last_activity_at": five_hours_ago,
            "is_active": 1,
            "status": "active",
            "report_count": 1,
            "reports": [],
        }
        mock_db.incidents.docs.append(existing_acc)

        # New corroborating report arrives now within 50m
        res = client.post("/incidents", json={
            "category": "Accident",
            "severity": "High",
            "description": "Vehicle wreckage still blocking traffic",
            "location": "Bypass Highway",
            "lat": 22.7603,
            "lng": 75.9002,
            "media_urls": [],
        })
        assert res.status_code == 201
        data = res.json()
        assert data["id"] == "inc-long-acc"
        assert data["reportCount"] == 2
        assert data["isActive"] is True

        # Now simulate 2 more hours passing (total 7h from creation, but only 2h from last activity)
        # It should remain active because last_activity was reset
        check_now = now + timedelta(hours=2)
        expired_count = None
        import asyncio
        asyncio.run(auto_expire_stale_incidents(mock_db, now=check_now))

        inc_doc = mock_db.incidents.docs[0]
        assert inc_doc["is_active"] == 1
        assert inc_doc["status"] == "active"

    finally:
        app.dependency_overrides.clear()

