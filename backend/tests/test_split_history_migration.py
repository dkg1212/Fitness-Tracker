from datetime import datetime, timezone

import pytest

from lib.split_history_migration import migrate_split_history


@pytest.mark.asyncio
async def test_migration_deduplicates_history_and_backfills_active_split(_patch_db):
    db = _patch_db
    # Simulate a database created before the Phase 1 unique index existed.
    await db.split_history.drop_index("user_from_unique")
    await db.split_history.insert_many([
        {"user_id": "u1", "effective_from": "2026-01-01", "split_name": "A", "days": []},
        {"user_id": "u1", "effective_from": "2026-01-01", "split_name": "B", "days": []},
    ])
    await db.splits.insert_one({"user_id": "u1", "name": "Current", "days": []})
    await db.workouts.insert_one({
        "id": "w1", "user_id": "u1", "date": "2025-12-20", "status": "completed",
        "name": "Workout", "template_id": None, "notes": "", "exercises": [],
        "started_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc),
    })

    await migrate_split_history(db)

    records = await db.split_history.find({"user_id": "u1"}).to_list(10)
    assert len(records) == 1
    split = await db.splits.find_one({"user_id": "u1"})
    assert split["effective_from"] == "2025-12-20"
