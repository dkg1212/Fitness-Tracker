import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import UpdateOne

from lib.auth import validate_auth_config
from lib.db import client, db, ensure_indexes
from lib.exercise_meta import EXERCISE_META
from routers import analytics, auth, exercises, history, splits, templates, workouts

load_dotenv(Path(__file__).resolve().parent / ".env")

# CORS is set up before the app is built so the middleware order is correct.
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_auth_config()
    await ensure_indexes()

    # Auto-migrate built-in exercises to include exercise_type / muscle metadata.
    # Uses bulk_write so this is a single DB round-trip regardless of library size.
    ops = [
        UpdateOne(
            {"name": name, "is_custom": False},
            {"$set": {
                "exercise_type": ex_type,
                "primary_muscles": primary,
                "secondary_muscles": secondary,
            }},
        )
        for name, (ex_type, primary, secondary) in EXERCISE_META.items()
    ]
    if ops:
        await db.exercises.bulk_write(ops, ordered=False)

    yield
    client.close()


app = FastAPI(title="IronCore Workout API", version="1.0.0", lifespan=lifespan)

# Middleware must be registered before routes in Starlette.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, exercises, templates, splits, history, workouts, analytics):
    app.include_router(module.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ironcore-workout-api"}
