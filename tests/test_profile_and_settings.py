"""Automated tests for Profile editing, Avatar management, Settings persistence, and Logout session termination."""
import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_db
from backend.auth import hash_password, create_access_token


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

    async def find_one(self, query):
        for doc in self.docs:
            match = True
            for k, v in query.items():
                if k == "$or":
                    or_match = False
                    for cond in v:
                        if all(doc.get(ck) == cv for ck, cv in cond.items()):
                            or_match = True
                            break
                    if not or_match:
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                return doc.copy()
        return None

    def find(self, query=None):
        query = query or {}
        matches = []
        for doc in self.docs:
            match = True
            for k, v in query.items():
                if k == "$or":
                    or_match = False
                    for cond in v:
                        if all(doc.get(ck) == cv for ck, cv in cond.items()):
                            or_match = True
                            break
                    if not or_match:
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                matches.append(doc.copy())
        return InMemoryCursor(matches)

    async def insert_one(self, doc):
        self.docs.append(doc.copy())

    async def update_one(self, query, update):
        target = await self.find_one(query)
        if target:
            for idx, doc in enumerate(self.docs):
                if doc.get("_id") == target.get("_id"):
                    if "$set" in update:
                        for sk, sv in update["$set"].items():
                            doc[sk] = sv
                    self.docs[idx] = doc
                    break

    async def delete_one(self, query):
        for idx, doc in enumerate(self.docs):
            if all(doc.get(k) == v for k, v in query.items()):
                del self.docs[idx]
                break

    async def count_documents(self, query):
        cursor = self.find(query)
        res = await cursor.to_list(1000)
        return len(res)


class MockDatabase:
    def __init__(self):
        self.users = InMemoryCollection()
        self.sessions = InMemoryCollection()
        self.incidents = InMemoryCollection()
        self.verifications = InMemoryCollection()


@pytest.fixture
def mock_db():
    db = MockDatabase()
    
    # Pre-seed User A
    user_a = {
        "_id": "user-a-123",
        "name": "Alex Mercer",
        "full_name": "Alex Mercer",
        "email": "alex@example.com",
        "password_hash": hash_password("Password123!"),
        "member_since": "Oct 2026",
        "reliability_score": 3.0,
        "reliability_label": "New Member",
        "created_at": datetime.utcnow(),
    }
    db.users.docs.append(user_a)

    # Active session for User A
    session_a = {
        "_id": "sess-a-123",
        "session_id": "sess-a-123",
        "user_id": "user-a-123",
        "email": "alex@example.com",
        "name": "Alex Mercer",
        "created_at": datetime.utcnow(),
        "last_active": datetime.utcnow(),
        "is_active": True,
    }
    db.sessions.docs.append(session_a)

    return db


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    token = create_access_token({
        "sub": "user-a-123",
        "session_id": "sess-a-123",
        "email": "alex@example.com",
        "name": "Alex Mercer",
    })
    return {"Authorization": f"Bearer {token}"}


# ── Test Suite ──────────────────────────────────────────────────────────

