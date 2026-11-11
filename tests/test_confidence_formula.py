"""Unit and integration tests for Task 1: Comprehensive Confidence Score Formula."""
from datetime import datetime, timedelta, timezone
import pytest
from starlette.testclient import TestClient

from backend.main import app
from backend.database import get_db
from backend.services.confidence import (
    compute_total_confidence,
    calculate_frequency_factor,
    calculate_temporal_decay,
    calculate_voter_adjustment,
    STATIC_ROAD_RATING,
)


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
# Pure Unit Tests for Formula Functions
# ==========================================

def test_media_weight_and_redistribution():
    """Verify w1=0.40 applies when media is evaluated, and redistributes when absent."""
    # With verified media (score 1.0), N=1, user=3.0, RR=0.70
    conf_with_verified_media = compute_total_confidence(
        media_score=1.0,
        media_urls=["https://example.com/img.jpg"],
        report_count=1,
        reporter_reliability=3.0,
    )
    # With fake media (score 0.0), N=1, user=3.0, RR=0.70
    conf_with_fake_media = compute_total_confidence(
        media_score=0.0,
        media_urls=["https://example.com/fake.jpg"],
        report_count=1,
        reporter_reliability=3.0,
    )
    # With no media attached at all
    conf_no_media = compute_total_confidence(
        media_score=None,
        media_urls=[],
        report_count=1,
        reporter_reliability=3.0,
    )

    # Fake media must score significantly lower than no media because fake media was uploaded
    assert conf_with_fake_media < conf_no_media
    # Verified media must score higher than no media
    assert conf_with_verified_media > conf_no_media
    # No media baseline for N=1, 3.0 reliability, 0.70 road rating = 50%
    assert conf_no_media == 50


def test_frequency_factor_monotonic_increase():
    """Frequency F must increase with corroborating independent reports."""
    f1 = calculate_frequency_factor(1)
    f2 = calculate_frequency_factor(2)
    f3 = calculate_frequency_factor(3)
    f5 = calculate_frequency_factor(5)

    assert 0.35 <= f1 <= 0.45
    assert f1 < f2 < f3 < f5
    assert f5 <= 1.0

    # Test confidence score reflects frequency
    score_1 = compute_total_confidence(report_count=1, reporter_reliability=3.0)
    score_2 = compute_total_confidence(report_count=2, reporter_reliability=3.0)
    score_4 = compute_total_confidence(report_count=4, reporter_reliability=3.0)

    assert score_1 < score_2 < score_4


def test_user_reliability_impact():
    """Higher user reliability must increase confidence; low reliability decreases it."""
    score_untrusted = compute_total_confidence(report_count=1, reporter_reliability=1.0)
    score_standard = compute_total_confidence(report_count=1, reporter_reliability=3.0)
    score_trusted = compute_total_confidence(report_count=1, reporter_reliability=5.0)

    assert score_untrusted < score_standard < score_trusted


def test_static_road_rating_baseline():
    """Road rating baseline is static (0.70) and contributes static contextual weight."""
    assert STATIC_ROAD_RATING == 0.70
    score_default_rr = compute_total_confidence(report_count=1, reporter_reliability=3.0)
    # Explicitly passing STATIC_ROAD_RATING yields identical score
    score_explicit_rr = compute_total_confidence(
        report_count=1,
        reporter_reliability=3.0,
        road_rating=STATIC_ROAD_RATING,
    )
    assert score_default_rr == score_explicit_rr


def test_temporal_decay_categories_and_freshness():
    """Temporal decay reduces confidence as time passes, tailored by incident category."""
    now = datetime(2026, 11, 8, 12, 0, 0)
    one_hour_ago = now - timedelta(hours=1)
    three_hours_ago = now - timedelta(hours=3)
    ten_hours_ago = now - timedelta(hours=10)

    # Accident has 3-hour half-life: at 3 hours, decay is ~0.50
    decay_fresh = calculate_temporal_decay("Accident", now, current_time=now)
    decay_1h = calculate_temporal_decay("Accident", one_hour_ago, current_time=now)
    decay_3h = calculate_temporal_decay("Accident", three_hours_ago, current_time=now)
    decay_10h = calculate_temporal_decay("Accident", ten_hours_ago, current_time=now)

    assert decay_fresh == 1.0
    assert 0.75 < decay_1h < 0.85
    assert 0.48 < decay_3h < 0.52
    assert decay_10h < decay_3h

    # Traffic jam has 1.5-hour half life, so decays faster than Accident
    decay_jam_3h = calculate_temporal_decay("Traffic Jam", three_hours_ago, current_time=now)
    assert decay_jam_3h < decay_3h

    # Overall confidence decaying over time
    score_fresh = compute_total_confidence(
        category="Accident",
        reported_at=now,
        current_time=now,
        report_count=1,
    )
    score_stale = compute_total_confidence(
        category="Accident",
        reported_at=three_hours_ago,
        current_time=now,
        report_count=1,
    )
    assert score_stale < score_fresh


