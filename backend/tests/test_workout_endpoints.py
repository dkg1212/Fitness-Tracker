"""
Integration tests for /api/workouts endpoints using httpx + mongomock-motor.

Covers HIGH-3 (duration-only exercises), HIGH-4 (optimistic concurrency),
MEDIUM-6 (ownership enforcement, finish endpoint), and basic CRUD.
"""
import pytest
from datetime import datetime, timezone


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _start_workout(client, template_id=None, name=None):
    resp = await client.post("/api/workouts", json={"template_id": template_id, "name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _make_template(client, name="Push"):
    """Create a template so split tests can reference it."""
    # First create an exercise
    resp = await client.post("/api/exercises", json={
        "name": "Test Bench", "muscle_group": "Chest", "equipment": "Barbell",
    })
    ex_id = resp.json()["id"]
    resp = await client.post("/api/templates", json={
        "name": name, "notes": "", "exercises": [
            {"exercise_id": ex_id, "exercise_name": "Test Bench",
             "muscle_group": "Chest", "target_sets": 3, "target_reps": "8-12", "rest_seconds": 120},
        ],
    })
    return resp.json()


def _set_payload(weight=60, reps=8, completed=True, set_type="N", duration_seconds=None):
    s = {
        "uid": "test-set-uid",
        "set_type": set_type,
        "weight": weight,
        "reps": reps,
        "rpe": None,
        "rir": None,
        "completed": completed,
        "loading_inputs": None,
        "weight_note": None,
        "duration_seconds": duration_seconds,
    }
    return s


def _exercise_payload(exercise_id="ex1", sets=None):
    return {
        "uid": "test-ex-uid",
        "exercise_id": exercise_id,
        "exercise_name": "Bench Press",
        "muscle_group": "Chest",
        "equipment": "Barbell",
        "exercise_config": None,
        "notes": "",
        "rest_seconds": 120,
        "effort_mode": "rpe",
        "sets": sets or [_set_payload()],
    }


def _update_body(exercises, revision=None, name="Test Workout"):
    body = {"name": name, "notes": "", "date": None, "exercises": exercises}
    if revision is not None:
        body["revision"] = revision
    return body


# ── Finish validation (HIGH-3) ────────────────────────────────────────────────

class TestFinishValidation:
    async def test_finish_rejects_empty_workout(self, client):
        w = await _start_workout(client)
        body = _update_body([])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=body)
        assert resp.status_code == 422

    async def test_finish_rejects_warmup_only(self, client):
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(weight=30, reps=8, set_type="W")])
        body = _update_body([ex])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=body)
        assert resp.status_code == 422

    async def test_finish_rejects_incomplete_sets(self, client):
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(completed=False)])
        body = _update_body([ex])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=body)
        assert resp.status_code == 422

    async def test_finish_accepts_reps_based(self, client):
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(weight=60, reps=8)])
        body = _update_body([ex])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=body)
        assert resp.status_code == 200
        assert resp.json()["completed_sets"] == 1

    async def test_finish_accepts_duration_only(self, client):
        """HIGH-3: A Plank set with duration_seconds but no reps should finish."""
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(weight=None, reps=None, duration_seconds=60)])
        body = _update_body([ex])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=body)
        assert resp.status_code == 200
        assert resp.json()["completed_sets"] == 1

    async def test_finish_accepts_mixed_reps_and_duration(self, client):
        w = await _start_workout(client)
        ex1 = _exercise_payload(exercise_id="ex1", sets=[_set_payload(weight=60, reps=8)])
        ex2 = _exercise_payload(exercise_id="ex2", sets=[_set_payload(weight=None, reps=None, duration_seconds=45)])
        body = _update_body([ex1, ex2])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=body)
        assert resp.status_code == 200
        assert resp.json()["completed_sets"] == 2

    async def test_finish_rejects_zero_duration(self, client):
        """A set with duration_seconds=0 is not a valid working set."""
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(weight=None, reps=None, duration_seconds=0)])
        body = _update_body([ex])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=body)
        assert resp.status_code == 422


# ── Optimistic concurrency (HIGH-4) ──────────────────────────────────────────────

