"""FastAPI application entry point.

Run:
    uvicorn backend.main:app --reload --port 8000

The Vite dev server (npm run dev) proxies /api/* to this backend,
so the React app needs no URL config changes between dev and prod.
"""
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from . import database
from .database import MONGO_URI
from .routers import incidents, users, verifications, location
from .routers import auth as auth_router
from .realtime import realtime_manager


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup: connect to MongoDB, or gracefully fall back to in-memory mongomock if MongoDB is offline."""
    real_client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=1000)
    try:
        await real_client.admin.command('ping')
        database.client = real_client
        print(f"[MongoDB] Connected successfully to live MongoDB at {MONGO_URI}")
    except Exception as e:
        print(f"[MongoDB] Local MongoDB at {MONGO_URI} is offline ({type(e).__name__}). Switching to AsyncMongoMockClient in-memory engine.")
        try:
            from mongomock_motor import AsyncMongoMockClient
            database.client = AsyncMongoMockClient()
        except ImportError:
            database.client = real_client

    try:
        from .seed import seed_db
        db = database.get_db()
        await seed_db(db)
    except Exception as e:
        print(f"[Startup] Error seeding database: {e}")

    try:
        db = database.get_db()
        cursor = db.users.find({
            "$or": [
                {"latitude": None, "lat": {"$ne": None}},
                {"longitude": None, "lng": {"$ne": None}},
            ]
        })
        async for u in cursor:
            lat = u.get("lat")
            lng = u.get("lng")
            if lat is not None and lng is not None:
                await db.users.update_one(
                    {"_id": u["_id"]},
                    {"$set": {"latitude": float(lat), "longitude": float(lng)}}
                )
    except Exception:
        pass

    yield  # application runs here
    if database.client is not None:
        try:
            database.client.close()
        except Exception:
            pass


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
app.include_router(auth_router.router)
app.include_router(incidents.router, prefix="/api")
app.include_router(incidents.router)
app.include_router(location.router, prefix="/api")
app.include_router(location.router)
app.include_router(users.router, prefix="/api")
app.include_router(users.router)
app.include_router(verifications.router, prefix="/api")
app.include_router(verifications.router)


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


@app.websocket("/api/ws/incidents")
@app.websocket("/ws/incidents")
async def websocket_incidents_endpoint(websocket: WebSocket):
    """Real-time WebSocket endpoint for incident streaming and push alerts."""
    await realtime_manager.connect_websocket(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        realtime_manager.disconnect_websocket(websocket)
    except Exception:
        realtime_manager.disconnect_websocket(websocket)
