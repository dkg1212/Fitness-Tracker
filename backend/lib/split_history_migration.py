"""Idempotent data repair required before enforcing split-history uniqueness."""

from __future__ import annotations

from typing import Any

from lib.dates import today_iso


async def migrate_split_history(db: Any) -> None:
    """Prepare existing data for the split-history unique index.

    Earlier releases could create multiple history records for one user and
    effective date.  Keep the earliest inserted record, which is the original
    configuration for that date, then remove later duplicates.  Active splits
    also gain ``effective_from`` so subsequent changes have a correct interval.
    """
    duplicates = db.split_history.aggregate([
        {"$sort": {"_id": 1}},
        {"$group": {
            "_id": {"user_id": "$user_id", "effective_from": "$effective_from"},
            "ids": {"$push": "$_id"},
            "count": {"$sum": 1},
        }},
        {"$match": {"count": {"$gt": 1}}},
    ])
    async for group in duplicates:
        ids = group["ids"]
        # ObjectIds are ordered by creation time, so the first is the original
        # same-day snapshot and is the one to preserve.
        await db.split_history.delete_many({"_id": {"$in": ids[1:]}})

    async for split in db.splits.find({"effective_from": {"$exists": False}}):
        first_workout = await db.workouts.find_one(
            {"user_id": split["user_id"], "date": {"$type": "string"}},
            {"_id": 0, "date": 1},
            sort=[("date", 1)],
        )
        # Existing split creation dates were not stored. The first workout is
        # the best non-invented lower bound; no-workout users start today.
        effective_from = (first_workout or {}).get("date", today_iso())
        await db.splits.update_one(
            {"_id": split["_id"]},
            {"$set": {"effective_from": effective_from}},
        )
