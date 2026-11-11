/**
 * Vitest unit tests for lib/useAutosaveWorkout.ts
 * Covers: activeIdKey scoping (Section 5 — user isolation),
 *         readLocalDraft user-scoped lookup, clearLocalDraft cleanup.
 *
 * These tests exercise the localStorage key management functions directly
 * without mounting React components (no jsdom needed).
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
  // Clear the mock store before each test
  for (const k of Object.keys(store)) delete store[k];
});

// Minimal localStorage mock
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
  };
}

function writeDraft(id: string, workout: Workout, dirty: boolean) {
  store[`ironcore:draft:${id}`] = JSON.stringify({
    workout,
    dirty,
    ts: Date.now(),
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

  it("ACTIVE_ID_KEY constant matches legacy key", () => {
    expect(ACTIVE_ID_KEY).toBe("ironcore:active-id");
  });

  it("different users get different keys", () => {
    expect(activeIdKey("user_a")).not.toBe(activeIdKey("user_b"));
  });
});

// ── readLocalDraft ─────────────────────────────────────────────────────────────

describe("readLocalDraft", () => {
  it("reads by explicit id regardless of user", () => {
    const w = makeWorkout("wk1");
    writeDraft("wk1", w, true);
    const result = readLocalDraft("wk1", "user_a");
    expect(result?.id).toBe("wk1");
  });

  it("reads via scoped active-id key for the given user", () => {
    const w = makeWorkout("wk-scoped");
    writeDraft("wk-scoped", w, true);
    store[activeIdKey("user_a")] = "wk-scoped";
    const result = readLocalDraft(undefined, "user_a");
    expect(result?.id).toBe("wk-scoped");
  });

  it("does not read another user's draft via scoped key", () => {
    const w = makeWorkout("wk-user-a");
    writeDraft("wk-user-a", w, true);
    store[activeIdKey("user_a")] = "wk-user-a";
    // User B should NOT see user A's draft via the scoped key
    const result = readLocalDraft(undefined, "user_b");
    expect(result).toBeNull();
  });

  it("falls back to legacy unscoped key", () => {
    const w = makeWorkout("wk-legacy");
    writeDraft("wk-legacy", w, true);
    store[ACTIVE_ID_KEY] = "wk-legacy";
    const result = readLocalDraft(undefined, undefined);
    expect(result?.id).toBe("wk-legacy");
  });

  it("returns null when no draft exists", () => {
    expect(readLocalDraft(undefined, "user_x")).toBeNull();
  });

  it("returns null for non-active workout when resolving by active-id", () => {
    const w = makeWorkout("wk-done", "completed");
    writeDraft("wk-done", w, true);
    store[activeIdKey("user_a")] = "wk-done";
    expect(readLocalDraft(undefined, "user_a")).toBeNull();
  });

  it("returns the draft when resolving by explicit id even if completed", () => {
    const w = makeWorkout("wk-done", "completed");
    writeDraft("wk-done", w, true);
    const result = readLocalDraft("wk-done", "user_a");
    expect(result?.id).toBe("wk-done");
  });
});

// ── clearLocalDraft ────────────────────────────────────────────────────────────

describe("clearLocalDraft", () => {
  it("removes the draft entry", () => {
    writeDraft("wk1", makeWorkout("wk1"), true);
    clearLocalDraft("wk1", "user_a");
    expect(store["ironcore:draft:wk1"]).toBeUndefined();
  });

  it("removes the scoped active-id pointer", () => {
    writeDraft("wk1", makeWorkout("wk1"), true);
    store[activeIdKey("user_a")] = "wk1";
    clearLocalDraft("wk1", "user_a");
    expect(store[activeIdKey("user_a")]).toBeUndefined();
  });

  it("removes the legacy unscoped pointer", () => {
    writeDraft("wk1", makeWorkout("wk1"), true);
    store[ACTIVE_ID_KEY] = "wk1";
    clearLocalDraft("wk1", "user_a");
    expect(store[ACTIVE_ID_KEY]).toBeUndefined();
  });

  it("does not remove another user's pointer", () => {
    writeDraft("wk1", makeWorkout("wk1"), true);
    store[activeIdKey("user_a")] = "wk1";
    store[activeIdKey("user_b")] = "wk2";
    clearLocalDraft("wk1", "user_a");
    expect(store[activeIdKey("user_a")]).toBeUndefined();
    expect(store[activeIdKey("user_b")]).toBe("wk2");
  });
});