def test_temporal_decay_refreshes_on_latest_activity():
    """A fresh confirmation vote resets the reference activity time, preserving confidence."""
    now = datetime(2026, 11, 8, 12, 0, 0)
    reported_time = now - timedelta(hours=5)
    recent_confirm_time = now - timedelta(minutes=5)

    verif_fresh = [
        {"verdict": "confirm", "voter_reliability": 4.0, "created_at": recent_confirm_time}
    ]

    score_without_fresh_verif = compute_total_confidence(
        category="Accident",
        reported_at=reported_time,
        current_time=now,
        verif_list=[],
    )
    score_with_fresh_verif = compute_total_confidence(
        category="Accident",
        reported_at=reported_time,
        current_time=now,
        verif_list=verif_fresh,
    )

    # Score with fresh confirmation is much higher because decay is reset and confirm adds credibility
    assert score_with_fresh_verif > score_without_fresh_verif


def test_voter_reliability_adjustment():
    """Confirmations boost confidence, contradictions decrease it; higher reliability voter has more impact."""
    verif_high_confirm = [{"verdict": "confirm", "voter_reliability": 5.0}]
    verif_low_confirm = [{"verdict": "confirm", "voter_reliability": 1.5}]
    verif_high_contradict = [{"verdict": "contradict", "voter_reliability": 5.0}]

    adj_high_c = calculate_voter_adjustment(verif_high_confirm)
    adj_low_c = calculate_voter_adjustment(verif_low_confirm)
    adj_high_x = calculate_voter_adjustment(verif_high_contradict)

    assert adj_high_c > adj_low_c > 0
    assert adj_high_x < 0

    score_base = compute_total_confidence(verif_list=[])
    score_confirmed = compute_total_confidence(verif_list=verif_high_confirm)
    score_contradicted = compute_total_confidence(verif_list=verif_high_contradict)

    assert score_confirmed > score_base > score_contradicted


def test_clamping_bounds():
    """Confidence score must remain strictly clamped within [5, 99]."""
    # Massive contradiction overload
    huge_contradictions = [{"verdict": "contradict", "voter_reliability": 5.0} for _ in range(20)]
    low_score = compute_total_confidence(verif_list=huge_contradictions)
    assert low_score == 5

    # Massive confirmation overload
    huge_confirmations = [{"verdict": "confirm", "voter_reliability": 5.0} for _ in range(20)]
    high_score = compute_total_confidence(
        media_score=1.0,
        media_urls=["https://example.com/pic.jpg"],
        report_count=5,
        reporter_reliability=5.0,
        verif_list=huge_confirmations,
    )
    assert high_score == 99


# ==========================================
# API Integration Tests
# ==========================================

def test_api_create_and_fetch_incident_with_confidence_formula():
    """Test full API lifecycle: create incident, verify confidence, vote and observe updated confidence."""
    mock_db = MockDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app)

    try:
        # Create incident
        payload = {
            "category": "Accident",
            "severity": "High",
            "description": "Two car collision on highway",
            "location": "Bypass Junction",
            "full_location": "Bypass Junction, Indore",
            "lat": 22.75,
            "lng": 75.89,
            "source": "Web App",
            "media_urls": [],
        }

        res = client.post("/incidents", json=payload)
        assert res.status_code == 201
        data = res.json()
        inc_id = data["id"]
        # Baseline no-media single report = 50%
        assert data["confidence"] == 50
        assert data["avgReliability"] == 3.0

        # Submit a community confirmation vote
        v_res = client.post(f"/incidents/{inc_id}/verify", json={"verdict": "confirm"})
        assert v_res.status_code == 201

        # Fetch incident again - confidence should have increased due to confirmation
        get_res = client.get(f"/incidents/{inc_id}")
        assert get_res.status_code == 200
        updated = get_res.json()
        assert updated["confidence"] > 50
        assert updated["verifications"] == 1
        assert updated["nearbyVerifications"] == 1

        # Submit contradiction vote
        client.post(f"/incidents/{inc_id}/verify", json={"verdict": "contradict"})
        get_res2 = client.get(f"/incidents/{inc_id}")
        updated2 = get_res2.json()
        # Contradiction carries higher penalty (-8% vs +5%), net confidence drops
        assert updated2["confidence"] < updated["confidence"]
        assert updated2["contradictions"] == 1

    finally:
        app.dependency_overrides.clear()

