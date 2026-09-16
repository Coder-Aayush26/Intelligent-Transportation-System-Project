"""FastAPI application entry point.

Run:
    uvicorn backend.main:app --reload --port 8000

The Vite dev server (npm run dev) proxies /api/* to this backend,
so the React app needs no URL config changes between dev and prod.
"""
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from . import database
from .database import MONGO_URI
from .routers import incidents, users, verifications


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup: connect to MongoDB and seed. Shutdown: close connection."""
    database.client = AsyncIOMotorClient(MONGO_URI)
    db = database.get_db()
    
    from .seed import seed_db
    await seed_db(db)
    
    yield  # application runs here
    
    database.client.close()


app = FastAPI(
    title="ITS -- Intelligent Transportation Systems API",
    description="Crowdsourced real-time incident management for road users.",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the Vite dev server (any localhost port) during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        *filter(None, [os.getenv("FRONTEND_URL")]),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(verifications.router, prefix="/api")


@app.get("/")
def read_root():
    """Root endpoint to prevent 404 on base URL. Useful for Render health checks."""
    return {
        "message": "Welcome to the ITS API",
        "docs_url": "/docs",
        "health_check": "/api/health"
    }

@app.get("/api/health")
def health():
    """Health check -- confirms the API is reachable."""
    return {"status": "ok", "service": "ITS API"}
