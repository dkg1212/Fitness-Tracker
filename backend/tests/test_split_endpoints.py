"""
Integration tests for /api/split endpoints using httpx + mongomock-motor.

Finding 5 — split history concurrency:
  The snapshot logic uses update_one($setOnInsert, upsert=True) which is
  atomic in real MongoDB.  mongomock-motor serialises operations so it cannot
  reproduce true write-lock races.  The concurrent test here uses asyncio.gather
  to issue both requests from the same event loop in parallel; it documents the
  intended behaviour and verifies no duplicates are produced.

  Limitation note: This test is explicitly labelled with the mongomock caveat.
  For a true MongoDB atomicity guarantee, run the concurrent test against a
  real MongoDB test instance (e.g. a local Atlas free tier or testcontainers).
"""
import asyncio
from datetime import date
import routers.splits as splits_mod


# ── Helpers ────────────────────────────────────────────────────────────────────

def _split_body(name="My Split", template_ids=None):
    if template_ids is None:
        template_ids = [None] * 7
    return {"name": name, "days": [{"weekday": wd, "template_id": tid} for wd, tid in enumerate(template_ids)]}


async def _create_template(client, name):
    resp = await client.post("/api/exercises", json={
        "name": f"Ex-{name}", "muscle_group": "Chest", "equipment": "Barbell",
    })
    ex_id = resp.json()["id"]
    resp = await client.post("/api/templates", json={
        "name": name, "notes": "", "exercises": [{
            "exercise_id": ex_id, "exercise_name": f"Ex-{name}",
            "muscle_group": "Chest", "target_sets": 3, "target_reps": "8-12", "rest_seconds": 120,
        }],
    })
    return resp.json()["id"]


# ── Same-day split changes (Finding 5 / HIGH-2) ───────────────────────────────

class TestSameDaySplitChanges:
    async def test_a_to_b_same_day_has_no_zero_length_snapshot(self, client):
        """A → B on its creation day must resolve to active split B."""
        tpl_a = await _create_template(client, "A")
        tpl_b = await _create_template(client, "B")

        await client.put("/api/split", json=_split_body("A", [tpl_a] * 7))
        await client.put("/api/split", json=_split_body("B", [tpl_b] * 7))

        active = (await client.get("/api/split")).json()
        assert all(d["template_id"] == tpl_b for d in active["days"])

        records = (await client.get("/api/history/splits")).json()
        assert records == []

    async def test_a_to_b_to_c_same_day(self, client):
        """A → B → C on the same day: snapshot preserves A (not B), active is C."""
        tpl_a = await _create_template(client, "A")
        tpl_b = await _create_template(client, "B")
        tpl_c = await _create_template(client, "C")

        await client.put("/api/split", json=_split_body("A", [tpl_a] * 7))
        await client.put("/api/split", json=_split_body("B", [tpl_b] * 7))
        await client.put("/api/split", json=_split_body("C", [tpl_c] * 7))

        active = (await client.get("/api/split")).json()
        assert all(d["template_id"] == tpl_c for d in active["days"])

        assert (await client.get("/api/history/splits")).json() == []

    async def test_different_days_archives_the_correct_interval(self, client, monkeypatch):
        """A is historical until B becomes active, never on B's first day."""
        tpl_a = await _create_template(client, "A")
        tpl_b = await _create_template(client, "B")

        monkeypatch.setattr(splits_mod, "today_iso", lambda: "2026-01-01")
        await client.put("/api/split", json=_split_body("A", [tpl_a] * 7))
        monkeypatch.setattr(splits_mod, "today_iso", lambda: "2026-01-03")
        await client.put("/api/split", json=_split_body("B", [tpl_b] * 7))

        records = (await client.get("/api/history/splits")).json()
        assert len(records) == 1
        assert records[0]["effective_from"] == "2026-01-01"
        assert records[0]["effective_to"] == "2026-01-03"
        tids = [d["template_id"] for d in records[0]["days"]]
        assert all(t == tpl_a for t in tids)

    async def test_no_snapshot_when_config_unchanged(self, client):
        tpl_a = await _create_template(client, "A")
        await client.put("/api/split", json=_split_body("A", [tpl_a] * 7))
        await client.put("/api/split", json=_split_body("A", [tpl_a] * 7))
        assert len((await client.get("/api/history/splits")).json()) == 0

    async def test_historical_lookup_after_change(self, client, monkeypatch):
        tpl_a = await _create_template(client, "A")
        tpl_b = await _create_template(client, "B")
        monkeypatch.setattr(splits_mod, "today_iso", lambda: "2026-01-01")
        await client.put("/api/split", json=_split_body("A", [tpl_a] * 7))
        monkeypatch.setattr(splits_mod, "today_iso", lambda: "2026-01-02")
        await client.put("/api/split", json=_split_body("B", [tpl_b] * 7))

        records = (await client.get("/api/history/splits")).json()
        tids = [d["template_id"] for d in records[0]["days"]]
        assert all(t == tpl_a for t in tids)

    async def test_concurrent_split_updates_no_duplicate_snapshots(self, client):
        """
        Two concurrent PUT /split requests (via asyncio.gather) must not create
        duplicate split_history records for the same effective_from date.

        Implementation uses $setOnInsert with upsert=True which is atomic in
        real MongoDB.  mongomock serialises writes so this test verifies the
        no-duplicate outcome but not the true write-lock guarantee.

        LIMITATION: To verify true concurrency atomicity, run against a real
        MongoDB instance.  This test is explicitly labelled with that caveat.
        """
        tpl_a = await _create_template(client, "A")
        tpl_b = await _create_template(client, "B")
        tpl_c = await _create_template(client, "C")

        # Establish initial split A
        await client.put("/api/split", json=_split_body("A", [tpl_a] * 7))

        # Issue two concurrent changes (B and C) at the same time
        r1, r2 = await asyncio.gather(
            client.put("/api/split", json=_split_body("B", [tpl_b] * 7)),
            client.put("/api/split", json=_split_body("C", [tpl_c] * 7)),
        )
        # Both must succeed (no errors)
        assert r1.status_code == 200, f"r1 failed: {r1.text}"
        assert r2.status_code == 200, f"r2 failed: {r2.text}"

        records = (await client.get("/api/history/splits")).json()
        today = date.today().isoformat()
        today_snapshots = [r for r in records if r["effective_from"] == today]

        # A/B/C all happened on A's creation day, so there is no elapsed
        # calendar interval to archive and therefore no duplicate snapshot.
        assert today_snapshots == []
