import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

client = AsyncIOMotorClient(
    # Credentials belong in backend/.env (which is ignored by Git), never in source.
    os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017"),
    serverSelectionTimeoutMS=5000,
)
db = client[os.getenv("MONGODB_DATABASE", "ironcore")]

INDEXES = {
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
    ],
    "exercises": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("is_custom", ASCENDING), ("name", ASCENDING)], name="custom_name"),
        IndexModel([("user_id", ASCENDING), ("name", ASCENDING)], name="user_name"),
    ],
    "templates": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", ASCENDING)], name="user_created"),
    ],
    "splits": [IndexModel([("user_id", ASCENDING)], name="user_id", unique=True)],
    "split_history": [
        IndexModel([("user_id", ASCENDING), ("effective_from", ASCENDING)], name="user_from"),
    ],
    "workouts": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        # Enforce the one-active-workout rule even when two requests arrive together.
        IndexModel(
            [("user_id", ASCENDING)],
            name="one_active_workout_per_user",
            unique=True,
            partialFilterExpression={"status": "active"},
        ),
        IndexModel(
            [("user_id", ASCENDING), ("status", ASCENDING), ("date", DESCENDING), ("started_at", DESCENDING)],
            name="user_status_date",
        ),
    ],
}


async def ensure_indexes() -> None:
    await client.admin.command("ping")
    for collection, indexes in INDEXES.items():
        await db[collection].create_indexes(indexes)
