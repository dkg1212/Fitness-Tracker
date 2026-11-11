import { useCallback, useEffect, useRef, useState } from "react";
import { apiPut, ApiError } from "./api";
import type { Workout } from "./types";
import { toUpdate } from "./workout";

export type SyncState = "saved" | "pending" | "saving" | "offline" | "error" | "conflict";

/**
 * Every stored draft carries an explicit `owner` field matching the Clerk user
 * ID of the account that created it.  A draft whose owner does not match the
 * current user is never restored, preventing cross-user exposure on shared
 * devices.
 */
const draftKey = (id: string) => `ironcore:draft:${id}`;

/**
 * Active-workout-ID pointer scoped by Clerk user ID.
 *
 * Pass the Clerk userId from useAuth().  When userId is null/undefined (e.g.
 * during initial Clerk load) no pointer is written or read — drafts are only
 * restored once the current user can be verified.
 */
export const activeIdKey = (userId?: string | null): string =>
  userId ? `ironcore:active-id:${userId}` : "ironcore:active-id";

/** @deprecated Use activeIdKey(userId) instead. Kept for migration reads. */
export const ACTIVE_ID_KEY = "ironcore:active-id";

interface StoredDraft {
  workout: Workout;
  dirty: boolean;
  ts: number;
  /** Clerk user ID — the owner of this draft.  Old drafts without this field
   *  are treated as unowned and will not be restored for any authenticated user. */
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
 * A locally-stored draft for offline recovery (used when the server can't be
 * reached on load).
 *
 * Ownership rules (HIGH-1):
 * - If `userId` is provided, only drafts whose `owner` matches are returned.
 * - If `userId` is null/undefined (Clerk not yet loaded), never restore a draft
 *   by active-id lookup — only an explicit `id` can bypass this (the caller
 *   already received that workout from the server, so ownership was verified
 *   server-side).
 * - Legacy drafts without an `owner` field are never restored for
 *   authenticated users.  This is the safe choice: a draft whose provenance
 *   cannot be verified is treated as untrusted.
 * - The legacy unscoped `ironcore:active-id` key is never read for
 *   authenticated users — only the user-scoped key is used.
 */
export function readLocalDraft(id?: string, userId?: string | null): Workout | null {
  if (id) {
    // Explicit ID — the caller received this workout from the server (or is
    // re-entering an editor they already own).  Still verify ownership when a
    // userId is available so a crafted URL can't surface another user's draft.
    const stored = readStored(id);
    if (!stored) return null;
    if (userId && stored.owner && stored.owner !== userId) return null;
    if (userId && !stored.owner) return null; // unowned draft — don't restore
    return stored.workout;
  }

  // Active-id lookup — only for authenticated users via the scoped key.
  if (!userId) return null;

  const scopedKey = activeIdKey(userId);
  const key = localStorage.getItem(scopedKey);
  if (!key) return null;

  const stored = readStored(key);
  if (!stored) return null;
  // Ownership check — never restore a draft that doesn't belong to this user.
  if (stored.owner !== userId) return null;
  if (stored.workout.status !== "active") return null;
  return stored.workout;
}

export function clearLocalDraft(id: string, userId?: string | null) {
  localStorage.removeItem(draftKey(id));
  if (userId) {
    const scopedKey = activeIdKey(userId);
    if (localStorage.getItem(scopedKey) === id) {
      localStorage.removeItem(scopedKey);
    }
  }
  // Also clear legacy unscoped key if it points to this workout
  if (localStorage.getItem(ACTIVE_ID_KEY) === id) {
    localStorage.removeItem(ACTIVE_ID_KEY);
  }
}

/**
 * Local-first workout draft: every edit is mirrored to localStorage immediately
 * and debounced to PUT /workouts/{id}. Unsynced edits survive refreshes and
 * reconnect automatically.
 *
 * Pass `userId` (from useAuth().userId) to scope the active-draft pointer to
 * the current account so multi-account devices stay isolated (HIGH-1).
 *
 * Optimistic concurrency (HIGH-4): the server rejects stale PUTs with HTTP 409
 * when its `revision` is newer than the client's.  On 409 the hook transitions
 * to `sync="conflict"` so the UI can prompt the user to reload.
 */
export function useAutosaveWorkout(initial: Workout, userId?: string | null) {
  const [restored] = useState<Workout | null>(() => {
    const s = readStored(initial.id);
    if (!s || !s.dirty) return null;
    // Ownership: only restore drafts that belong to the current user.
    if (userId && s.owner !== userId) return null;
    // Stale-draft guard: if the server's updated_at is newer than the local
    // draft timestamp, the server has newer data — discard the local draft.
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
  const inflightRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const retryRef = useRef<number | undefined>(undefined);

  const flush = useCallback(async (): Promise<void> => {
    window.clearTimeout(timerRef.current);
    if (inflightRef.current) {
      await inflightRef.current;
      if (dirtyRef.current) return flush();
      return;
    }
    if (!dirtyRef.current) return;
    if (!navigator.onLine) {
      setSync("offline");
      return;
    }
    const snapshot = draftRef.current;
    dirtyRef.current = false;
    setSync("saving");
    const run = (async () => {
      try {
        // Send revision for optimistic concurrency (HIGH-4).
        // The server returns 409 if its revision is newer.
        const revision = snapshot.revision ?? 0;
        const res = await apiPut<Workout>(`/workouts/${snapshot.id}`, {
          ...toUpdate(snapshot),
          revision,
        });
        // Update local revision from server response.
        if (res && typeof res === "object" && "revision" in res) {
          draftRef.current = { ...draftRef.current, revision: (res as Workout).revision };
        }
        if (dirtyRef.current) {
          setSync("pending");
        } else {
          writeStored(draftRef.current, false, userId);
          setSync("saved");
        }
      } catch (err) {
        // HIGH-4: server returned 409 — a stale tab is trying to overwrite
        // newer data.  Surface as a conflict rather than retrying.
        if (err instanceof ApiError && err.status === 409) {
          setSync("conflict");
          dirtyRef.current = true; // keep the local draft for recovery
          return;
        }
        dirtyRef.current = true;
        setSync(navigator.onLine ? "error" : "offline");
        window.clearTimeout(retryRef.current);
        retryRef.current = window.setTimeout(() => void flush(), 5000);
      }
    })();
    inflightRef.current = run;
    await run;
    inflightRef.current = null;
    if (dirtyRef.current && navigator.onLine) {
      timerRef.current = window.setTimeout(() => void flush(), 600);
    }
  }, [userId]);

  const update = useCallback(
    (fn: (w: Workout) => Workout) => {
      const next = fn(draftRef.current);
      draftRef.current = next;
      dirtyRef.current = true;
      setDraft(next);
      writeStored(next, true, userId);
      writeActiveId(next, userId);
      setSync(navigator.onLine ? "pending" : "offline");
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void flush(), 700);
    },
    [flush, userId],
  );

  useEffect(() => {
    if (initial.status === "active") {
      writeActiveId(initial, userId);
    }
    if (dirtyRef.current) void flush();
    const onOnline = () => void flush();
    const onOffline = () => dirtyRef.current && setSync("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearTimeout(timerRef.current);
      window.clearTimeout(retryRef.current);
    };
  }, [flush, initial.id, initial.status, initial.updated_at, userId]);

  return { draft, update, sync, restored: !!restored, flush };
}
