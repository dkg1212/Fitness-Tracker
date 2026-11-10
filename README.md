# IronCore Workout Tracker

A full-stack personal workout tracker built with **React + FastAPI + MongoDB**.  
Track sessions, build templates, plan your weekly split, monitor PRs and e1RM — all in a clean dark-themed interface that works on desktop and mobile.

![Stack](https://img.shields.io/badge/Frontend-React_18_+_TypeScript-61DAFB?logo=react&logoColor=white)
![Stack](https://img.shields.io/badge/Backend-FastAPI_+_Python_3.12-009688?logo=fastapi&logoColor=white)
![Stack](https://img.shields.io/badge/Database-MongoDB-47A248?logo=mongodb&logoColor=white)
![Stack](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white)
![Stack](https://img.shields.io/badge/Styling-Tailwind_CSS_v4-06B6D4?logo=tailwindcss&logoColor=white)

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Quick start (local)](#quick-start-local)
- [Environment variables](#environment-variables)
- [Deploy to production](#deploy-to-production)
- [Database](#database)
- [Demo seed data](#demo-seed-data)
- [API reference](#api-reference)
- [Performance notes](#performance-notes)
- [Contributing](#contributing)

---

## Features

### Workout logging
- Start a session from a template or freestyle
- Log exercises with equipment-specific weight entry (barbell plates, dumbbell per-side, stack weight, bodyweight)
- Set types: Normal, Warm-up, Drop, Failure
- RPE / RIR effort tracking per set
- Auto-start rest timer after every completed set (configurable duration)
- Session auto-saves to the server on every change — no data lost on page close or connectivity drop
- Offline fallback: drafts saved to device localStorage, synced when back online
- Finish session → PR detection → summary with volume, sets, duration, and new records

### Templates & split planner
- Create named templates with exercises, target sets/reps, and rest times
- Assign templates to days of the week in the Split Planner
- Dashboard shows today's planned session with a one-tap Start button
- "Completed today" detection — no accidental duplicate sessions

### Exercise library
- 80+ built-in exercises with muscle group, equipment, compound/isolation classification
- Create custom exercises with primary and secondary muscle targeting
- Filter by muscle group, equipment, or exercise type
- Exercise progress shortcut → jumps straight to that exercise's analytics chart

### Analytics & progress
- Estimated 1RM (e1RM) tracked per exercise using the Epley formula
- Weekly volume chart (last 12 weeks)
- Muscle workload breakdown (last 4 weeks)
- Sub-muscle breakdown: primary vs secondary involvement
- Personal records: best weight and best e1RM, flagged automatically on session finish

### Workout history
- **Sessions tab**: grouped by month, filterable by date range, delete with confirmation
- **Calendar tab**: colour-coded month view — green (done), red (missed scheduled), cyan (today), upcoming
- **Consistency tab**: all-time stats, streak counters, schedule adherence rings, historical split snapshots

### Onboarding & help
- First-login interactive guided tour: spotlight overlay walks through every section
- Separate named tutorials: custom exercise creation, workout logger, analytics
- "Replay app tour" available from the account menu at any time
- Full written user guide at `/guide`

### Infrastructure
- Clerk authentication — sign up, sign in, session management, JWT verification
- Server-side session persistence: onboarding status, profile, all workout data
- MongoDB indexes optimised for all query paths (slim projections, parallel fetches)
- Split history snapshots: when you change your weekly split, the previous config is archived so historical consistency calculations remain accurate

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 + TypeScript + Vite |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Styling | Tailwind CSS v4 + tw-animate-css |
| UI components | Radix UI (Dialog, Select, Dropdown) |
| Charts | Recharts |
| Icons | Lucide React |
| Fonts | DM Sans, Outfit, JetBrains Mono (variable) |
| Authentication | Clerk (`@clerk/react`) |
| Backend framework | FastAPI |
| Database driver | Motor (async MongoDB) |
| Backend auth | `clerk-backend-api` JWT verification |
| Database | MongoDB 8 |
| Container | Docker Compose (MongoDB only) |

---

## Project structure

```
ironcore-workout-tracker/
├── frontend/
│   ├── src/
│   │   ├── components/       # Shared UI components
│   │   │   ├── AppShell.tsx  # Layout, sidebar, mobile nav, onboarding trigger
│   │   │   ├── WorkoutEditor.tsx
│   │   │   ├── ExercisePicker.tsx
│   │   │   ├── OnboardingTour.tsx
│   │   │   └── ui/           # Radix-based primitives (button, dialog, etc.)
│   │   ├── pages/            # One file per route
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Logger.tsx
│   │   │   ├── History.tsx   # Sessions / Calendar / Consistency tabs
│   │   │   ├── Analytics.tsx
│   │   │   ├── Exercises.tsx
│   │   │   ├── Templates.tsx
│   │   │   ├── SplitPlanner.tsx
│   │   │   └── Guide.tsx
│   │   ├── lib/
│   │   │   ├── api.ts        # Fetch wrapper + Clerk token injection
│   │   │   ├── hooks.ts      # All TanStack Query hooks with stale times
│   │   │   ├── types.ts      # TypeScript mirrors of Pydantic models
│   │   │   └── workout.ts    # Volume / e1RM / formatting helpers
│   │   ├── App.jsx           # Routes
│   │   └── index.css         # CSS variables, Tailwind config, animations
│   ├── .env.local            # Clerk publishable key + API URL (not committed)
│   └── package.json
│
├── backend/
│   ├── routers/
│   │   ├── auth.py           # /auth/me, /auth/profile, /auth/onboarding/*
│   │   ├── workouts.py       # CRUD + finish + PR detection
│   │   ├── exercises.py      # Library + custom exercises
│   │   ├── templates.py      # Template CRUD
│   │   ├── splits.py         # Weekly split + /today + history snapshot
│   │   ├── history.py        # /history/stats, /history/calendar, /history/splits
│   │   └── analytics.py      # Summary, exercise progress, sub-muscle
│   ├── models/               # Pydantic models
│   ├── lib/
│   │   ├── auth.py           # Clerk JWT → MongoDB user upsert
│   │   ├── db.py             # Motor client + all indexes
│   │   ├── training.py       # Volume, e1RM, PR, summarize helpers
│   │   └── dates.py          # Timezone-aware today_iso()
│   ├── main.py               # FastAPI app, CORS, lifespan (indexes + bulk migration)
│   ├── seed.py               # Demo data script
│   ├── requirements.txt
│   └── .env.example
│
└── docker-compose.yml        # MongoDB service
```

---

## Quick start (local)

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker (for local MongoDB) **or** a MongoDB Atlas free cluster

### 1. Clone

```bash
git clone https://github.com/your-username/ironcore-workout-tracker.git
cd ironcore-workout-tracker
```

### 2. Start MongoDB

```bash
docker compose up -d mongodb
```

Or use an Atlas connection string in step 4.

### 3. Create a Clerk application

1. Sign up at [clerk.com](https://clerk.com) (free)
2. Create a new application
3. Copy the **Publishable Key** (`pk_test_…`) and **Secret Key** (`sk_test_…`)

### 4. Configure the backend

```bash
cd backend
cp .env.example .env
# Edit .env:
#   CLERK_SECRET_KEY=sk_test_your_key
#   MONGODB_URI=mongodb://127.0.0.1:27017   (or your Atlas URI)
#   MONGODB_DATABASE=ironcore
#   APP_TZ=UTC
#   CORS_ORIGINS=http://localhost:5173
```

Install dependencies and start:

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 5. Configure the frontend

```bash
cd ../frontend
cp .env.example .env.local
# Edit .env.local:
#   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key
#   VITE_API_URL=http://localhost:8000/api
```

Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Environment variables

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key from your dashboard |
| `VITE_API_URL` | ✅ | Full URL to the backend API, e.g. `https://api.example.com/api` |

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLERK_SECRET_KEY` | ✅ | — | Clerk secret key (starts with `sk_`) |
| `MONGODB_URI` | ✅ | `mongodb://127.0.0.1:27017` | MongoDB connection string |
| `MONGODB_DATABASE` | | `ironcore` | Database name |
| `APP_TZ` | | `UTC` | Timezone for workout date assignment (e.g. `Asia/Kolkata`) |
| `CORS_ORIGINS` | | `http://localhost:5173` | Comma-separated allowed origins |

> **Never commit `.env` or `.env.local` to source control.**  
> Both are listed in `.gitignore`.

---

## Deploy to production

### Frontend → Vercel (recommended)

1. Push to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Set **Root Directory** to `frontend`
4. Add environment variables:
   - `VITE_CLERK_PUBLISHABLE_KEY` — your Clerk **live** publishable key
   - `VITE_API_URL` — your backend URL (e.g. `https://api.yourapp.com/api`)
5. Deploy — Vercel handles the Vite build, CDN, Brotli compression, and cache headers automatically

### Backend → Render (recommended free tier)

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo, set **Root Directory** to `backend`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables:
   - `CLERK_SECRET_KEY` — your Clerk **live** secret key
   - `MONGODB_URI` — your Atlas connection string
   - `CORS_ORIGINS` — your Vercel frontend URL (e.g. `https://ironcore.vercel.app`)
   - `APP_TZ` — your preferred timezone

### Database → MongoDB Atlas

1. Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database user with read/write access
3. Allow network access from `0.0.0.0/0` (or Render's IP range)
4. Copy the connection string into `MONGODB_URI`

### Clerk production setup

1. In your Clerk dashboard, switch to **Production** mode
2. Add your Vercel domain as an allowed origin
3. Copy the **live** publishable and secret keys to your production env vars

---

## Database

MongoDB collections created automatically on first startup:

| Collection | Purpose |
|-----------|---------|
| `users` | User profiles (weight, height, sex, onboarding status) |
| `workouts` | All sessions (active and completed) with full exercise + set data |
| `exercises` | Built-in and custom exercises |
| `templates` | Workout templates |
| `splits` | Current weekly split per user |
| `split_history` | Archived split configs — preserved when the split changes |

### Indexes

The backend creates all indexes via `ensure_indexes()` on startup. Key performance indexes:

- `workouts`: `(user_id, status, date, started_at)` — covers all history queries
- `workouts`: `(user_id, exercises.exercise_id)` — multikey, used by analytics and PR detection
- `workouts`: `(user_id, status, template_id, date)` — covers "completed today" check
- `split_history`: `(user_id, effective_from)` and `(user_id, effective_to)` — covers split timeline queries

---

## Demo seed data

Creates a demo user with four weeks of workout history, templates, and a configured split:

```bash
cd backend
source .venv/bin/activate
python seed.py
```

Demo credentials (Clerk test mode only):
- **Email:** `athlete@ironcore.app`
- **Password:** `IronCore#2026`

> Do not run the seed script against a production database.

---

## API reference

The FastAPI auto-generates interactive docs at `/docs` (Swagger UI) and `/redoc`.

| Prefix | Router | Description |
|--------|--------|-------------|
| `/api/auth` | `auth.py` | Profile, onboarding status |
| `/api/workouts` | `workouts.py` | CRUD, finish, previous sets |
| `/api/exercises` | `exercises.py` | Library, custom exercise CRUD |
| `/api/templates` | `templates.py` | Template CRUD |
| `/api/split` | `splits.py` | Weekly split, `/today` |
| `/api/history` | `history.py` | Stats, calendar, split history |
| `/api/analytics` | `analytics.py` | Summary, exercise progress, sub-muscle |
| `/api/health` | `main.py` | Health check |

All endpoints require a valid Clerk session token in the `Authorization: Bearer <token>` header, except `/api/health`.

---

## Performance notes

Changes made to keep the app fast in production:

**Backend**
- MongoDB slim projections: analytics and history endpoints exclude `loading_inputs`, `exercise_config`, `notes`, `uid` from set payloads — typically 40–60% smaller documents
- Targeted queries: `GET /analytics/exercise/{id}` filters by `exercises.exercise_id` in MongoDB (uses multikey index) instead of loading all workouts
- Parallel DB calls: `asyncio.gather` on the three queries in `/history/stats` and `/history/calendar`
- Calendar optimisation: only fetches workouts for the requested month, not the full history
- Sub-muscle endpoint: date-filtered to last 4 weeks — loads ~20–50 workouts instead of full history
- Startup: exercise metadata migration uses `bulk_write` (one round-trip, not N)

**Frontend**
- TanStack Query stale times: `useActiveWorkout` 30s, `useTemplates` 5min, `useAnalyticsSummary` 5min — prevents repeated fetches on route changes
- Shared query keys: Dashboard and Analytics share `["analytics","summary"]` — navigating between them doesn't re-fetch
- `React.memo` on `CalendarCell`: prevents 28–31 cell re-renders on every date selection
- `invalidateAll` includes `["history"]`: History page reflects changes immediately after finishing or deleting a workout

**Production deployment**
- Vercel automatically applies Brotli compression and sets immutable cache headers on Vite-hashed static assets
- MongoDB Atlas: choose the region geographically closest to your Render API server to minimise query latency
- Clerk edge network handles all auth token verification — no cold-start impact on your backend

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes — keep backend and frontend changes in separate commits where possible
4. Ensure the frontend builds without errors: `cd frontend && npm run build`
5. Verify backend Python syntax: `cd backend && python -m py_compile routers/*.py models/*.py lib/*.py main.py`
6. Open a pull request with a clear description of what changed and why

---

## License

MIT — see [LICENSE](LICENSE) for details.
