"""
Test fixtures for FastAPI endpoint integration tests.

Uses mongomock-motor to provide an in-memory MongoDB replacement so tests
never touch a real database.  Clerk auth is bypassed via app.dependency_overrides.
"""
import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from mongomock_motor import AsyncMongoMockClient


@pytest.fixture(autouse=True)
def _patch_db(monkeypatch):
    """Replace the real MongoDB client with a fresh mock for each test."""
    fresh_client = AsyncMongoMockClient()
    fresh_db = fresh_client["ironcore_test"]

    # Patch lib.db so ensure_indexes runs on the mock
    import lib.db as db_module
    monkeypatch.setattr(db_module, "client", fresh_client)
    monkeypatch.setattr(db_module, "db", fresh_db)

    # Patch every module that imported `db` at module level
    import routers.workouts as workouts_mod
    monkeypatch.setattr(workouts_mod, "db", fresh_db)
    import routers.splits as splits_mod
    monkeypatch.setattr(splits_mod, "db", fresh_db)
    import routers.auth as auth_mod
    monkeypatch.setattr(auth_mod, "db", fresh_db)
    import routers.exercises as exercises_mod
    monkeypatch.setattr(exercises_mod, "db", fresh_db)
    import routers.templates as templates_mod
    monkeypatch.setattr(templates_mod, "db", fresh_db)
    import routers.history as history_mod
    monkeypatch.setattr(history_mod, "db", fresh_db)
    import routers.analytics as analytics_mod
    monkeypatch.setattr(analytics_mod, "db", fresh_db)

    # Create indexes on the mock DB
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_ensure_indexes_mock(fresh_db))
    finally:
        loop.close()

    yield fresh_db


async def _ensure_indexes_mock(fresh_db):
    """Create the same indexes as lib.db.ensure_indexes but on the mock."""
    from lib.db import INDEXES
    for collection, indexes in INDEXES.items():
        try:
            await fresh_db[collection].create_indexes(indexes)
        except Exception:
            pass  # mongomock may not support all index options


@pytest.fixture
def test_user_id():
    return "test-clerk-user-id-123"


@pytest.fixture
def test_user():
    return {
        "id": "test-clerk-user-id-123",
        "email": "athlete@test.com",
        "name": "Test Athlete",
        "weight_kg": None,
        "height_cm": None,
        "sex": None,
        "onboarding_completed": False,
        "onboarding_completed_at": None,
        "onboarding_version": 0,
    }


@pytest.fixture(autouse=True)
def _patch_auth(test_user):
    """Bypass Clerk authentication via app.dependency_overrides."""
    from lib.auth import current_user

    async def _fake_current_user():
        return test_user

    from main import app
    app.dependency_overrides[current_user] = _fake_current_user
    yield
    app.dependency_overrides.clear()


@pytest.fixture
async def client(_patch_db, _patch_auth):
    """HTTPX AsyncClient bound to the FastAPI app with mock DB + auth."""
    from httpx import ASGITransport, AsyncClient
    from main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def make_workout_doc(test_user_id):
    """Factory for creating workout documents directly in the mock DB."""
    async def _make(db, **overrides):
        doc = {
            "id": str(uuid.uuid4()),
            "name": "Test Workout",
            "date": "2026-11-01",
            "status": "active",
            "template_id": None,
            "notes": "",
            "exercises": [],
            "started_at": datetime.now(timezone.utc),
            "finished_at": None,
            "updated_at": datetime.now(timezone.utc),
            "revision": 0,
            "user_id": test_user_id,
            **overrides,
        }
        await db.workouts.insert_one(doc)
        return doc
    return _make
