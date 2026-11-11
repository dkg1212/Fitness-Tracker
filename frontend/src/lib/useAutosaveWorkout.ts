import { useCallback, useEffect, useRef, useState } from "react";
import { apiPut } from "./api";
import type { Workout } from "./types";
import { toUpdate } from "./workout";

export type SyncState = "saved" | "pending" | "saving" | "offline" | "error";

const draftKey = (id: string) => `ironcore:draft:${id}`;

/**
 * Active-workout-ID pointer scoped by Clerk user ID.
 *
 * Section 5 (autosave isolation): when two Clerk accounts share a device the
 * active-id key is now different for each user, so account A's unfinished
 * workout is never surfaced when account B opens the logger.
 *
 * Pass the Clerk userId from useAuth().  Falls back to the legacy unscoped key
 * when userId is not yet available so existing drafts are not silently lost on
 * the first load.
 */
export const activeIdKey = (userId?: string | null): string =>
  userId ? `ironcore:active-id:${userId}` : "ironcore:active-id";

/** @deprecated Use activeIdKey(userId) instead. Kept for migration reads. */
export const ACTIVE_ID_KEY = "ironcore:active-id";

interface StoredDraft { workout: Workout; dirty: boolean; ts: number }

function readStored(id: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

function writeStored(w: Workout, dirty: boolean) {
  try {
    localStorage.setItem(draftKey(w.id), JSON.stringify({ workout: w, dirty, ts: Date.now() } satisfies StoredDraft));
  } catch {
    /* storage full / disabled — server autosave still runs */
  }
}

function writeActiveId(w: Workout, userId?: string | null) {
  if (w.status !== "active") return;
  try {
    localStorage.setItem(activeIdKey(userId), w.id);
  } catch {
    /* storage quota exceeded */
  }
}

/** A locally-stored draft for offline recovery (used when the server can't be reached on load). */
export function readLocalDraft(id?: string, userId?: string | null): Workout | null {
  // Resolve the active workout ID from the user-scoped key first, then fall
  // back to the legacy unscoped key for accounts that haven't written a new
  // draft yet after this update.
  const scopedKey = activeIdKey(userId);
  const key = id
    ?? localStorage.getItem(scopedKey)
    ?? localStorage.getItem(ACTIVE_ID_KEY);
  if (!key) return null;
  const stored = readStored(key);
  if (!stored) return null;
  if (!id && stored.workout.status !== "active") return null;
  return stored.workout;
}

export function clearLocalDraft(id: string, userId?: string | null) {
  localStorage.removeItem(draftKey(id));
  const scopedKey = activeIdKey(userId);
  if (localStorage.getItem(scopedKey) === id) {
    localStorage.removeItem(scopedKey);
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
 * the current account so multi-account devices stay isolated (Section 5).
 */
export function useAutosaveWorkout(initial: Workout, userId?: string | null) {
  const [restored] = useState<Workout | null>(() => {
    const s = readStored(initial.id);
    // Only restore if the draft is marked dirty AND its server timestamp is not
    // newer than the initial workout we received from the server.  This prevents
    // an older local draft from silently overwriting a newer server save that
    // occurred on another device (Section 5 — avoid overwriting newer server data).
    if (!s || !s.dirty) return null;
    const serverTs = initial.updated_at ? new Date(initial.updated_at).getTime() : 0;
    if (s.ts < serverTs) {
      // Server data is newer — discard the stale local draft
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
        await apiPut<Workout>(`/workouts/${snapshot.id}`, toUpdate(snapshot));
        if (dirtyRef.current) {
          setSync("pending");
        } else {
          writeStored(draftRef.current, false);
          setSync("saved");
        }
      } catch {
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
  }, []);

  const update = useCallback(
    (fn: (w: Workout) => Workout) => {
      const next = fn(draftRef.current);
      draftRef.current = next;
      dirtyRef.current = true;
      setDraft(next);
      writeStored(next, true);
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
