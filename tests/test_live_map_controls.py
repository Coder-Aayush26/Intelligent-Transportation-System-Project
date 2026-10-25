"""
Automated tests for Live Map incident data retrieval, category and severity filtering contracts,
and incident synchronization between Live Map and Nearby.
"""
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_db


class InMemoryCursor:
    def __init__(self, items):
        self._items = items

    def limit(self, n):
        self._items = self._items[:n]
        return self

    def sort(self, key, direction=1):
        reverse = direction == -1
        self._items = sorted(
            self._items,
            key=lambda x: x.get(key, datetime.min) if x.get(key) is not None else datetime.min,
            reverse=reverse,
        )
        return self

    async def to_list(self, length=100):
        return self._items[:length]


class InMemoryCollection:
    def __init__(self):
        self.docs = []

    def _matches_query(self, doc, query):
        if not query:
            return True
        for k, v in query.items():
            if k == "$or":
                or_match = False
                for cond in v:
                    if self._matches_query(doc, cond):
                        or_match = True
                        break
                if not or_match:
                    return False
            elif isinstance(v, dict):
                field_val = doc.get(k)
                for op, op_val in v.items():
                    if op == "$in":
                        if field_val not in op_val:
                            return False
                    elif op == "$gte":
                        if field_val is None or field_val < op_val:
                            return False
                    elif op == "$lte":
                        if field_val is None or field_val > op_val:
                            return False
                    elif op == "$ne":
                        if field_val == op_val:
                            return False
            elif doc.get(k) != v:
                return False
        return True

    async def find_one(self, query):
        for doc in self.docs:
            if self._matches_query(doc, query):
                return doc.copy()
        return None

    def find(self, query=None):
        query = query or {}
        matches = [doc.copy() for doc in self.docs if self._matches_query(doc, query)]
        return InMemoryCursor(matches)

    async def insert_one(self, doc):
        self.docs.append(doc.copy())

    async def count_documents(self, query):
        cursor = self.find(query)
        res = await cursor.to_list(1000)
        return len(res)


class MockDatabase:
    def __init__(self):
        self.incidents = InMemoryCollection()
        self.verifications = InMemoryCollection()
        self.users = InMemoryCollection()
        self.sessions = InMemoryCollection()


@pytest.fixture
def mock_db():
    db = MockDatabase()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. Vadodara Accident (Critical)
    db.incidents.docs.append({
        "_id": "inc-vadodara-acc",
        "id": "inc-vadodara-acc",
        "category": "Accident",
        "location": "Raopura Road",
        "full_location": "Shiva Statue, Raopura Road, Vadodara, Gujarat",
        "lat": 22.3008,
        "lng": 73.2043,
        "severity": "Critical",
        "confidence": 90,
        "description": "Multi Crash at Sursagar junction",
        "source": "Web App",
        "media_urls": [],
        "media_count": 0,
        "is_active": 1,
        "reported_at_full": now,
    })
    # Add 6 confirm verifications so calculated confidence is 50 + 6*5 = 80% (high confidence)
    for v_idx in range(6):
        db.verifications.docs.append({
            "_id": f"verif-{v_idx+1}",
            "incident_id": "inc-vadodara-acc",
            "verdict": "confirm",
            "created_at": now,
        })

    # 2. Vadodara Waterlogging (Medium)
    db.incidents.docs.append({
        "_id": "inc-vadodara-wat",
        "id": "inc-vadodara-wat",
        "category": "Waterlogging",
        "location": "Manjalpur",
        "full_location": "LalBaug Gate Rd, Manjalpur, Vadodara",
        "lat": 22.2700,
        "lng": 73.1900,
        "severity": "Medium",
        "confidence": 60,
        "description": "Water accumulated on low-lying road",
        "source": "Web App",
        "media_urls": [],
        "media_count": 0,
        "is_active": 1,
        "reported_at_full": now,
    })

    # 3. Indore Congestion (~280 km away)
    db.incidents.docs.append({
        "_id": "inc-indore-cng",
        "id": "inc-indore-cng",
        "category": "Congestion",
        "location": "Vijay Nagar",
        "full_location": "Vijay Nagar Square, AB Road, Indore",
        "lat": 22.7533,
        "lng": 75.8937,
        "severity": "Low",
        "confidence": 75,
        "description": "Heavy peak traffic",
        "source": "Web App",
        "media_urls": [],
        "media_count": 0,
        "is_active": 1,
        "reported_at_full": now,
    })

    # 4. Inactive / Resolved Incident (must be excluded from active queries)
    db.incidents.docs.append({
        "_id": "inc-resolved-1",
        "id": "inc-resolved-1",
        "category": "Construction",
        "location": "Old Padra Road",
        "lat": 22.2900,
        "lng": 73.1700,
        "severity": "Low",
        "confidence": 50,
        "is_active": 0,
        "reported_at_full": now,
    })

    return db


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_live_map_incidents_endpoints_without_trailing_slash(client):
    """Verify that both /api/incidents and /incidents return 200 without trailing slash errors."""
    res1 = client.get("/api/incidents")
    assert res1.status_code == 200
    data1 = res1.json()
    assert isinstance(data1, list)
    assert len(data1) == 3  # Only active incidents

    # Ensure resolved incident is excluded
    ids = [i["id"] for i in data1]
    assert "inc-resolved-1" not in ids
    assert "inc-vadodara-acc" in ids
    assert "inc-vadodara-wat" in ids
    assert "inc-indore-cng" in ids

    # Root route alias also works
    res2 = client.get("/incidents")
    assert res2.status_code == 200
    assert len(res2.json()) == 3


