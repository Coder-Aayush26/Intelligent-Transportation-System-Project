# ITS Backend — FastAPI

REST API for the Intelligent Transportation Systems app.

## Stack
- **FastAPI** — modern async Python web framework
- **SQLAlchemy** — ORM for database access
- **SQLite** — local database (swap `DATABASE_URL` for PostgreSQL)
- **Uvicorn** — ASGI server

## Quick start

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/macOS

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Start the API server (auto-seeds on first run)
uvicorn backend.main:app --reload --port 8000

# 4. In a separate terminal, start the Vite dev server
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:8000/api/*`
so the React app works with no URL changes.

## API docs

Visit http://localhost:8000/docs for the interactive Swagger UI.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/incidents/ | List all active incidents |
| POST | /api/incidents/ | Create a new incident |
| GET | /api/incidents/{id} | Get incident detail |
| POST | /api/incidents/{id}/verify | Submit verification |
| GET | /api/incidents/stats/summary | Dashboard stats |
| GET | /api/users/me | Current user profile |
| GET | /api/health | Health check |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | sqlite:///./its.db | Database connection string |

## Switching to PostgreSQL

```bash
set DATABASE_URL=postgresql+psycopg2://user:password@localhost/its
pip install psycopg2-binary
uvicorn backend.main:app --reload --port 8000
```
