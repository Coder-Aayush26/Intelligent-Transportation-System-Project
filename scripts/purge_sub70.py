import asyncio
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

import os
from motor.motor_asyncio import AsyncIOMotorClient

async def purge():
    uri = os.getenv("MONGO_URI")
    db_name = os.getenv("MONGO_DB", "its_db")
    print(f"Connecting to MongoDB {db_name}...")
    client = AsyncIOMotorClient(uri)
    db = client[db_name]

    query = {
        "$or": [
            {"ai_authenticity_score": {"$lt": 70}},
            {"media_score": {"$lt": 0.70}},
        ]
    }
    cursor = db.incidents.find(query)
    to_delete = await cursor.to_list(300)
    print(f"Found {len(to_delete)} sub-70% incidents in MongoDB.")
    for inc in to_delete:
        inc_id = inc.get("id")
        desc = (inc.get("description") or "")[:30]
        cat = inc.get("category")
        score = inc.get("ai_authenticity_score")
        m_score = inc.get("media_score")
        print(f"  Deleting {inc_id} [{cat}] (score={score}, media_score={m_score}, desc='{desc}')")
        await db.incidents.delete_one({"id": inc_id})
        await db.verifications.delete_many({"incident_id": inc_id})

    print(f"Purge complete: {len(to_delete)} invalid records deleted from database.")

if __name__ == "__main__":
    asyncio.run(purge())
