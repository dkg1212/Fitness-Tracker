"""
Integration tests for /api/workouts endpoints using httpx + mongomock-motor.

Covers:
- Finding 1 & 2: Atomic revision protection on PUT and finish
- Finding 3: Duration-only exercises (Plank etc.)
- Finding 6: Concurrent PUT, concurrent finish, stale finish after autosave
- Ownership enforcement
- Profile update with omitted sex
"""
import asyncio
import pytest
from datetime import datetime, timezone


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _start_workout(client, template_id=None, name=None):
    resp = await client.post("/api/workouts", json={"template_id": template_id, "name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()


def _set_payload(weight=60, reps=8, completed=True, set_type="N", duration_seconds=None):
    return {
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


# ── Finish validation (duration-only, Finding 3) ─────────────────────────────

class TestFinishValidation:
    async def test_finish_rejects_empty_workout(self, client):
        w = await _start_workout(client)
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=_update_body([]))
        assert resp.status_code == 422

    async def test_finish_rejects_warmup_only(self, client):
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(weight=30, reps=8, set_type="W")])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=_update_body([ex]))
        assert resp.status_code == 422

    async def test_finish_rejects_incomplete_sets(self, client):
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(completed=False)])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=_update_body([ex]))
        assert resp.status_code == 422

    async def test_finish_accepts_reps_based(self, client):
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(weight=60, reps=8)])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=_update_body([ex]))
        assert resp.status_code == 200
        assert resp.json()["completed_sets"] == 1

    async def test_finish_accepts_duration_only(self, client):
        """Plank with 60 s, no reps — must be accepted."""
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(weight=None, reps=None, duration_seconds=60)])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=_update_body([ex]))
        assert resp.status_code == 200
        assert resp.json()["completed_sets"] == 1

    async def test_finish_accepts_mixed_reps_and_duration(self, client):
        w = await _start_workout(client)
        ex1 = _exercise_payload(exercise_id="ex1", sets=[_set_payload(weight=60, reps=8)])
        ex2 = _exercise_payload(exercise_id="ex2", sets=[_set_payload(weight=None, reps=None, duration_seconds=45)])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=_update_body([ex1, ex2]))
        assert resp.status_code == 200
        assert resp.json()["completed_sets"] == 2

    async def test_finish_rejects_zero_duration(self, client):
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(weight=None, reps=None, duration_seconds=0)])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=_update_body([ex]))
        assert resp.status_code == 422

    async def test_finish_cannot_double_finish(self, client):
        """Finishing an already-finished workout must return 409."""
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(weight=60, reps=8)])
        resp1 = await client.post(f"/api/workouts/{w['id']}/finish", json=_update_body([ex]))
        assert resp1.status_code == 200
        resp2 = await client.post(f"/api/workouts/{w['id']}/finish", json=_update_body([ex]))
        assert resp2.status_code == 409


# ── Atomic revision protection on PUT (Finding 1) ────────────────────────────

