"""Seed script — populates the database with the same mock data that
lives in src/data/mockData.js so the frontend shows real data immediately.

Called automatically by main.py on startup if the DB is empty.
"""
from datetime import datetime, timedelta
import uuid
import asyncio

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


async def seed_db(db):
    """Insert seed data only if collections are empty."""
    user_count = await db.users.count_documents({})
    if user_count == 0:
        await db.users.insert_one(SEED_USER)

    inc_count = await db.incidents.count_documents({})
    if inc_count == 0:
        now = datetime.utcnow()
        for data in SEED_INCIDENTS:
            verif_c = data.pop("confirmations", 0)
            verif_x = data.pop("contradictions", 0)
            mins = data.pop("minutes_ago", 0)
            
            data["reported_at_full"] = now - timedelta(minutes=mins)
            
            await db.incidents.insert_one(data)

            verifications = []
            for _ in range(verif_c):
                verifications.append({"_id": uuid.uuid4().hex, "incident_id": data["id"], "verdict": "confirm", "created_at": now})
            for _ in range(verif_x):
                verifications.append({"_id": uuid.uuid4().hex, "incident_id": data["id"], "verdict": "contradict", "created_at": now})
                
            if verifications:
                await db.verifications.insert_many(verifications)

        print("[OK] MongoDB seeded with sample incidents.")
    else:
        print("[INFO] MongoDB already has data -- skipping seed.")

if __name__ == "__main__":
    from motor.motor_asyncio import AsyncIOMotorClient
    from .database import MONGO_URI, MONGO_DB
    
    async def main():
        client = AsyncIOMotorClient(MONGO_URI)
        db = client[MONGO_DB]
        await seed_db(db)
        client.close()
        
    asyncio.run(main())
