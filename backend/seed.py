"""Seed script — populates the database with the initial users and mock incidents
so the frontend displays real data immediately.

Called automatically by main.py on startup if collections are empty.
"""
from datetime import datetime, timedelta
import uuid
import asyncio

try:
    from .auth import hash_password
except ImportError:
    from backend.auth import hash_password

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
        "is_active": 1,
        "status": "Active",
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
        "is_active": 1,
        "status": "Active",
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
        "is_active": 1,
        "status": "Active",
        "minutes_ago": 15,
        "confirmations": 2,
        "contradictions": 1,
    },
    {
        "id": "inc-4",
        "category": "Accident",
        "location": "Palasia Square, AB Road",
        "full_location": "Palasia Square, AB Road, Indore",
        "lat": 22.7212,
        "lng": 75.8592,
        "severity": "High",
        "confidence": 88,
        "reporter": "Traffic_Patrol_MP",
        "description": "Two vehicles collision blocking north-bound carriageway. Emergency response on site.",
        "source": "Mobile App",
        "media_count": 0,
        "media_urls": [],
        "ai_assessment": "Likely Real",
        "ai_authenticity_score": 92,
        "ai_verified": True,
        "map_position_top": "28%",
        "map_position_left": "30%",
        "is_active": 1,
        "status": "Active",
        "minutes_ago": 3,
        "confirmations": 4,
        "contradictions": 0,
    },
    {
        "id": "inc-5",
        "category": "Accident",
        "location": "Akota Bridge Crossway",
        "full_location": "Akota Bridge Crossway, Vadodara",
        "lat": 22.2562,
        "lng": 73.2185,
        "severity": "Critical",
        "confidence": 90,
        "reporter": "Citizen_Alert_Gujarat",
        "description": "Major collision at crossway, right lane obstructed. Heavy traffic slowdown.",
        "source": "Mobile App",
        "media_count": 0,
        "media_urls": [],
        "ai_assessment": "Likely Real",
        "ai_authenticity_score": 92,
        "ai_verified": True,
        "map_position_top": "35%",
        "map_position_left": "32%",
        "is_active": 1,
        "status": "Active",
        "minutes_ago": 5,
        "confirmations": 3,
        "contradictions": 0,
    },
]

DEMO_PASSWORD_HASH = hash_password("password")

SEED_USERS = [
    {
        "_id": "usr-demo",
        "id": "usr-demo",
        "name": "Demo User",
        "full_name": "Demo User",
        "email": "demo_user@example.com",
        "password_hash": DEMO_PASSWORD_HASH,
        "member_since": "May 2025",
        "reliability_score": 4.6,
        "reliability_label": "Active Contributor",
        "lat": 22.7196,
        "lng": 75.8577,
        "latitude": 22.7196,
        "longitude": 75.8577,
        "role": "citizen",
        "is_authority": False,
        "department": "Indore Traffic Police Control Room",
        "badge_number": "IND-TP-01",
        "assigned_unit": "UNIT-TP-01",
        "rank": "Municipal Operations Officer",
        "status": "Active",
    },
    {
        "_id": "usr-aayush",
        "id": "usr-aayush",
        "name": "Aayush",
        "full_name": "Aayush Praveen",
        "email": "aayush@example.com",
        "password_hash": DEMO_PASSWORD_HASH,
        "member_since": "May 2025",
        "reliability_score": 4.8,
        "reliability_label": "High Reliability",
        "lat": 22.7196,
        "lng": 75.8577,
        "latitude": 22.7196,
        "longitude": 75.8577,
        "role": "citizen",
        "is_authority": False,
        "status": "Active",
    },
    {
        "_id": "auth-officer-01",
        "id": "auth-officer-01",
        "user_id": "auth-officer-01",
        "officer_id": "IND-TP-01",
        "name": "Officer Sharma",
        "full_name": "Officer Sharma",
        "email": "officer@example.com",
        "password_hash": DEMO_PASSWORD_HASH,
        "role": "official",
        "is_authority": True,
        "department": "Indore Traffic Police Control Room",
        "badge_number": "IND-TP-01",
        "assigned_unit": "UNIT-TP-01",
        "rank": "Municipal Operations Officer",
        "status": "On Duty",
        "reliability_score": 5.0,
        "reliability_label": "Verified Authority Officer",
    },
]

OFFICER_AUTHORITY_DOC = {
    "_id": "auth-officer-01",
    "id": "auth-officer-01",
    "user_id": "auth-officer-01",
    "officer_id": "IND-TP-01",
    "name": "Officer Sharma",
    "full_name": "Officer Sharma",
    "email": "officer@example.com",
    "department": "Indore Traffic Police Control Room",
    "badge_number": "IND-TP-01",
    "assigned_unit": "UNIT-TP-01",
    "role": "official",
    "rank": "Municipal Operations Officer",
    "status": "On Duty",
    "is_authority": True,
    "reliability_score": 5.0,
    "reliability_label": "Verified Authority Officer",
    "created_at": datetime.utcnow(),
    "last_active": datetime.utcnow(),
}


async def seed_db(db):
    """Insert seed data into users, authorities, incidents, and verifications if empty."""
    try:
        user_count = await db.users.count_documents({})
        if user_count == 0:
            for u in SEED_USERS:
                await db.users.insert_one(dict(u))
            print(f"[OK] Seeded {len(SEED_USERS)} initial users (Demo User, Aayush, Officer).")
    except Exception as e:
        print(f"[Seed] Error seeding users: {e}")

    try:
        if hasattr(db, "authorities"):
            auth_count = await db.authorities.count_documents({})
            if auth_count == 0:
                await db.authorities.insert_one(dict(OFFICER_AUTHORITY_DOC))
                print("[OK] Seeded authority personnel record (IND-TP-01).")
    except Exception as e:
        print(f"[Seed] Error seeding authorities: {e}")

    try:
        now = datetime.utcnow()
        for raw in SEED_INCIDENTS:
            data = dict(raw)
            exists = await db.incidents.find_one({"id": data["id"]})
            if not exists:
                verif_c = data.pop("confirmations", 0)
                verif_x = data.pop("contradictions", 0)
                mins = data.pop("minutes_ago", 0)
                data["reported_at_full"] = now - timedelta(minutes=mins)
                data["last_activity_at"] = now - timedelta(minutes=mins)
                await db.incidents.insert_one(data)

                verifications = []
                for _ in range(verif_c):
                    verifications.append({
                        "_id": uuid.uuid4().hex,
                        "incident_id": data["id"],
                        "verdict": "confirm",
                        "created_at": now - timedelta(minutes=mins),
                    })
                for _ in range(verif_x):
                    verifications.append({
                        "_id": uuid.uuid4().hex,
                        "incident_id": data["id"],
                        "verdict": "contradict",
                        "created_at": now - timedelta(minutes=mins),
                    })
                if verifications:
                    await db.verifications.insert_many(verifications)
                print(f"[OK] Seeded incident {data['id']}: {data['category']} at {data['location']}")
        print("[OK] Seeded sample incidents and verifications.")
    except Exception as e:
        print(f"[Seed] Error seeding incidents: {e}")


if __name__ == "__main__":
    from motor.motor_asyncio import AsyncIOMotorClient
    from .database import MONGO_URI, MONGO_DB

    async def main():
        client = AsyncIOMotorClient(MONGO_URI)
        db = client[MONGO_DB]
        await seed_db(db)
        client.close()

    asyncio.run(main())
