"""
Automated tests for Phase 2 & 3: Service Worker (public/sw.js) & Frontend Push Subscription Contracts.
Validates service worker event bindings, action button payloads, base64url conversion, and subscription lifecycle.
"""
import os
import re
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_db


def test_service_worker_file_exists_and_binds_events():
    """Verify that public/sw.js exists, contains valid event listeners, and defines action buttons."""
    root_dir = Path(__file__).resolve().parent.parent
    sw_file = root_dir / "public" / "sw.js"
    assert sw_file.exists(), "public/sw.js must exist for browser service worker registration"

    content = sw_file.read_text(encoding="utf-8")

    # Verify key Service Worker lifecycle and push listeners
    assert "addEventListener('install'" in content or 'addEventListener("install"' in content
    assert "addEventListener('activate'" in content or 'addEventListener("activate"' in content
    assert "addEventListener('push'" in content or 'addEventListener("push"' in content
    assert "addEventListener('notificationclick'" in content or 'addEventListener("notificationclick"' in content

    # Verify notification action buttons exist
    assert "confirm" in content, "Must handle 'confirm' lockscreen quick-vote action"
    assert "view" in content, "Must handle 'view' map navigation action"
    assert "showNotification" in content
    assert "requireInteraction: true" in content


def test_service_worker_built_to_dist_root():
    """Verify Vite production build copies sw.js to dist/sw.js for root-level scoping."""
    root_dir = Path(__file__).resolve().parent.parent
    dist_sw = root_dir / "dist" / "sw.js"
    if dist_sw.exists():
        content = dist_sw.read_text(encoding="utf-8")
        assert "addEventListener('push'" in content or 'addEventListener("push"' in content


def test_frontend_push_service_file_exists_and_exports_helpers():
    """Verify src/services/pushNotification.js defines essential subscription functions."""
    root_dir = Path(__file__).resolve().parent.parent
    push_service = root_dir / "src" / "services" / "pushNotification.js"
    assert push_service.exists(), "pushNotification.js must exist"

    content = push_service.read_text(encoding="utf-8")
    assert "isPushNotificationSupported" in content
    assert "urlBase64ToUint8Array" in content
    assert "registerServiceWorker" in content
    assert "subscribeToPushNotifications" in content
    assert "unsubscribeFromPushNotifications" in content
    assert "sendTestPushAlert" in content


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
            if doc.get(k) != v:
                return False
        return True

    async def find_one(self, query=None):
        query = query or {}
        for d in self.docs:
            if self._matches_query(d, query):
                return d.copy()
        return None

    def find(self, query=None):
        query = query or {}
        return InMemoryCursor([d.copy() for d in self.docs if self._matches_query(d, query)])

    async def update_one(self, query, update, upsert=False):
        for i, doc in enumerate(self.docs):
            if self._matches_query(doc, query):
                if "$set" in update:
                    self.docs[i].update(update["$set"])
                return
        if upsert:
            new_doc = query.copy()
            if "$set" in update:
                new_doc.update(update["$set"])
            if "$setOnInsert" in update:
                new_doc.update(update["$setOnInsert"])
            self.docs.append(new_doc)

    async def delete_one(self, query):
        from unittest.mock import MagicMock
        for i, doc in enumerate(self.docs):
            if self._matches_query(doc, query):
                self.docs.pop(i)
                return MagicMock(deleted_count=1)
        return MagicMock(deleted_count=0)


class MockPushDatabase:
    def __init__(self):
        self.push_subscriptions = InMemoryCollection()
        self.users = InMemoryCollection()
        self.incidents = InMemoryCollection()
        self.verifications = InMemoryCollection()


def test_push_subscription_flow_end_to_end_from_frontend_contract():
    """Verify the exact payload structure sent by frontend subscribeToPushNotifications is accepted by backend."""
    mock_db = MockPushDatabase()
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        client = TestClient(app)

        # 1. Fetch VAPID key
        res_key = client.get("/api/notifications/vapid-public-key")
        assert res_key.status_code == 200
        vapid_key = res_key.json()["public_key"]
        assert len(vapid_key) >= 80

        # 2. Frontend subscribe payload
        frontend_payload = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/browser-device-token-xyz",
            "keys": {
                "p256dh": "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZ_WJJzc5qhm3T9ZPnRNxDOb8qOEFFTL6POKa5w",
                "auth": "5Jrw7A5VDxW_N8vA3eTkgA",
            },
            "lat": 22.3026,
            "lng": 73.2061,
            "radius": 2.0,
        }

        res_sub = client.post("/api/notifications/subscribe", json=frontend_payload)
        assert res_sub.status_code == 200
        data = res_sub.json()
        assert data["status"] == "subscribed"
        assert data["endpoint"] == frontend_payload["endpoint"]
        assert len(mock_db.push_subscriptions.docs) == 1

        # 3. Frontend unsubscribe payload
        res_unsub = client.delete(f"/api/notifications/unsubscribe?endpoint={frontend_payload['endpoint']}")
        assert res_unsub.status_code == 200
        assert res_unsub.json()["status"] == "unsubscribed"
        assert len(mock_db.push_subscriptions.docs) == 0
    finally:
        app.dependency_overrides.clear()
