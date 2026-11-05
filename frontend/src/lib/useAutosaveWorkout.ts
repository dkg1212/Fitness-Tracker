import { useCallback, useEffect, useRef, useState } from "react";
import { apiPut } from "./api";
import type { Workout } from "./types";
import { toUpdate } from "./workout";

export type SyncState = "saved" | "pending" | "saving" | "offline" | "error";

const draftKey = (id: string) => `ironcore:draft:${id}`;
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
    if (w.status === "active") localStorage.setItem(ACTIVE_ID_KEY, w.id);
  } catch {
    /* storage full / disabled — server autosave still runs */
  }
}

/** A locally-stored draft for offline recovery (used when the server can't be reached on load). */
export function readLocalDraft(id?: string): Workout | null {
  const key = id ?? localStorage.getItem(ACTIVE_ID_KEY);
  if (!key) return null;
  const stored = readStored(key);
  if (!stored) return null;
  if (!id && stored.workout.status !== "active") return null;
  return stored.workout;
}

export function clearLocalDraft(id: string) {
  localStorage.removeItem(draftKey(id));
  if (localStorage.getItem(ACTIVE_ID_KEY) === id) localStorage.removeItem(ACTIVE_ID_KEY);
}

/**
 * Local-first workout draft: every edit is mirrored to localStorage immediately and
 * debounced to PUT /workouts/{id}. Unsynced edits survive refreshes and reconnect automatically.
 */
export function useAutosaveWorkout(initial: Workout) {
  const [restored] = useState<Workout | null>(() => {
    const s = readStored(initial.id);
    return s && s.dirty ? s.workout : null;
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
      setSync(navigator.onLine ? "pending" : "offline");
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void flush(), 700);
    },
    [flush],
  );

  useEffect(() => {
    if (initial.status === "active") localStorage.setItem(ACTIVE_ID_KEY, initial.id);
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
  }, [flush, initial.id, initial.status]);

  return { draft, update, sync, restored: !!restored, flush };
}
