"""Seed script — populates the database with the same mock data that
lives in src/data/mockData.js so the frontend shows real data immediately.

Called automatically by main.py on startup if the DB is empty.
Run directly:  python -m backend.seed
"""
from datetime import datetime, timedelta

from .database import SessionLocal, engine
from .models import Base, Incident, User, Verification


SEED_INCIDENTS = [
    {
        "id": "inc-1",
        "category": "Accident",
        "location": "Ring Road, Near City Mall",
        "full_location": "Ring Road, Near City Mall, Indore",
        "lat": 22.7196,
        "lng": 75.8577,
        "severity": "High",
        "confidence": 92,
        "reporter": "Aayush",
        "description": "Two vehicles collided near the City Mall. Heavy traffic on the route.",
        "source": "Mobile App",
        "media_count": 2,
        "ai_assessment": "Likely Real",
        "map_position_top": "22%",
        "map_position_left": "26%",
        "minutes_ago": 2,
        "confirmations": 5,
        "contradictions": 0,
    },
    {
        "id": "inc-2",
        "category": "Waterlogging",
        "location": "MG Road, Sector 12",
        "full_location": "MG Road, Sector 12, Indore",
        "lat": 22.7241,
        "lng": 75.8648,
        "severity": "Medium",
        "confidence": 78,
        "reporter": "Priya_M",
        "description": "Standing water covering half the road after heavy rain, vehicles slowing to cross.",
        "source": "Mobile App",
        "media_count": 1,
        "ai_assessment": "Likely Real",
        "map_position_top": "52%",
        "map_position_left": "44%",
        "minutes_ago": 10,
        "confirmations": 3,
        "contradictions": 0,
    },
    {
        "id": "inc-3",
        "category": "Road Blockage",
        "location": "NH 48, Near Toll Plaza",
        "full_location": "NH 48, Near Toll Plaza, Indore",
        "lat": 22.6981,
        "lng": 75.8312,
        "severity": "Medium",
        "confidence": 70,
        "reporter": "Amanj",
        "description": "Barricades placed after a truck breakdown, single lane open in each direction.",
        "source": "Web App",
        "media_count": 0,
        "ai_assessment": "Probable",
        "map_position_top": "42%",
        "map_position_left": "12%",
        "minutes_ago": 15,
        "confirmations": 2,
        "contradictions": 1,
    },
]

SEED_USER = {
    "id": 1,
    "name": "Aayush",
    "full_name": "Aayush Praveen",
    "email": "aayush@example.com",
    "member_since": "May 2025",
    "reliability_score": 4.6,
    "reliability_label": "High Reliability",
}


def seed_db(db):
    """Insert seed data only if tables are empty."""
    if db.query(User).count() == 0:
        user = User(**SEED_USER)
        db.add(user)
        db.commit()

    if db.query(Incident).count() == 0:
        now = datetime.utcnow()
        for data in SEED_INCIDENTS:
            verif_c = data.pop("confirmations", 0)
            verif_x = data.pop("contradictions", 0)
            mins = data.pop("minutes_ago", 0)
            inc = Incident(
                **data,
                is_active=1,
                reported_at_full=now - timedelta(minutes=mins),
            )
            db.add(inc)
            db.flush()  # ensure inc.id is available before adding verifications

            for _ in range(verif_c):
                db.add(Verification(incident_id=inc.id, verdict="confirm"))
            for _ in range(verif_x):
                db.add(Verification(incident_id=inc.id, verdict="contradict"))

        db.commit()
        print("[OK] Database seeded with sample incidents.")
    else:
        print("[INFO] Database already has data -- skipping seed.")


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_db(db)
