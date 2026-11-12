import { useCallback, useEffect, useRef, useState } from "react";
import { apiPut, ApiError } from "./api";
import type { Workout } from "./types";
import { toUpdate } from "./workout";

export type SyncState = "saved" | "pending" | "saving" | "offline" | "error" | "conflict";

const draftKey = (id: string) => `ironcore:draft:${id}`;

/**
 * Active-workout-ID pointer scoped by Clerk user ID.
 * When userId is null/undefined drafts are not read or written via active-id,
 * preventing cross-account exposure on shared devices.
 */
export const activeIdKey = (userId?: string | null): string =>
  userId ? `ironcore:active-id:${userId}` : "ironcore:active-id";

/** @deprecated Use activeIdKey(userId) instead. Kept for migration reads. */
export const ACTIVE_ID_KEY = "ironcore:active-id";

interface StoredDraft {
  workout: Workout;
  dirty: boolean;
  ts: number;
  /** Clerk user ID — the owner of this draft. Unowned drafts are never restored. */
  owner?: string;
}

function readStored(id: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

function writeStored(w: Workout, dirty: boolean, userId?: string | null) {
  try {
    localStorage.setItem(
      draftKey(w.id),
      JSON.stringify({ workout: w, dirty, ts: Date.now(), owner: userId ?? undefined } satisfies StoredDraft),
    );
  } catch {
    /* storage full / disabled — server autosave still runs */
  }
}

function writeActiveId(w: Workout, userId?: string | null) {
  if (w.status !== "active" || !userId) return;
  try {
    localStorage.setItem(activeIdKey(userId), w.id);
  } catch {
    /* storage quota exceeded */
  }
}

/**
 * Read a locally-stored draft for offline recovery.
 *
 * Ownership rules (Finding 1):
 * - Authenticated users (userId provided) can only read drafts they own.
 * - Legacy drafts without an owner field are never restored for authenticated users.
 * - The legacy unscoped active-id key is never read for authenticated users.
 * - When userId is null/undefined, only an explicit id can be used (no active-id lookup).
 */
export function readLocalDraft(id?: string, userId?: string | null): Workout | null {
  if (id) {
    const stored = readStored(id);
    if (!stored) return null;
    if (userId && stored.owner && stored.owner !== userId) return null;
    if (userId && !stored.owner) return null; // unowned draft
    return stored.workout;
  }

  if (!userId) return null; // cannot verify ownership without userId

  const scopedKey = activeIdKey(userId);
  const key = localStorage.getItem(scopedKey);
  if (!key) return null;

  const stored = readStored(key);
  if (!stored) return null;
  if (stored.owner !== userId) return null;
  if (stored.workout.status !== "active") return null;
  return stored.workout;
}

export function clearLocalDraft(id: string, userId?: string | null) {
  localStorage.removeItem(draftKey(id));
  if (userId) {
    const scopedKey = activeIdKey(userId);
    if (localStorage.getItem(scopedKey) === id) localStorage.removeItem(scopedKey);
  }
  if (localStorage.getItem(ACTIVE_ID_KEY) === id) localStorage.removeItem(ACTIVE_ID_KEY);
}

/**
 * Local-first workout draft with autosave and optimistic concurrency.
 *
 * Finding 3 — conflict retry suppression:
 *   On HTTP 409 the hook enters "conflict" state and stops all automatic flushing.
 *   It stays in conflict until the user explicitly resolves (reload button).
 *   The local draft is preserved so no edits are silently lost.
 *
 * Finding 1 — user isolation:
 *   Every draft stored to localStorage carries an `owner` field.
 *   Drafts without an owner, or whose owner doesn't match userId, are never restored.
 */
export function useAutosaveWorkout(initial: Workout, userId?: string | null) {
  const [restored] = useState<Workout | null>(() => {
    const s = readStored(initial.id);
    if (!s || !s.dirty) return null;
    if (userId && s.owner !== userId) return null;
    const serverTs = initial.updated_at ? new Date(initial.updated_at).getTime() : 0;
    if (s.ts < serverTs) {
      localStorage.removeItem(draftKey(initial.id));
      return null;
    }
    return s.workout;
  });

  const [draft, setDraft] = useState<Workout>(restored ?? initial);
  const [sync, setSync] = useState<SyncState>(restored ? "pending" : "saved");

  const draftRef = useRef<Workout>(restored ?? initial);
  const dirtyRef = useRef<boolean>(!!restored);
  // Use a ref to track conflict state inside callbacks without stale closures.
  const syncRef = useRef<SyncState>(restored ? "pending" : "saved");
  const inflightRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const retryRef = useRef<number | undefined>(undefined);

  // Keep syncRef in sync with the state value.
  const setSyncBoth = useCallback((s: SyncState | ((prev: SyncState) => SyncState)) => {
    setSync((prev) => {
      const next = typeof s === "function" ? s(prev) : s;
      syncRef.current = next;
      return next;
    });
  }, []);

  const flush = useCallback(async (): Promise<"ok" | "conflict" | "offline" | "error"> => {
    window.clearTimeout(timerRef.current);
    if (inflightRef.current) {
      await inflightRef.current;
      if (dirtyRef.current) return flush();
      return "ok";
    }
    if (!dirtyRef.current) return "ok";
    if (!navigator.onLine) {
      setSyncBoth("offline");
      return "offline";
    }

    const snapshot = draftRef.current;
    dirtyRef.current = false;
    setSyncBoth("saving");

    let flushResult: "ok" | "conflict" | "offline" | "error" = "ok";

    const run = (async () => {
      try {
        // Read revision from draftRef at the moment of the fetch call, not from
        // the snapshot. This handles the case where a previous flush resolved
        // and updated draftRef.current.revision while this flush was waiting in
        // the inflightRef queue — using the snapshot revision would send a stale
        // value and cause a 409 on a single-user, single-device session.
        const revision = draftRef.current.revision ?? 0;
        const res = await apiPut<Workout>(`/workouts/${snapshot.id}`, {
          ...toUpdate(snapshot),
          revision,
        });
        // Update ONLY the revision field — never overwrite the whole object.
        // The user may have made more edits while this PUT was in-flight; those
        // edits live in draftRef.current and must not be clobbered.
        if (res && typeof res === "object" && "revision" in res) {
          const serverRevision = (res as Workout).revision ?? (revision + 1);
          draftRef.current = { ...draftRef.current, revision: serverRevision };
          // Mirror into React state so finishM.mutationFn / toUpdate(draft) also
          // sees the latest revision without needing to call getLatest().
          setDraft((prev) => ({ ...prev, revision: serverRevision }));
        }
        if (dirtyRef.current) {
          setSyncBoth("pending");
        } else {
          writeStored(draftRef.current, false, userId);
          setSyncBoth("saved");
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          // 409 from PUT: this should not happen with the unconditional backend.
          // If it somehow does (e.g. workout was deleted), treat as transient error
          // and retry — do NOT enter conflict state from an autosave.
          dirtyRef.current = true;
          setSyncBoth(navigator.onLine ? "error" : "offline");
          window.clearTimeout(retryRef.current);
          retryRef.current = window.setTimeout(() => void flush(), 5000);
          return;
        }
        // Transient error — retry after 5 s.
        dirtyRef.current = true;
        setSyncBoth(navigator.onLine ? "error" : "offline");
        flushResult = navigator.onLine ? "error" : "offline";
        window.clearTimeout(retryRef.current);
        retryRef.current = window.setTimeout(() => void flush(), 5000);
      }
    })();

    inflightRef.current = run;
    await run;
    inflightRef.current = null;

    // Schedule a follow-up flush if more edits arrived while this PUT was in-flight.
    if (dirtyRef.current && navigator.onLine) {
      timerRef.current = window.setTimeout(() => void flush(), 600);
    }

    return flushResult;
  }, [userId, setSyncBoth]);

  const update = useCallback(
    (fn: (w: Workout) => Workout) => {
      const next = fn(draftRef.current);
      draftRef.current = next;
      dirtyRef.current = true;
      setDraft(next);
      writeStored(next, true, userId);
      writeActiveId(next, userId);
      setSyncBoth(navigator.onLine ? "pending" : "offline");
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void flush(), 700);
    },
    [flush, userId, setSyncBoth],
  );

  useEffect(() => {
    if (initial.status === "active") writeActiveId(initial, userId);
    if (dirtyRef.current) void flush();
    const onOnline = () => void flush();
    const onOffline = () => dirtyRef.current && setSyncBoth("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearTimeout(timerRef.current);
      window.clearTimeout(retryRef.current);
    };
  }, [flush, initial.id, initial.status, initial.updated_at, userId, setSyncBoth]);

  return { draft, update, sync, restored: !!restored, flush, getLatest: () => draftRef.current };
}
