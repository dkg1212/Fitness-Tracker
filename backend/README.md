# FastAPI backend

The frontend can run without this API in local-only mode. This backend adds MongoDB-backed users, workouts, templates, exercises, splits, and analytics.

## Setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add CLERK_SECRET_KEY from your Clerk Dashboard to .env. Keep MONGODB_URI as localhost if MongoDB runs locally.
uvicorn main:app --reload --port 8000
```
Open http://localhost:8000/docs.

## MongoDB

MongoDB must be running before the API starts. The default connection is `mongodb://127.0.0.1:27017` and the database is created automatically when the first indexes are added. To use MongoDB Atlas, replace `MONGODB_URI` in `.env` with the Atlas connection string and allow your IP address in Atlas Network Access.

If Docker is installed, from the project root run `docker compose up -d mongodb` to start a local database. Its data is stored in the `ironcore_mongodb_data` Docker volume; stop it with `docker compose down` (this preserves the data).

The API pings MongoDB and creates all indexes during startup. If startup fails with a server-selection error, MongoDB is not reachable or `MONGODB_URI` is incorrect.

## Demo data

After MongoDB is running, seed the demo account and four weeks of history:

```bash
cd backend
source .venv/bin/activate
python seed.py
```

Demo login: `athlete@ironcore.app` / `IronCore#2026`.

For production, use Clerk live keys and set `CORS_ORIGINS` to the exact frontend origin. Do not commit `.env`.