class TestOptimisticConcurrency:
    async def test_put_rejects_stale_revision(self, client):
        """Client A saves revision 0 → server bumps to 1.
           Client B saves revision 0 (stale) → 409."""
        w = await _start_workout(client)
        wid = w["id"]

        # Client A: save at revision 0 (should succeed, server bumps to 1)
        body_a = _update_body([_exercise_payload()], revision=0)
        resp_a = await client.put(f"/api/workouts/{wid}", json=body_a)
        assert resp_a.status_code == 200
        assert resp_a.json()["revision"] == 1

        # Client B: save at revision 0 (stale — server is now at 1)
        body_b = _update_body([_exercise_payload()], revision=0)
        resp_b = await client.put(f"/api/workouts/{wid}", json=body_b)
        assert resp_b.status_code == 409
        assert "updated elsewhere" in resp_b.json()["detail"]

    async def test_put_accepts_current_revision(self, client):
        """Client saves at revision 0 → server at 1. Client saves at revision 1 → OK."""
        w = await _start_workout(client)
        wid = w["id"]

        # First save at revision 0
        body1 = _update_body([_exercise_payload()], revision=0)
        resp1 = await client.put(f"/api/workouts/{wid}", json=body1)
        assert resp1.status_code == 200
        assert resp1.json()["revision"] == 1

        # Second save at revision 1 (current)
        body2 = _update_body([_exercise_payload()], revision=1)
        resp2 = await client.put(f"/api/workouts/{wid}", json=body2)
        assert resp2.status_code == 200
        assert resp2.json()["revision"] == 2

    async def test_put_without_revision_ignored(self, client):
        """When revision is omitted (legacy client), the update still succeeds."""
        w = await _start_workout(client)
        body = _update_body([_exercise_payload()], revision=None)
        resp = await client.put(f"/api/workouts/{w['id']}", json=body)
        assert resp.status_code == 200

    async def test_finish_increments_revision(self, client):
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(weight=60, reps=8)])
        body = _update_body([ex], revision=0)
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=body)
        assert resp.status_code == 200
        assert resp.json()["workout"]["revision"] == 1


# ── Ownership enforcement (MEDIUM-6) ────────────────────────────────────────────

class TestOwnershipEnforcement:
    async def test_cannot_get_other_users_workout(self, client, make_workout_doc, _patch_db):
        """User A creates a workout; the test client (user A) can access it,
        but if we insert a workout for a different user_id, it should 404."""
        # Create workout for a different user
        other_doc = await make_workout_doc(_patch_db, user_id="other-user", id="other-wk")
        resp = await client.get("/api/workouts/other-wk")
        assert resp.status_code == 404

    async def test_cannot_update_other_users_workout(self, client, make_workout_doc, _patch_db):
        await make_workout_doc(_patch_db, user_id="other-user", id="other-wk")
        body = _update_body([_exercise_payload()])
        resp = await client.put("/api/workouts/other-wk", json=body)
        assert resp.status_code == 404

    async def test_cannot_delete_other_users_workout(self, client, make_workout_doc, _patch_db):
        await make_workout_doc(_patch_db, user_id="other-user", id="other-wk")
        resp = await client.delete("/api/workouts/other-wk")
        assert resp.status_code == 404

    async def test_cannot_finish_other_users_workout(self, client, make_workout_doc, _patch_db):
        await make_workout_doc(_patch_db, user_id="other-user", id="other-wk")
        body = _update_body([_exercise_payload()])
        resp = await client.post("/api/workouts/other-wk/finish", json=body)
        assert resp.status_code == 404


# ── Profile update with omitted sex (MEDIUM-6) ──────────────────────────────────

class TestProfileUpdate:
    async def test_profile_update_without_sex(self, client, _patch_db):
        """Backend accepts sex=null (omitted) per BUG-11 fix."""
        # Seed the user in the mock DB (the mock current_user doesn't upsert)
        await _patch_db.users.insert_one({
            "id": "test-clerk-user-id-123",
            "email": "athlete@test.com", "name": "Old Name",
            "weight_kg": 70, "height_cm": 175, "sex": None,
            "onboarding_completed": False, "onboarding_completed_at": None, "onboarding_version": 0,
        })
        resp = await client.put("/api/auth/profile", json={
            "name": "Test", "weight_kg": 80, "height_cm": 178, "sex": None,
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test"

    async def test_profile_update_with_sex(self, client, _patch_db):
        await _patch_db.users.insert_one({
            "id": "test-clerk-user-id-123",
            "email": "athlete@test.com", "name": "Old Name",
            "weight_kg": 70, "height_cm": 175, "sex": None,
            "onboarding_completed": False, "onboarding_completed_at": None, "onboarding_version": 0,
        })
        resp = await client.put("/api/auth/profile", json={
            "name": "Test", "weight_kg": 80, "height_cm": 178, "sex": "male",
        })
        assert resp.status_code == 200
        assert resp.json()["sex"] == "male"
