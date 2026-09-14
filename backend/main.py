"""FastAPI application entry point.

Run:
    uvicorn backend.main:app --reload --port 8000

The Vite dev server (npm run dev) proxies /api/* to this backend,
so the React app needs no URL config changes between dev and prod.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from .models import Base
from .routers import incidents, users, verifications


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup: create tables and seed DB. Shutdown: nothing needed."""
    Base.metadata.create_all(bind=engine)
    from .database import SessionLocal
    from .seed import seed_db
    db = SessionLocal()
    try:
        seed_db(db)
    finally:
        db.close()
    yield  # application runs here


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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(verifications.router, prefix="/api")


@app.get("/api/health")
def health():
    """Health check -- confirms the API is reachable."""
    return {"status": "ok", "service": "ITS API"}

