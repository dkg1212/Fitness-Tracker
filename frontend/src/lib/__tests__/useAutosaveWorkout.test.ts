/**
 * Vitest unit tests for lib/useAutosaveWorkout.ts
 * Covers HIGH-1: cross-user local draft exposure prevention.
 *
 * Ownership rules tested:
 * - Every stored draft carries an `owner` field matching the Clerk user ID.
 * - readLocalDraft never restores a draft whose owner doesn't match userId.
 * - Legacy unscoped active-id key is never read for authenticated users.
 * - Explicit workout IDs are still ownership-validated.
 * - User B cannot read User A's draft.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  activeIdKey,
  ACTIVE_ID_KEY,
  readLocalDraft,
  clearLocalDraft,
} from "../useAutosaveWorkout";
import type { Workout } from "../types";

// ── Mock localStorage ────────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

const localStorageMock = {
  getItem: (key: string): string | null => store[key] ?? null,
  setItem: (key: string, value: string): void => { store[key] = value; },
  removeItem: (key: string): void => { delete store[key]; },
  clear: (): void => { for (const k of Object.keys(store)) delete store[k]; },
};

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("navigator", { onLine: true });

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWorkout(id: string, status: "active" | "completed" = "active"): Workout {
  return {
    id,
    name: "Test",
    date: "2026-01-01",
    status,
    template_id: null,
    notes: "",
    exercises: [],
    started_at: "2026-01-01T18:00:00Z",
    finished_at: null,
    updated_at: "2026-01-01T18:00:00Z",
    revision: 0,
  };
}

function writeDraft(id: string, workout: Workout, dirty: boolean, owner?: string) {
  store[`ironcore:draft:${id}`] = JSON.stringify({
    workout,
    dirty,
    ts: Date.now(),
    owner,
  });
}

// ── activeIdKey ────────────────────────────────────────────────────────────────

describe("activeIdKey", () => {
  it("scopes by userId when provided", () => {
    expect(activeIdKey("user_a")).toBe("ironcore:active-id:user_a");
    expect(activeIdKey("user_b")).toBe("ironcore:active-id:user_b");
  });

  it("falls back to legacy unscoped key when userId is null/undefined", () => {
    expect(activeIdKey(null)).toBe("ironcore:active-id");
    expect(activeIdKey(undefined)).toBe("ironcore:active-id");
  });

  it("different users get different keys", () => {
    expect(activeIdKey("user_a")).not.toBe(activeIdKey("user_b"));
  });
});

// ── readLocalDraft ownership ───────────────────────────────────────────────────

describe("readLocalDraft ownership enforcement", () => {
  it("reads own draft by explicit id", () => {
    const w = makeWorkout("wk1");
    writeDraft("wk1", w, true, "user_a");
    const result = readLocalDraft("wk1", "user_a");
    expect(result?.id).toBe("wk1");
  });

  it("cannot read another user's draft by explicit id", () => {
    const w = makeWorkout("wk1");
    writeDraft("wk1", w, true, "user_a");
    const result = readLocalDraft("wk1", "user_b");
    expect(result).toBeNull();
  });

  it("reads own draft via scoped active-id key", () => {
    const w = makeWorkout("wk-scoped");
    writeDraft("wk-scoped", w, true, "user_a");
    store[activeIdKey("user_a")] = "wk-scoped";
    const result = readLocalDraft(undefined, "user_a");
    expect(result?.id).toBe("wk-scoped");
  });

  it("does not read another user's draft via scoped key", () => {
    const w = makeWorkout("wk-user-a");
    writeDraft("wk-user-a", w, true, "user_a");
    store[activeIdKey("user_a")] = "wk-user-a";
    // User B's scoped key doesn't point to user A's draft
    const result = readLocalDraft(undefined, "user_b");
    expect(result).toBeNull();
  });

  it("User B cannot read User A's draft — full isolation", () => {
    // User A writes a dirty draft and sets their active-id pointer
    const w = makeWorkout("wk-a");
    writeDraft("wk-a", w, true, "user_a");
    store[activeIdKey("user_a")] = "wk-a";

    // User B looks up their own active-id — should find nothing
    expect(readLocalDraft(undefined, "user_b")).toBeNull();

    // User B tries to read user A's draft by explicit id — blocked by ownership
    expect(readLocalDraft("wk-a", "user_b")).toBeNull();
  });

  it("does not restore unowned legacy draft for authenticated user", () => {
    // Old draft without owner field — should NOT be restored for any user
    const w = makeWorkout("wk-legacy");
    writeDraft("wk-legacy", w, true); // no owner
    store[ACTIVE_ID_KEY] = "wk-legacy";
    store[activeIdKey("user_a")] = "wk-legacy";
    // Authenticated user should not get the legacy draft
    expect(readLocalDraft(undefined, "user_a")).toBeNull();
  });

  it("does not read legacy unscoped key for authenticated user", () => {
    const w = makeWorkout("wk-legacy");
    writeDraft("wk-legacy", w, true, "user_a");
    store[ACTIVE_ID_KEY] = "wk-legacy";
    // User A has NO scoped key — only the legacy unscoped key exists.
    // The function should NOT fall back to the legacy key for authenticated users.
    expect(readLocalDraft(undefined, "user_a")).toBeNull();
  });

  it("returns null when userId is null and no explicit id", () => {
    const w = makeWorkout("wk1");
    writeDraft("wk1", w, true, "user_a");
    store[activeIdKey("user_a")] = "wk1";
    // No userId → cannot verify ownership → refuse to restore
    expect(readLocalDraft(undefined, null)).toBeNull();
    expect(readLocalDraft(undefined, undefined)).toBeNull();
  });

  it("returns null when no draft exists", () => {
    expect(readLocalDraft(undefined, "user_x")).toBeNull();
  });

  it("returns null for non-active workout when resolving by active-id", () => {
    const w = makeWorkout("wk-done", "completed");
    writeDraft("wk-done", w, true, "user_a");
    store[activeIdKey("user_a")] = "wk-done";
    expect(readLocalDraft(undefined, "user_a")).toBeNull();
  });

  it("returns the draft when resolving by explicit id even if completed", () => {
    const w = makeWorkout("wk-done", "completed");
    writeDraft("wk-done", w, true, "user_a");
    const result = readLocalDraft("wk-done", "user_a");
    expect(result?.id).toBe("wk-done");
  });

  it("unowned draft cannot be read by explicit id when userId is provided", () => {
    // Draft with no owner field — cannot be restored for any authenticated user
    const w = makeWorkout("wk-unowned");
    writeDraft("wk-unowned", w, true); // no owner
    expect(readLocalDraft("wk-unowned", "user_a")).toBeNull();
  });
});

// ── clearLocalDraft ────────────────────────────────────────────────────────────

describe("clearLocalDraft", () => {
  it("removes the draft entry", () => {
    writeDraft("wk1", makeWorkout("wk1"), true, "user_a");
    clearLocalDraft("wk1", "user_a");
    expect(store["ironcore:draft:wk1"]).toBeUndefined();
  });

  it("removes the scoped active-id pointer", () => {
    writeDraft("wk1", makeWorkout("wk1"), true, "user_a");
    store[activeIdKey("user_a")] = "wk1";
    clearLocalDraft("wk1", "user_a");
    expect(store[activeIdKey("user_a")]).toBeUndefined();
  });

  it("removes the legacy unscoped pointer", () => {
    writeDraft("wk1", makeWorkout("wk1"), true, "user_a");
    store[ACTIVE_ID_KEY] = "wk1";
    clearLocalDraft("wk1", "user_a");
    expect(store[ACTIVE_ID_KEY]).toBeUndefined();
  });

  it("does not remove another user's pointer", () => {
    writeDraft("wk1", makeWorkout("wk1"), true, "user_a");
    store[activeIdKey("user_a")] = "wk1";
    store[activeIdKey("user_b")] = "wk2";
    clearLocalDraft("wk1", "user_a");
    expect(store[activeIdKey("user_a")]).toBeUndefined();
    expect(store[activeIdKey("user_b")]).toBe("wk2");
  });
});
