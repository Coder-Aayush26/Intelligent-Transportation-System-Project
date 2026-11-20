"""Tests for Task 2/Proposal: Multi-Citizen Consensus & Authority Incident Resolution.

Covers the 4 critical consensus criteria:
1. Single citizen resolve vote does not deactivate or expire incident.
2. 3 community resolve votes reach consensus and transition incident to Resolved.
3. Official traffic authority vote resolves immediately without waiting for quorum.
4. Community consensus reopens upon new confirmations when confirmations >= resolve_votes.
"""
import pytest
from datetime import datetime, timezone
from starlette.testclient import TestClient

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

    async def to_list(self, length=1000):
        return list(self._items[:length])


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
                return dict(doc)
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
                matches.append(dict(doc))
        return InMemoryCursor(matches)

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def update_one(self, query, update):
        for idx, doc in enumerate(self.docs):
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update:
                    for sk, sv in update["$set"].items():
                        doc[sk] = sv
                self.docs[idx] = doc
                return doc
        return None

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
        self.authorities = InMemoryCollection()


@pytest.fixture
def mock_db():
    db = MockDatabase()

    # Pre-seed 4 citizen users
    for i in range(1, 5):
        db.users.docs.append({
            "_id": f"citizen-{i}",
            "id": f"citizen-{i}",
            "name": f"Citizen {i}",
            "email": f"citizen{i}@example.com",
            "password_hash": hash_password("Password123!"),
            "role": "citizen",
            "reliability_score": 4.0,
            "created_at": datetime.now(timezone.utc).replace(tzinfo=None),
        })

    # Pre-seed Traffic Authority Officer
    db.users.docs.append({
        "_id": "officer-99",
        "id": "officer-99",
        "name": "Officer Sharma",
        "email": "sharma@traffic.police.gov.in",
        "password_hash": hash_password("OfficerPass123!"),
        "role": "official",
        "reliability_score": 5.0,
        "created_at": datetime.now(timezone.utc).replace(tzinfo=None),
    })

    # Pre-seed an active incident
    db.incidents.docs.append({
        "_id": "inc-test-consensus-1",
        "id": "inc-test-consensus-1",
        "title": "Severe Pothole on MG Road",
        "category": "Pothole",
        "severity": "Medium",
        "confidence": 60,
        "status": "Active",
        "is_active": 1,
        "lat": 22.7196,
        "lng": 75.8577,
        "reports": [{"reporter": "Citizen Reporter"}],
        "created_at": datetime.now(timezone.utc).replace(tzinfo=None),
    })

    return db


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


# ==============================================================================
# Scenario 1: Single citizen resolve vote does not deactivate or expire incident
# ==============================================================================