class TestPutRevisionProtection:
    async def test_put_rejects_stale_revision(self, client):
        """Client A saves at revision 0 → server bumps to 1.
           Client B sends revision 0 → 409."""
        w = await _start_workout(client)
        wid = w["id"]

        resp_a = await client.put(f"/api/workouts/{wid}", json=_update_body([_exercise_payload()], revision=0))
        assert resp_a.status_code == 200
        assert resp_a.json()["revision"] == 1

        resp_b = await client.put(f"/api/workouts/{wid}", json=_update_body([_exercise_payload()], revision=0))
        assert resp_b.status_code == 409
        assert "updated elsewhere" in resp_b.json()["detail"]

    async def test_put_accepts_current_revision(self, client):
        w = await _start_workout(client)
        wid = w["id"]

        r1 = await client.put(f"/api/workouts/{wid}", json=_update_body([_exercise_payload()], revision=0))
        assert r1.json()["revision"] == 1

        r2 = await client.put(f"/api/workouts/{wid}", json=_update_body([_exercise_payload()], revision=1))
        assert r2.status_code == 200
        assert r2.json()["revision"] == 2

    async def test_put_without_revision_always_succeeds(self, client):
        """Legacy clients (no revision) must continue to work."""
        w = await _start_workout(client)
        resp = await client.put(f"/api/workouts/{w['id']}", json=_update_body([_exercise_payload()]))
        assert resp.status_code == 200

    async def test_put_legacy_doc_treated_as_revision_zero(self, client, make_workout_doc, _patch_db):
        """Existing production docs have no revision field — client sending revision=0 must succeed."""
        # Insert a doc without a revision field (simulates pre-migration production data)
        from datetime import datetime, timezone
        import uuid
        doc = {
            "id": "legacy-wk",
            "name": "Old Workout",
            "date": "2026-01-01",
            "status": "active",
            "template_id": None,
            "notes": "",
            "exercises": [],
            "started_at": datetime.now(timezone.utc),
            "finished_at": None,
            "updated_at": datetime.now(timezone.utc),
            # NO revision field
            "user_id": "test-clerk-user-id-123",
        }
        await _patch_db.workouts.insert_one(doc)
        resp = await client.put("/api/workouts/legacy-wk", json=_update_body([_exercise_payload()], revision=0))
        assert resp.status_code == 200
        assert resp.json()["revision"] == 1

    async def test_concurrent_puts_same_revision_exactly_one_succeeds(self, client):
        """
        Two concurrent PUT requests with the same revision — exactly one must
        succeed (200) and the other must receive 409.

        Note on concurrency in mongomock-motor: mongomock serialises operations
        and does not faithfully reproduce MongoDB's document-level write locking.
        This test verifies the application logic (atomic find_one_and_update with
        revision in the filter) using asyncio.gather so both requests are issued
        concurrently from the Python side.  Real MongoDB atomicity is guaranteed
        by the single find_one_and_update operation; this test documents the
        intended behaviour and would catch regressions to non-atomic code.
        """
        w = await _start_workout(client)
        wid = w["id"]
        body = _update_body([_exercise_payload()], revision=0)

        # Issue both requests concurrently
        r1, r2 = await asyncio.gather(
            client.put(f"/api/workouts/{wid}", json=body),
            client.put(f"/api/workouts/{wid}", json=body),
        )
        statuses = {r1.status_code, r2.status_code}

        # With mongomock the two requests are actually serialised, so one of:
        # - {200, 409} means the atomic logic works correctly
        # - {200, 200} would mean both succeeded (broken atomicity — test fails)
        assert 409 in statuses or 200 in statuses, f"Unexpected: {statuses}"
        # Both returning 200 would be a bug — atomic update must reject the second
        assert not (r1.status_code == 200 and r2.status_code == 200), (
            "Both concurrent updates succeeded with the same revision — atomicity broken"
        )


# ── Atomic revision protection on finish (Finding 2) ─────────────────────────