def test_get_profile_new_user_honest_metrics(client, auth_headers):
    """Scenario: A new user with no reports sees a truthful initial profile state without fabricated checkmarks."""
    res = client.get("/api/users/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["name"] == "Alex Mercer"
    assert data["email"] == "alex@example.com"
    assert data["totalReports"] == 0
    assert data["totalVerifications"] == 0
    assert data["reliabilityLabel"] == "New Member (No activity yet)"
    assert len(data["recentActivity"]) == 0
    assert "Baseline score assigned" in data["scoreFactors"][0]


def test_edit_profile_name_success_and_persistence(client, auth_headers):
    """Scenario: A user can edit and save their display name, persisting it to database."""
    # Edit name
    update_res = client.patch(
        "/api/users/me",
        headers=auth_headers,
        json={"name": "Alex J. Mercer"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Alex J. Mercer"
    assert update_res.json()["fullName"] == "Alex J. Mercer"

    # Subsequent GET verifies persistence
    get_res = client.get("/api/users/me", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Alex J. Mercer"


def test_edit_profile_name_validation_empty_or_excessive(client, auth_headers):
    """Scenario: Empty name or name exceeding 60 characters is strictly rejected."""
    # Empty
    res_empty = client.patch("/api/users/me", headers=auth_headers, json={"name": "   "})
    assert res_empty.status_code == 400
    assert "cannot be empty" in res_empty.json()["detail"]

    # Excessive length
    res_long = client.patch("/api/users/me", headers=auth_headers, json={"name": "A" * 65})
    assert res_long.status_code == 400
    assert "cannot exceed 60 characters" in res_long.json()["detail"]


def test_avatar_upload_replace_and_removal(client, auth_headers):
    """Scenario: User can attach an avatar URL, replace it, and remove it to restore default."""
    # 1. Attach avatar
    cloudinary_url = "https://res.cloudinary.com/hb0sukix/image/upload/v1/its/avatar1.jpg"
    res1 = client.patch(
        "/api/users/me",
        headers=auth_headers,
        json={"avatar_url": cloudinary_url}
    )
    assert res1.status_code == 200
    assert res1.json()["avatarUrl"] == cloudinary_url

    # 2. Replace avatar
    new_url = "https://res.cloudinary.com/hb0sukix/image/upload/v2/its/avatar2.png"
    res2 = client.patch(
        "/api/users/me",
        headers=auth_headers,
        json={"avatar_url": new_url}
    )
    assert res2.status_code == 200
    assert res2.json()["avatarUrl"] == new_url

    # 3. Remove avatar
    res3 = client.patch(
        "/api/users/me",
        headers=auth_headers,
        json={"avatar_url": ""}
    )
    assert res3.status_code == 200
    assert res3.json()["avatarUrl"] is None


def test_settings_default_retrieval_and_persistence(client, auth_headers):
    """Scenario: Default settings are provided, can be modified, and persist across requests."""
    # Check defaults
    res_default = client.get("/api/users/me/settings", headers=auth_headers)
    assert res_default.status_code == 200
    defaults = res_default.json()
    assert defaults["notificationRadius"] == 2.0
    assert defaults["nearbyVerificationRequests"] is True
    assert defaults["locationSharingEnabled"] is False

    # Update settings
    update_payload = {
        "notificationRadius": 5.0,
        "nearbyVerificationRequests": False,
        "highSeverityAlerts": True,
        "categories": {
            "Accident": True,
            "Congestion": False,
            "Waterlogging": True
        },
        "locationSharingEnabled": True,
        "browserNotificationsEnabled": True
    }
    put_res = client.put("/api/users/me/settings", headers=auth_headers, json=update_payload)
    assert put_res.status_code == 200
    assert put_res.json()["status"] == "ok"
    assert put_res.json()["settings"]["notificationRadius"] == 5.0

    # Verify persistence via GET
    get_res = client.get("/api/users/me/settings", headers=auth_headers)
    assert get_res.status_code == 200
    saved = get_res.json()
    assert saved["notificationRadius"] == 5.0
    assert saved["nearbyVerificationRequests"] is False
    assert saved["categories"]["Congestion"] is False
    assert saved["categories"]["Accident"] is True
    assert saved["locationSharingEnabled"] is True


def test_settings_radius_validation_rejects_invalid_values(client, auth_headers):
    """Scenario: Invalid negative or extreme radius values are rejected with 400 Bad Request."""
    res_neg = client.put("/api/users/me/settings", headers=auth_headers, json={"notificationRadius": -1.0})
    assert res_neg.status_code == 400

    res_extreme = client.put("/api/users/me/settings", headers=auth_headers, json={"notificationRadius": 999.0})
    assert res_extreme.status_code == 400


def test_location_update_validates_coordinates(client, auth_headers):
    """Scenario: User location updates enforce standard GPS bounding limits (-90..90, -180..180)."""
    # Valid
    res_valid = client.post("/api/users/me/location", headers=auth_headers, json={"lat": 22.7196, "lng": 75.8577})
    assert res_valid.status_code == 200
    assert res_valid.json()["status"] == "ok"

    # Out of range latitude
    res_invalid_lat = client.post("/api/users/me/location", headers=auth_headers, json={"lat": 120.0, "lng": 75.0})
    assert res_invalid_lat.status_code == 400

    # Out of range longitude
    res_invalid_lng = client.post("/api/users/me/location", headers=auth_headers, json={"lat": 22.0, "lng": 200.0})
    assert res_invalid_lng.status_code == 400


def test_logout_session_invalidation(client, auth_headers, mock_db):
    """Scenario: Logout terminates the active session record in MongoDB and blocks subsequent authenticated requests."""
    # 1. Confirm session is active
    check_res = client.get("/api/auth/session", headers=auth_headers)
    assert check_res.status_code == 200
    assert check_res.json()["authenticated"] is True

    # 2. Invoke logout
    logout_res = client.post("/api/auth/logout", headers=auth_headers)
    assert logout_res.status_code == 200

    # 3. Confirm session record removed
    assert len(mock_db.sessions.docs) == 0

    # 4. Subsequent authenticated request with old token is rejected
    stale_res = client.get("/api/users/me", headers=auth_headers)
    assert stale_res.status_code == 401
    assert "session has ended" in stale_res.json()["detail"].lower()


def test_unauthenticated_access_is_strictly_rejected(client):
    """Scenario: Protected endpoints return 401 / 403 when accessed without credentials."""
    assert client.get("/api/users/me").status_code == 403
    assert client.patch("/api/users/me", json={"name": "Hacker"}).status_code == 403
    assert client.get("/api/users/me/settings").status_code == 403
    assert client.put("/api/users/me/settings", json={"notificationRadius": 5.0}).status_code == 403
    assert client.post("/api/users/me/location", json={"lat": 0, "lng": 0}).status_code == 403
