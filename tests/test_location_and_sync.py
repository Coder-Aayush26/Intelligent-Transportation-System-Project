"""Automated tests for Location Geocoding, Geographic Filtering, and Incident Synchronization."""
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_db
from backend.routers.incidents import haversine_km


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

    # 1. Vadodara Active Incident
    db.incidents.docs.append({
        "_id": "inc-vadodara-1",
        "id": "inc-vadodara-1",
        "category": "Accident",
        "location": "Raopura Road",
        "full_location": "Shiva Statue, Raopura Road, Vadodara, Gujarat",
        "lat": 22.3008,
        "lng": 73.2043,
        "severity": "Critical",
        "confidence": 85,
        "description": "Multi Crash at Sursagar junction",
        "source": "Web App",
        "media_urls": ["https://example.com/crash.jpg"],
        "media_count": 1,
        "is_active": 1,
        "reported_at_full": now,
    })

    # Add confirmation verification so it counts as verified
    db.verifications.docs.append({
        "_id": "verif-1",
        "incident_id": "inc-vadodara-1",
        "verdict": "confirm",
        "created_at": now,
    })

    # 2. Indore Active Incident (~340 km away)
    db.incidents.docs.append({
        "_id": "inc-indore-1",
        "id": "inc-indore-1",
        "category": "Congestion",
        "location": "AB Road",
        "full_location": "AB Road, Indore, Madhya Pradesh",
        "lat": 22.7196,
        "lng": 75.8577,
        "severity": "Medium",
        "confidence": 60,
        "description": "Heavy peak hour bottleneck",
        "source": "Mobile App",
        "media_urls": [],
        "media_count": 0,
        "is_active": True,  # Test boolean active flag compatibility
        "reported_at_full": now,
    })

    # 3. Resolved / Inactive Incident (should never appear on active maps)
    db.incidents.docs.append({
        "_id": "inc-vadodara-resolved",
        "id": "inc-vadodara-resolved",
        "category": "Waterlogging",
        "location": "Karelibaug",
        "full_location": "Karelibaug, Vadodara",
        "lat": 22.3150,
        "lng": 73.2050,
        "severity": "Low",
        "confidence": 40,
        "description": "Cleared drain water",
        "source": "Web App",
        "media_urls": [],
        "is_active": 0,  # Resolved
        "reported_at_full": now,
    })

    return db


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


# ==============================================================================
# Scenario 1 & 3: Geocoding Location Search for Vadodara
# ==============================================================================

def test_search_vadodara_geocoding(client):
    """Scenario 3: Searching 'vadodara' returns valid geographic coordinates in Gujarat."""
    res = client.get("/api/location/search?q=vadodara")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    first = data[0]
    assert "vadodara" in first["displayName"].lower()
    # Vadodara coordinates are ~22.3 deg lat, ~73.2 deg lng
    assert 22.0 <= first["lat"] <= 22.6
    assert 73.0 <= first["lng"] <= 73.5


# ==============================================================================
# Scenario 4: Search for Indore distinct from Vadodara (no coordinate leakage)
# ==============================================================================

def test_search_indore_distinct_coordinates(client):
    """Scenario 4: Searching 'indore' returns Indore coords, distinct from Vadodara (~340 km apart)."""
    res_indore = client.get("/api/location/search?q=indore")
    assert res_indore.status_code == 200
    indore_data = res_indore.json()
    assert len(indore_data) > 0
    indore_loc = indore_data[0]
    assert 22.5 <= indore_loc["lat"] <= 23.0
    assert 75.5 <= indore_loc["lng"] <= 76.2

    # Verify Haversine separation distance is roughly 277 km (great-circle distance)
    vadodara_lat, vadodara_lng = 22.3008, 73.2043
    distance = haversine_km(vadodara_lat, vadodara_lng, indore_loc["lat"], indore_loc["lng"])
    assert 250 <= distance <= 320


# ==============================================================================
# Reverse Geocode Endpoint
# ==============================================================================

def test_reverse_geocode_coordinates(client):
    """Reverse geocoding coordinates resolves into a structured human-readable address."""
    res = client.get("/api/location/reverse?lat=22.3008&lng=73.2043")
    assert res.status_code == 200
    data = res.json()
    assert "vadodara" in data["displayName"].lower() or "gujarat" in data["displayName"].lower()
    assert data["lat"] == 22.3008
    assert data["lng"] == 73.2043


# ==============================================================================
# Scenario 6: Coordinate Validation & Geographic Boundaries
# ==============================================================================

