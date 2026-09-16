# ITS — Intelligent Transportation Systems (Frontend Prototype)

Crowdsourced real-time transportation information and incident-management
system, based on the project proposal (crowdsourced reporting, multi-stage
verification, GIS-based incident monitoring).

This is the **frontend only** — a React (Vite) prototype with mock data,
matching the staged UI mockup. No backend is wired up.

## Stack

- React 19 + Vite
- React Router (`react-router-dom`) for page/route navigation
- Plain CSS with a shared token file (`src/styles/theme.css`) — no
  CSS framework, no CSS-in-JS

## Getting started

```bash
npm install
npm run dev      # start local dev server
npm run build    # production build to dist/
npm run lint     # oxlint
```

## Deploying the frontend to Vercel

This repository contains a Vite single-page application. In Vercel, set the
project's **Root Directory** to `Intelligent-Transportation-System-Project`
(the directory containing `package.json`), then use the default Vite build
settings:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

The included `vercel.json` rewrites client-side routes such as
`/app/dashboard` to `index.html`, so refreshing a nested route works in
production.

The frontend can use the mock data while the API is unavailable, but it is
configured to use your separately deployed FastAPI backend on Render when
`VITE_API_URL` is set. In Vercel, add:

```text
VITE_API_URL=https://your-api.onrender.com
```

Use the Render service URL without a trailing `/api`. The frontend appends
`/api` to API requests. Configure the Render service's `FRONTEND_URL`
environment variable with your Vercel URL, for example
`https://your-app.vercel.app`, so CORS allows browser requests.

Report submissions are sent to the Render backend. Dashboard, profile, and
incident pages fall back to mock data if the API is temporarily unavailable.

## Project structure

```
src/
├── main.jsx              Entry point — mounts <App/> inside BrowserRouter
├── App.jsx                Route table
├── styles/
│   └── theme.css          Design tokens (colors, radius, fonts), resets
├── data/
│   └── mockData.js        Mock incidents, user, stats — swap for API calls later
├── components/
│   ├── common/             Cross-page primitives (Button, ConfidenceBar)
│   ├── layout/              Sidebar, Topbar, AppLayout (shared shell for /app/*)
│   ├── dashboard/          Live map, stats row, incident cards
│   ├── report/               Report-incident form + location preview
│   ├── incident/            Incident detail header, media, verification summary
│   └── profile/              Profile header, reliability score, activity feed
└── pages/
    ├── LandingPage.jsx      Public marketing page ("/")
    ├── DashboardPage.jsx    Live map dashboard ("/app/dashboard")
    ├── ReportIncidentPage.jsx  Report form ("/app/report")
    ├── IncidentDetailPage.jsx  Incident detail ("/app/incidents/:id")
    ├── ProfilePage.jsx      User profile & reliability ("/app/profile")
    └── PlaceholderPage.jsx  Stub for not-yet-built sidebar sections
```

Each component pairs a `.jsx` file with a same-named `.css` file — styles
are scoped by convention (component-specific class names), not CSS Modules,
to keep things simple for a prototype. If this grows, switching to CSS
Modules or Tailwind is a natural next step.

## Routes

| Path                     | Page                          |
|---------------------------|-------------------------------|
| `/`                        | Landing page                   |
| `/app/dashboard`           | Live map + active incidents    |
| `/app/report`               | Report a new incident          |
| `/app/incidents/:id`        | Incident detail                |
| `/app/profile`              | User profile & reliability     |
| `/app/reports` etc.          | Placeholder stubs for the remaining sidebar items |

## Data

All content is centralized in `src/data/mockData.js` — incidents, the
current user, dashboard stats, category-to-icon/color mapping. Swap the
exported constants for real API calls (e.g. `fetch('/api/incidents')`)
without touching any component markup.

## Known gaps (frontend-only prototype)

- No real map tiles — `LiveMap` and `LocationPreview` render a stylized
  SVG map, not Google Maps/Leaflet. Swapping in a real map library means
  replacing the `<svg>` block in those two components.
- No auth, no persistence — the report form just alerts and redirects.
- Backend pieces from the proposal (FastAPI, PostgreSQL/PostGIS, media
  manipulation detection) are not implemented here.
