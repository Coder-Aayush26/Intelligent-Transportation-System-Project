"""
Tests for Phase 1: Web Push Notifications Infrastructure
Validates VAPID public key retrieval, push subscription upsert, input validation,
unsubscription, lockscreen payload generation, test push dispatch, and expired subscription pruning.
"""
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_db
from backend.services.push import (
    get_vapid_public_key,
    format_incident_push_payload,
)


class InMemoryCursor:
    def __init__(self, items):
        self._items = items

    def limit(self, n):
        self._items = self._items[:n]
        return self

    def sort(self, key_or_list, direction=1):
        if isinstance(key_or_list, list):
            key, direction = key_or_list[0]
        else:
            key = key_or_list
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
                if not any(self._matches_query(doc, cond) for cond in v):
                    return False
            elif isinstance(v, dict):
                field_val = doc.get(k)
                for op, op_val in v.items():
                    if op == "$in" and field_val not in op_val:
                        return False
                    elif op == "$ne" and field_val == op_val:
                        return False
            elif doc.get(k) != v:
                return False
        return True

    async def find_one(self, query=None, sort=None):
        query = query or {}
        matches = [d.copy() for d in self.docs if self._matches_query(d, query)]
        if sort and matches:
            key, direction = sort[0]
            matches = sorted(
                matches,
                key=lambda x: x.get(key, datetime.min) if x.get(key) is not None else datetime.min,
                reverse=(direction == -1),
            )
        return matches[0] if matches else None

    def find(self, query=None):
        query = query or {}
        matches = [doc.copy() for doc in self.docs if self._matches_query(doc, query)]
        return InMemoryCursor(matches)

    async def insert_one(self, doc):
        self.docs.append(doc.copy())

    async def update_one(self, query, update, upsert=False):
        for i, doc in enumerate(self.docs):
            if self._matches_query(doc, query):
                if "$set" in update:
                    self.docs[i].update(update["$set"])
                return MagicMock(matched_count=1, modified_count=1)
        if upsert:
            new_doc = query.copy()
            if "$set" in update:
                new_doc.update(update["$set"])
            if "$setOnInsert" in update:
                new_doc.update(update["$setOnInsert"])
            self.docs.append(new_doc)
            return MagicMock(matched_count=0, modified_count=0, upserted_id="mock_id")
        return MagicMock(matched_count=0, modified_count=0)

    async def delete_one(self, query):
        for i, doc in enumerate(self.docs):
            if self._matches_query(doc, query):
                self.docs.pop(i)
                return MagicMock(deleted_count=1)
        return MagicMock(deleted_count=0)

    async def count_documents(self, query):
        cursor = self.find(query)
        res = await cursor.to_list(1000)
        return len(res)


class MockPushDatabase:
    def __init__(self):
        self.incidents = InMemoryCollection()
        self.verifications = InMemoryCollection()
        self.users = InMemoryCollection()
        self.sessions = InMemoryCollection()
        self.push_subscriptions = InMemoryCollection()


@pytest.fixture
def mock_db():
    db = MockPushDatabase()
    app.dependency_overrides[get_db] = lambda: db
    yield db
    app.dependency_overrides.clear()


@pytest.fixture
def client(mock_db):
    return TestClient(app)


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

def test_get_vapid_public_key_endpoints(client):
    """Confirm VAPID public key is returned on both root and /api prefixes."""
    res1 = client.get("/notifications/vapid-public-key")
    assert res1.status_code == 200
    data1 = res1.json()
    assert "public_key" in data1
    assert len(data1["public_key"]) >= 80

    res2 = client.get("/api/notifications/vapid-public-key")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["public_key"] == data1["public_key"]


def test_push_subscription_creation_and_upsert(client, mock_db):
    """Register a new push subscription and verify idempotent coordinate updates."""
    payload = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/sample-token-12345",
        "keys": {
            "p256dh": "BNcRdreALRFXTkOOUHK18m2PtOBoS_UCQARXvqGuqpqg",
            "auth": "t4F2_sample_auth_key",
        },
        "lat": 22.3026,
        "lng": 73.2061,
        "radius": 2.5,
    }

    res = client.post("/notifications/subscribe", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "subscribed"
    assert data["endpoint"] == payload["endpoint"]

    # Verify document exists in mock DB
    assert len(mock_db.push_subscriptions.docs) == 1
    saved = mock_db.push_subscriptions.docs[0]
    assert saved["lat"] == 22.3026
    assert saved["lng"] == 73.2061
    assert saved["radius"] == 2.5
    assert saved["keys"]["auth"] == "t4F2_sample_auth_key"

    # Upsert with new coordinates (simulating user movement)
    payload["lat"] = 22.3150
    payload["lng"] = 73.2180
    res_update = client.post("/api/notifications/subscribe", json=payload)
    assert res_update.status_code == 200

    # Ensure no duplicate subscription document was created
    assert len(mock_db.push_subscriptions.docs) == 1
    assert mock_db.push_subscriptions.docs[0]["lat"] == 22.3150


def test_push_subscription_payload_validation(client):
    """Ensure invalid or incomplete subscription payloads return HTTP 422."""
    # Missing keys object
    invalid_payload = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/invalid",
    }
    res = client.post("/notifications/subscribe", json=invalid_payload)
    assert res.status_code == 422

    # Missing endpoint
    invalid_payload2 = {
        "keys": {"p256dh": "foo", "auth": "bar"},
    }
    res2 = client.post("/notifications/subscribe", json=invalid_payload2)
    assert res2.status_code == 422