def test_coordinate_bounds_validation(client):
    """Invalid latitude, longitude, or radius values are rejected with 400 Bad Request."""
    # Latitude > 90
    res_lat = client.get("/api/incidents/nearby?lat=95.0&lng=73.2&radius=10")
    assert res_lat.status_code in (400, 422)

    # Longitude > 180
    res_lng = client.get("/api/incidents/nearby?lat=22.3&lng=190.0&radius=10")
    assert res_lng.status_code in (400, 422)

    # Negative radius
    res_rad = client.get("/api/incidents/nearby?lat=22.3&lng=73.2&radius=-5")
    assert res_rad.status_code in (400, 422)


def test_haversine_precise_distance_calculation():
    """Haversine distance accurately measures distances and conforms to sphere mathematics."""
    # Sursagar lake to Vadodara Airport (~5.5 km)
    sursagar_lat, sursagar_lng = 22.3008, 73.2043
    airport_lat, airport_lng = 22.3325, 73.2263
    dist = haversine_km(sursagar_lat, sursagar_lng, airport_lat, airport_lng)
    assert 4.0 <= dist <= 6.5

    # Zero distance between identical points
    assert haversine_km(sursagar_lat, sursagar_lng, sursagar_lat, sursagar_lng) == 0.0


# ==============================================================================
# Scenario 5 & 6: Incident Synchronization & Geographic Scopes
# ==============================================================================

def test_incident_synchronization_between_live_map_and_nearby(client):
    """
    Live Map and Nearby Incidents consume the same underlying authoritative records:
    1. /incidents returns all active incidents across the system (Vadodara & Indore).
    2. /incidents/nearby around Vadodara returns ONLY the Vadodara incident (within 10km).
    3. The resolved incident is excluded from both.
    4. Both pages match on incident id, coordinates, category, and severity.
    """
    # 1. Live Map data source (/incidents)
    live_map_res = client.get("/api/incidents/")
    assert live_map_res.status_code == 200
    all_active = live_map_res.json()
    all_ids = [inc["id"] for inc in all_active]

    assert "inc-vadodara-1" in all_ids
    assert "inc-indore-1" in all_ids
    # Inactive/resolved incident must NOT appear
    assert "inc-vadodara-resolved" not in all_ids

    # 2. Nearby Incidents query around Vadodara (10 km radius)
    nearby_res = client.get("/api/incidents/nearby?lat=22.3008&lng=73.2043&radius=10")
    assert nearby_res.status_code == 200
    nearby_incidents = nearby_res.json()
    nearby_ids = [inc["id"] for inc in nearby_incidents]

    # Vadodara incident is present
    assert "inc-vadodara-1" in nearby_ids
    # Indore incident (340 km away) is excluded
    assert "inc-indore-1" not in nearby_ids
    # Resolved incident is excluded
    assert "inc-vadodara-resolved" not in nearby_ids

    # 3. Match normalized fields between the two endpoints
    vadodara_from_all = next(i for i in all_active if i["id"] == "inc-vadodara-1")
    vadodara_from_nearby = next(i for i in nearby_incidents if i["id"] == "inc-vadodara-1")

    assert vadodara_from_all["id"] == vadodara_from_nearby["id"]
    assert vadodara_from_all["category"] == vadodara_from_nearby["category"] == "Accident"
    assert vadodara_from_all["severity"] == vadodara_from_nearby["severity"] == "Critical"
    assert vadodara_from_all["coords"]["lat"] == vadodara_from_nearby["coords"]["lat"] == 22.3008
    assert vadodara_from_all["coords"]["lng"] == vadodara_from_nearby["coords"]["lng"] == 73.2043


def test_nearby_incidents_indore_scope(client):
    """Querying nearby incidents around Indore (lat=22.7196, lng=75.8577) returns Indore disruptions only."""
    res = client.get("/api/incidents/nearby?lat=22.7196&lng=75.8577&radius=10")
    assert res.status_code == 200
    data = res.json()
    ids = [i["id"] for i in data]
    assert "inc-indore-1" in ids
    assert "inc-vadodara-1" not in ids


# ==============================================================================
# Scenario 7 & 8: Stats Calculation & Category Filtering
# ==============================================================================

def test_stats_summary_accuracy(client):
    """Stats endpoint derives accurate metrics from active incidents and verification records."""
    res = client.get("/api/incidents/stats/summary")
    assert res.status_code == 200
    stats = res.json()
    # 2 active incidents (Vadodara and Indore), resolved one is excluded
    assert stats["totalActive"] == 2
    # At least 1 verified incident (Vadodara has confirm verdict)
    assert stats["verifiedToday"] >= 1


def test_category_filtering(client):
    """Filtering by category returns only incidents matching the chosen category."""
    res = client.get("/api/incidents/?category=Accident")
    assert res.status_code == 200
    data = res.json()
    assert all(i["category"] == "Accident" for i in data)
    assert any(i["id"] == "inc-vadodara-1" for i in data)
