"""Run the split-history repair and install its unique index.

Run once before deploying Phase 1 to an existing MongoDB database:
    python scripts/migrate_split_history_unique.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.db import db  # noqa: E402
from lib.split_history_migration import migrate_split_history  # noqa: E402


async def main() -> None:
    await migrate_split_history(db)
    await db.split_history.create_index(
        [("user_id", 1), ("effective_from", 1)],
        name="user_from_unique",
        unique=True,
    )
    print("Split-history migration completed.")


if __name__ == "__main__":
    asyncio.run(main())
