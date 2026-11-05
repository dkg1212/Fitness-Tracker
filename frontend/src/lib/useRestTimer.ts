import { useCallback, useState } from "react";

export interface RestState { endsAt: number; duration: number; label: string }

const KEY = "ironcore:rest";

function load(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as RestState;
    return r.endsAt > Date.now() - 3000 ? r : null;
  } catch {
    return null;
  }
}

/** Rest countdown anchored to an absolute end time, so it survives refreshes and tab sleeps. */
export function useRestTimer() {
  const [rest, setRest] = useState<RestState | null>(load);

  const persist = useCallback((r: RestState | null) => {
    setRest(r);
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  }, []);

  const start = useCallback(
    (seconds: number, label: string) => {
      if (seconds <= 0) return;
      persist({ endsAt: Date.now() + seconds * 1000, duration: seconds, label });
    },
    [persist],
  );

  const adjust = useCallback(
    (delta: number) => {
      setRest((prev) => {
        if (!prev) return prev;
        const endsAt = Math.max(Date.now(), prev.endsAt + delta * 1000);
        const next = { ...prev, endsAt, duration: Math.max(1, prev.duration + delta) };
        localStorage.setItem(KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const skip = useCallback(() => persist(null), [persist]);

  return { rest, start, adjust, skip };
}
