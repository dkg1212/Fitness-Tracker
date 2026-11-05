import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from lib.auth import validate_auth_config
from lib.db import client, ensure_indexes
from routers import analytics, auth, exercises, splits, templates, workouts

load_dotenv(Path(__file__).resolve().parent / ".env")

@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_auth_config()
    await ensure_indexes()
    yield
    client.close()

app = FastAPI(title="IronCore Workout API", version="1.0.0", lifespan=lifespan)
for module in (auth, exercises, templates, splits, workouts, analytics):
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
