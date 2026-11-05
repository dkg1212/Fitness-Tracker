# IronCore Workout Tracker (local starter)

A responsive personal workout tracker inspired by the features described for your Emergent-built Gymlog Pro 6. This is a fresh, editable implementation based on the project details you shared, **not a recovered copy of Emergent's original source code**.

## Requirements
- Node.js 18+ (20+ recommended)
- npm

## Run the frontend
```bash
cd frontend
npm install
npm run dev
```
Open the local URL Vite prints (usually http://localhost:5173).

## Features in this starter
- Dashboard with today's plan, streak, session count, and weekly chart
- Workout logger: exercise list, set rows, weight, reps, RPE/RIR, set type, completion
- Rest timer
- Workout history and edit/delete
- Reusable templates and weekly split planner
- Exercise library with search and custom exercises
- Analytics: volume by week, muscle groups, PRs, estimated 1RM progression
- Responsive desktop/mobile layout
- Local browser storage so you can start using it without configuring a database

## Data storage
This starter saves workouts/templates/exercises in the browser's localStorage on this device/browser. It is not synced to another device. Export JSON from Settings to back up your data.

## Optional API backend
A FastAPI backend scaffold is in `backend/`. It uses MongoDB if configured. See `backend/README.md`. The frontend currently runs in local-first mode and does not require the backend.

## Learn the code in this order
1. `frontend/src/App.jsx` - pages and app state
2. `frontend/src/lib/storage.js` - local persistence and seeded examples
3. `frontend/src/lib/metrics.js` - volume, PR and estimated 1RM calculations
4. `frontend/src/styles.css` - responsive design
5. `backend/main.py` - API entry point
6. `backend/routers/` - API endpoints