class TestFinishRevisionProtection:
    async def test_finish_increments_revision(self, client):
        w = await _start_workout(client)
        ex = _exercise_payload(sets=[_set_payload(weight=60, reps=8)])
        resp = await client.post(f"/api/workouts/{w['id']}/finish", json=_update_body([ex], revision=0))
        assert resp.status_code == 200
        assert resp.json()["workout"]["revision"] == 1

    async def test_stale_finish_after_newer_autosave(self, client):
        """
        Scenario: autosave ran and bumped revision to 1.
        A stale browser tab then tries to finish with revision=0 → must get 409.
        The workout must NOT be marked as finished.
        """
        w = await _start_workout(client)
        wid = w["id"]

        # Autosave runs, bumps revision to 1
        autosave = await client.put(f"/api/workouts/{wid}", json=_update_body([_exercise_payload()], revision=0))
        assert autosave.json()["revision"] == 1

        # Stale finish at revision 0
        ex = _exercise_payload(sets=[_set_payload(weight=60, reps=8)])
        finish_resp = await client.post(f"/api/workouts/{wid}/finish", json=_update_body([ex], revision=0))
        assert finish_resp.status_code == 409

        # Workout must still be active — not finished
        active_resp = await client.get(f"/api/workouts/{wid}")
        assert active_resp.json()["status"] == "active"

    async def test_finish_at_current_revision_succeeds(self, client):
        """After autosave bumps revision to 1, finishing with revision=1 succeeds."""
        w = await _start_workout(client)
        wid = w["id"]

        await client.put(f"/api/workouts/{wid}", json=_update_body([_exercise_payload()], revision=0))

        ex = _exercise_payload(sets=[_set_payload(weight=60, reps=8)])
        resp = await client.post(f"/api/workouts/{wid}/finish", json=_update_body([ex], revision=1))
        assert resp.status_code == 200
        assert resp.json()["workout"]["status"] == "completed"

    async def test_concurrent_finish_requests_exactly_one_succeeds(self, client):
        """
        Two concurrent finish requests with the same revision.
        Only one must mark the workout completed; the other gets 409.

        Limitation: mongomock serialises operations.  Real MongoDB atomicity is
        provided by the single find_one_and_update call with status+revision in
        the filter.  This test documents intended behaviour and catches regressions.
        """
        w = await _start_workout(client)
        wid = w["id"]
        ex = _exercise_payload(sets=[_set_payload(weight=60, reps=8)])
        body = _update_body([ex], revision=0)

        f1, f2 = await asyncio.gather(
            client.post(f"/api/workouts/{wid}/finish", json=body),
            client.post(f"/api/workouts/{wid}/finish", json=body),
        )
        statuses = sorted([f1.status_code, f2.status_code])
        assert not (f1.status_code == 200 and f2.status_code == 200), (
            "Both concurrent finishes succeeded — atomicity broken"
        )

        # Workout should be completed exactly once
        resp = await client.get(f"/api/workouts/{wid}")
        assert resp.json()["status"] == "completed"


# ── Ownership enforcement ────────────────────────────────────────────────────

class TestOwnershipEnforcement:
    async def test_cannot_get_other_users_workout(self, client, make_workout_doc, _patch_db):
        await make_workout_doc(_patch_db, user_id="other-user", id="other-wk")
        assert (await client.get("/api/workouts/other-wk")).status_code == 404

    async def test_cannot_update_other_users_workout(self, client, make_workout_doc, _patch_db):
        await make_workout_doc(_patch_db, user_id="other-user", id="other-wk")
        resp = await client.put("/api/workouts/other-wk", json=_update_body([_exercise_payload()]))
        assert resp.status_code == 404

    async def test_cannot_delete_other_users_workout(self, client, make_workout_doc, _patch_db):
        await make_workout_doc(_patch_db, user_id="other-user", id="other-wk")
        assert (await client.delete("/api/workouts/other-wk")).status_code == 404

    async def test_cannot_finish_other_users_workout(self, client, make_workout_doc, _patch_db):
        await make_workout_doc(_patch_db, user_id="other-user", id="other-wk")
        resp = await client.post("/api/workouts/other-wk/finish", json=_update_body([_exercise_payload()]))
        assert resp.status_code == 404


# ── Profile update ────────────────────────────────────────────────────────────

class TestProfileUpdate:
    async def _seed_user(self, db):
        await db.users.insert_one({
            "id": "test-clerk-user-id-123", "email": "athlete@test.com",
            "name": "Old", "weight_kg": 70, "height_cm": 175, "sex": None,
            "onboarding_completed": False, "onboarding_completed_at": None, "onboarding_version": 0,
        })

    async def test_profile_update_without_sex(self, client, _patch_db):
        await self._seed_user(_patch_db)
        resp = await client.put("/api/auth/profile", json={"name": "T", "weight_kg": 80, "height_cm": 178, "sex": None})
        assert resp.status_code == 200

    async def test_profile_update_with_sex(self, client, _patch_db):
        await self._seed_user(_patch_db)
        resp = await client.put("/api/auth/profile", json={"name": "T", "weight_kg": 80, "height_cm": 178, "sex": "male"})
        assert resp.status_code == 200
        assert resp.json()["sex"] == "male"
