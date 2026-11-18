"""
Automated tests for Phase 4: Spatial Push Dispatcher in Incident Pipeline.
Validates spatial proximity filtering (Haversine corridor), self-report exclusion,
anti-spam frequency cooldown, and incident creation hook.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_db
from backend.services.push import (
    haversine_meters,
    dispatch_incident_push_notifications,
)


class InMemoryCursor:
    def __init__(self, items):
        self._items = items

    def limit(self, n):
        self._items = self._items[:n]
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

    def find(self, query=None):
        query = query or {}
        return InMemoryCursor([d.copy() for d in self.docs if self._matches_query(d, query)])

    async def find_one(self, query=None):
        query = query or {}
        for d in self.docs:
            if self._matches_query(d, query):
                return d.copy()
        return None

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
            self.docs.append(new_doc)
            return MagicMock(matched_count=0, modified_count=0, upserted_id="mock")
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


class MockPushDB:
    def __init__(self):
        self.push_subscriptions = InMemoryCollection()
        self.incidents = InMemoryCollection()
        self.verifications = InMemoryCollection()
        self.users = InMemoryCollection()
        self.sessions = InMemoryCollection()


@pytest.fixture
def mock_db():
    db = MockPushDB()
    app.dependency_overrides[get_db] = lambda: db
    yield db
    app.dependency_overrides.clear()


def test_spatial_dispatcher_only_alerts_nearby_subscribers():
    """Verify that subscriber at 250m receives alert while subscriber at 5km is excluded."""
    import asyncio
    db = MockPushDB()

    # Subscriber 1: 250m away from incident (lat 22.3026, lng 73.2061)
    db.push_subscriptions.docs.append({
        "endpoint": "https://fcm.googleapis.com/fcm/send/sub-nearby",
        "keys": {"p256dh": "k1", "auth": "a1"},
        "lat": 22.3048,
        "lng": 73.2061,
        "radius": 2.0,
        "user_id": "usr-nearby",
    })

    # Subscriber 2: 5.5km away
    db.push_subscriptions.docs.append({
        "endpoint": "https://fcm.googleapis.com/fcm/send/sub-far",
        "keys": {"p256dh": "k2", "auth": "a2"},
        "lat": 22.3500,
        "lng": 73.2500,
        "radius": 2.0,
        "user_id": "usr-far",
    })

    incident = {
        "id": "inc-spat-1",
        "category": "Accident",
        "lat": 22.3026,
        "lng": 73.2061,
        "location": "Alkapuri Main Rd",
        "severity": "High",
    }

    with patch("backend.services.push.send_web_push") as mock_send:
        mock_send.return_value = {"success": True, "status_code": 201}

        sent_count = asyncio.run(dispatch_incident_push_notifications(db, incident))

        # Only 1 nearby subscriber should have received the notification
        assert sent_count == 1
        assert mock_send.call_count == 1

        call_args = mock_send.call_args[0]
        sub_info, payload = call_args
        assert sub_info["endpoint"] == "https://fcm.googleapis.com/fcm/send/sub-nearby"
        assert "Accident" in payload["title"]
        assert "Alkapuri" in payload["body"]


def test_spatial_dispatcher_excludes_reporter():
    """Verify the reporting user does not get spammed with an alert for their own report."""
    import asyncio
    db = MockPushDB()

    reporter_user_id = "usr-reporting-commuter"

    # Subscriber is right at the incident location, but is the reporter
    db.push_subscriptions.docs.append({
        "endpoint": "https://fcm.googleapis.com/fcm/send/sub-reporter",
        "keys": {"p256dh": "k", "auth": "a"},
        "lat": 22.3026,
        "lng": 73.2061,
        "radius": 2.0,
        "user_id": reporter_user_id,
    })

    incident = {
        "id": "inc-spat-2",
        "category": "Waterlogging",
        "lat": 22.3026,
        "lng": 73.2061,
        "severity": "Critical",
    }

    with patch("backend.services.push.send_web_push") as mock_send:
        mock_send.return_value = {"success": True, "status_code": 201}

        sent_count = asyncio.run(dispatch_incident_push_notifications(
            db, incident, exclude_user_id=reporter_user_id
        ))

        assert sent_count == 0
        mock_send.assert_not_called()


def test_spatial_dispatcher_anti_spam_frequency_cap():
    """Verify that a device pushed within the last 5 minutes is protected from duplicate alerts."""
    import asyncio
    db = MockPushDB()

    # Subscriber was pushed 2 minutes ago
    db.push_subscriptions.docs.append({
        "endpoint": "https://fcm.googleapis.com/fcm/send/sub-debounced",
        "keys": {"p256dh": "k", "auth": "a"},
        "lat": 22.3030,
        "lng": 73.2061,
        "radius": 2.0,
        "last_pushed_at": datetime.now(timezone.utc) - timedelta(minutes=2),
    })

    incident = {
        "id": "inc-spat-3",
        "category": "Road Blockage",
        "lat": 22.3026,
        "lng": 73.2061,
        "severity": "High",
    }

    with patch("backend.services.push.send_web_push") as mock_send:
        sent_count = asyncio.run(dispatch_incident_push_notifications(db, incident))

        # Should be debounced
        assert sent_count == 0
        mock_send.assert_not_called()


def test_haversine_meters_accuracy():
    """Verify spatial calculation between known Indian landmark coordinates."""
    # Distance between Sayaji Baug (22.3129, 73.1906) and Vadodara Railway Station (22.3106, 73.1812)
    dist = haversine_meters(22.3129, 73.1906, 22.3106, 73.1812)
    assert 900.0 <= dist <= 1100.0  # Approx ~1km