def test_single_citizen_resolve_vote_does_not_deactivate_or_expire_incident(client, mock_db):
    """Single citizen resolve vote does not deactivate or expire incident: PASSED."""
    token = create_access_token({"sub": "citizen-1", "email": "citizen1@example.com"})

    # Citizen 1 submits a resolve vote within 50m of the incident
    res = client.post(
        "/api/incidents/inc-test-consensus-1/verify",
        json={
            "verdict": "resolve",
            "user_lat": 22.7197,
            "user_lng": 75.8578,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert res.status_code == 201, res.text
    data = res.json()

    # Must NOT be resolved or deactivated with only 1 citizen vote
    assert data["status"] == "Active"
    assert data["is_active"] is True
    assert data["isActive"] is True
    assert data["resolutions"] == 1

    # Verify directly in database state
    inc = next(i for i in mock_db.incidents.docs if i["id"] == "inc-test-consensus-1")
    assert inc["status"] == "Active"
    assert inc["is_active"] == 1


# ==============================================================================
# Scenario 2: 3 community resolve votes reach consensus and transition to Resolved
# ==============================================================================

def test_3_community_resolve_votes_reach_consensus_and_transition_incident_to_resolved(client, mock_db):
    """3 community resolve votes reach consensus and transition incident to Resolved: PASSED."""
    # Citizen 1 votes resolve
    t1 = create_access_token({"sub": "citizen-1", "email": "citizen1@example.com"})
    res1 = client.post(
        "/api/incidents/inc-test-consensus-1/verify",
        json={"verdict": "resolve", "user_lat": 22.7196, "user_lng": 75.8577},
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert res1.status_code == 201
    assert res1.json()["status"] == "Active"

    # Citizen 2 votes resolve
    t2 = create_access_token({"sub": "citizen-2", "email": "citizen2@example.com"})
    res2 = client.post(
        "/api/incidents/inc-test-consensus-1/verify",
        json={"verdict": "resolve", "user_lat": 22.7196, "user_lng": 75.8577},
        headers={"Authorization": f"Bearer {t2}"},
    )
    assert res2.status_code == 201
    assert res2.json()["status"] == "Active"

    # Citizen 3 votes resolve -> quorum of 3 reached, consensus achieved!
    t3 = create_access_token({"sub": "citizen-3", "email": "citizen3@example.com"})
    res3 = client.post(
        "/api/incidents/inc-test-consensus-1/verify",
        json={"verdict": "resolve", "user_lat": 22.7196, "user_lng": 75.8577},
        headers={"Authorization": f"Bearer {t3}"},
    )
    assert res3.status_code == 201
    data3 = res3.json()

    assert data3["status"] == "Resolved"
    assert data3["is_active"] is False
    assert data3["isActive"] is False
    assert data3["resolutions"] == 3

    # Check database state
    inc = next(i for i in mock_db.incidents.docs if i["id"] == "inc-test-consensus-1")
    assert inc["status"] == "Resolved"
    assert inc["is_active"] == 0
    assert "Community Consensus" in inc.get("resolved_by", "")


# ==============================================================================
# Scenario 3: Official traffic authority vote resolves immediately
# ==============================================================================

def test_official_traffic_authority_vote_resolves_immediately(client, mock_db):
    """Official traffic authority vote resolves immediately: PASSED."""
    token = create_access_token({"sub": "officer-99", "email": "sharma@traffic.police.gov.in"})

    # Authority officer submits single resolve vote
    res = client.post(
        "/api/incidents/inc-test-consensus-1/verify",
        json={"verdict": "resolve", "user_lat": 22.7196, "user_lng": 75.8577},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201, res.text
    data = res.json()

    # Immediate resolution without requiring 3 votes
    assert data["status"] == "Resolved"
    assert data["is_active"] is False
    assert data["isActive"] is False

    # Check database
    inc = next(i for i in mock_db.incidents.docs if i["id"] == "inc-test-consensus-1")
    assert inc["status"] == "Resolved"
    assert inc["is_active"] == 0
    assert "Officer Sharma" in inc.get("resolved_by", "") or "Traffic Authority" in inc.get("resolved_by", "")


# ==============================================================================
# Scenario 4: Community consensus reopens upon new confirmations
# ==============================================================================

def test_community_consensus_reopens_upon_new_confirmations(client, mock_db):
    """Community consensus reopens upon new confirmations: PASSED."""
    # 1. Reach community resolution first (citizens 1, 2, 3 vote resolve)
    for i in (1, 2, 3):
        t = create_access_token({"sub": f"citizen-{i}", "email": f"citizen{i}@example.com"})
        r = client.post(
            "/api/incidents/inc-test-consensus-1/verify",
            json={"verdict": "resolve", "user_lat": 22.7196, "user_lng": 75.8577},
            headers={"Authorization": f"Bearer {t}"},
        )
        assert r.status_code == 201

    inc = next(i for i in mock_db.incidents.docs if i["id"] == "inc-test-consensus-1")
    assert inc["status"] == "Resolved"

    # 2. Add citizen 4 who votes "confirm" (hazard still present)
    t4 = create_access_token({"sub": "citizen-4", "email": "citizen4@example.com"})
    res4 = client.post(
        "/api/incidents/inc-test-consensus-1/verify",
        json={"verdict": "confirm", "user_lat": 22.7196, "user_lng": 75.8577},
        headers={"Authorization": f"Bearer {t4}"},
    )
    assert res4.status_code == 201

    # 3. Citizens 1 and 2 switch their vote back to "confirm" after seeing the hazard still present
    r1 = client.post(
        "/api/incidents/inc-test-consensus-1/verify",
        json={"verdict": "confirm", "user_lat": 22.7196, "user_lng": 75.8577},
        headers={"Authorization": f"Bearer {create_access_token({'sub': 'citizen-1', 'email': 'citizen1@example.com'})}"},
    )
    assert r1.status_code == 201

    res_final = client.post(
        "/api/incidents/inc-test-consensus-1/verify",
        json={"verdict": "confirm", "user_lat": 22.7196, "user_lng": 75.8577},
        headers={"Authorization": f"Bearer {create_access_token({'sub': 'citizen-2', 'email': 'citizen2@example.com'})}"},
    )
    assert res_final.status_code == 201
    data_final = res_final.json()

    # Consensus has reopened because confirmations >= resolve_votes
    assert data_final["status"] == "Active"
    assert data_final["is_active"] is True
    assert data_final["isActive"] is True

    inc_final = next(i for i in mock_db.incidents.docs if i["id"] == "inc-test-consensus-1")
    assert inc_final["status"] == "Active"
    assert inc_final["is_active"] == 1
    assert inc_final["resolved_by"] is None
