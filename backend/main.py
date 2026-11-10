import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from lib.auth import validate_auth_config
from lib.db import client, ensure_indexes
from lib.exercise_meta import EXERCISE_META
from lib.db import db
from routers import analytics, auth, exercises, history, splits, templates, workouts

load_dotenv(Path(__file__).resolve().parent / ".env")

@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_auth_config()
    await ensure_indexes()
    # Auto-migrate: apply exercise_type/primary_muscles/secondary_muscles to all
    # built-in exercises that are missing this data. Safe to run on every startup.
    for name, (ex_type, primary, secondary) in EXERCISE_META.items():
        await db.exercises.update_one(
            {"name": name, "is_custom": False},
            {"$set": {
                "exercise_type": ex_type,
                "primary_muscles": primary,
                "secondary_muscles": secondary,
            }},
        )
    yield
    client.close()

app = FastAPI(title="IronCore Workout API", version="1.0.0", lifespan=lifespan)
for module in (auth, exercises, templates, splits, history, workouts, analytics):
    app.include_router(module.router, prefix="/api")
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ironcore-workout-api"}