def test_unsubscribe_endpoint_lifecycle(client, mock_db):
    """Verify unsubscribe deletes the subscription and handles missing endpoints cleanly."""
    endpoint = "https://fcm.googleapis.com/fcm/send/device-to-remove"
    mock_db.push_subscriptions.docs.append({
        "endpoint": endpoint,
        "keys": {"p256dh": "k", "auth": "a"},
    })
    assert len(mock_db.push_subscriptions.docs) == 1

    # Unsubscribe existing endpoint
    res = client.delete(f"/notifications/unsubscribe?endpoint={endpoint}")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "unsubscribed"
    assert data["deleted"] is True
    assert len(mock_db.push_subscriptions.docs) == 0

    # Repeat unsubscribe on non-existent endpoint
    res2 = client.delete(f"/api/notifications/unsubscribe?endpoint={endpoint}")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["deleted"] is False


def test_format_incident_push_payload_contract():
    """Verify push payload includes lockscreen actions, vibration, and deep-link data."""
    sample_incident = {
        "id": "inc-4455",
        "category": "Waterlogging",
        "location": "Near Central Flyover",
        "severity": "Critical",
    }
    payload = format_incident_push_payload(sample_incident, distance_meters=350)

    assert "Waterlogging" in payload["title"]
    assert "350m" in payload["title"]
    assert "Critical" in payload["body"]
    assert payload["data"]["incidentId"] == "inc-4455"
    assert payload["data"]["url"] == "/app/incidents/inc-4455"

    # Verify lockscreen action buttons exist
    action_types = [a["action"] for a in payload["actions"]]
    assert "confirm" in action_types
    assert "view" in action_types
    assert len(payload["vibrate"]) >= 3


@patch("backend.routers.notifications.send_web_push")
def test_send_test_push_dispatch_success(mock_send, client, mock_db):
    """Test dispatching test push notification when subscription exists."""
    mock_send.return_value = {"success": True, "status_code": 201}

    endpoint = "https://fcm.googleapis.com/fcm/send/active-test-sub"
    mock_db.push_subscriptions.docs.append({
        "endpoint": endpoint,
        "keys": {"p256dh": "test_p256dh", "auth": "test_auth"},
        "last_active": datetime.now(timezone.utc),
    })

    res = client.post("/notifications/test", json={"endpoint": endpoint})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "dispatched"
    assert data["count"] == 1
    assert data["results"][0]["result"]["success"] is True
    mock_send.assert_called_once()


@patch("backend.routers.notifications.send_web_push")
def test_send_test_push_prunes_expired_subscriptions(mock_send, client, mock_db):
    """Test that subscriptions returning HTTP 410 or 404 (Gone) are automatically deleted from database."""
    # Simulate push service reporting expired subscription
    mock_send.return_value = {
        "success": False,
        "status_code": 410,
        "is_expired": True,
        "error": "Subscription has expired or is no longer valid",
    }

    endpoint = "https://fcm.googleapis.com/fcm/send/expired-sub"
    mock_db.push_subscriptions.docs.append({
        "endpoint": endpoint,
        "keys": {"p256dh": "expired", "auth": "expired"},
        "last_active": datetime.now(timezone.utc),
    })
    assert len(mock_db.push_subscriptions.docs) == 1

    res = client.post("/notifications/test", json={"endpoint": endpoint})
    assert res.status_code == 200

    # Ensure expired subscription was pruned from MongoDB
    assert len(mock_db.push_subscriptions.docs) == 0


def test_send_test_push_404_when_no_subscriptions(client, mock_db):
    """Ensure HTTP 404 is returned if test push is triggered with no registered devices."""
    res = client.post("/notifications/test", json={})
    assert res.status_code == 404
    assert "No active push subscriptions found" in res.json()["detail"]

