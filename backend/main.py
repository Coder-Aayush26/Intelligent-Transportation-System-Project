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
from .routers import auth as auth_router


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup: connect to MongoDB. Shutdown: close connection."""
    database.client = AsyncIOMotorClient(MONGO_URI)
    yield  # application runs here
    database.client.close()


app = FastAPI(
    title="ITS -- Intelligent Transportation Systems API",
    description="Crowdsourced real-time incident management for road users.",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow any localhost or 127.0.0.1 port (Vite 5173, 5174, preview 4173, etc.) + production frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
        *filter(None, [os.getenv("FRONTEND_URL")]),
    ],
    allow_origin_regex=r"^https://.*\.vercel\.app$|^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes with /api prefix (primary) and root prefix (alias fallback)
app.include_router(auth_router.router, prefix="/api")
app.include_router(auth_router.router)  # supports /auth/login as well
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