def test_stats_summary_endpoint(client):
    """Verify dashboard stats summary endpoint derives accurate counts."""
    res = client.get("/api/incidents/stats/summary")
    assert res.status_code == 200
    stats = res.json()
    assert stats["totalActive"] == 3
    assert stats["highConfidence"] == 1  # inc-vadodara-acc has 80% confidence
    assert stats["reportsToday"] == 4   # 4 total reported today (including resolved)
    assert stats["verifiedToday"] == 1  # 1 confirmed verified incident


def test_live_map_category_filtering(client):
    """Verify category filtering on /api/incidents endpoint."""
    res_acc = client.get("/api/incidents?category=Accident")
    assert res_acc.status_code == 200
    acc_list = res_acc.json()
    assert len(acc_list) == 1
    assert acc_list[0]["id"] == "inc-vadodara-acc"

    res_wat = client.get("/api/incidents?category=Waterlogging")
    assert res_wat.status_code == 200
    wat_list = res_wat.json()
    assert len(wat_list) == 1
    assert wat_list[0]["id"] == "inc-vadodara-wat"

    res_non = client.get("/api/incidents?category=Road Blockage")
    assert res_non.status_code == 200
    assert len(res_non.json()) == 0


def test_live_map_and_nearby_synchronization(client):
    """Verify synchronization between Live Map and Nearby Incidents scopes."""
    # Live Map gets all active incidents across regions
    res_live = client.get("/api/incidents")
    assert res_live.status_code == 200
    live_incidents = res_live.json()
    assert len(live_incidents) == 3

    # Nearby Vadodara (10 km radius) gets only the 2 Vadodara incidents
    res_vadodara = client.get("/api/incidents/nearby?lat=22.3008&lng=73.2043&radius=10")
    assert res_vadodara.status_code == 200
    vad_incidents = res_vadodara.json()
    assert len(vad_incidents) == 2

    # Nearby Indore (10 km radius) gets only the 1 Indore incident
    res_indore = client.get("/api/incidents/nearby?lat=22.7533&lng=75.8937&radius=10")
    assert res_indore.status_code == 200
    indore_incidents = res_indore.json()
    assert len(indore_incidents) == 1
    assert indore_incidents[0]["id"] == "inc-indore-cng"


def test_invalid_coordinates_return_400_or_422(client):
    """Ensure invalid latitude or longitude returns 400 or 422 client error."""
    res = client.get("/api/incidents/nearby?lat=95.0&lng=75.0&radius=10")
    assert res.status_code in (400, 422)

    res2 = client.get("/api/incidents?lat=-999&lng=0&radius=10")
    assert res2.status_code == 400
