"""Motor (MongoDB) engine + database factory."""
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load backend/.env first, then root .env
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "its_db")

client = None

def get_db():
    """FastAPI dependency — returns the MongoDB database instance."""
    if client is None:
        raise Exception("Database client not initialized")
    return client[MONGO_DB]
