import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, SkipForward } from "lucide-react";
import type { RestState } from "@/lib/useRestTimer";
import { fmtClock } from "@/lib/workout";
import { cn } from "@/lib/utils";

const SOUND_KEY = "ironcore:sound";

function chime() {
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.2, 0.4].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i === 2 ? 1320 : 880;
      o.connect(g);
      g.connect(ctx.destination);
      const at = ctx.currentTime + t;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);
      o.start(at);
      o.stop(at + 0.2);
    });
    window.setTimeout(() => void ctx.close(), 1000);
  } catch {
    /* audio unavailable */
  }
}

const R = 24;
const C = 2 * Math.PI * R;

export default function RestTimer({
  rest,
  onAdjust,
  onSkip,
}: {
  rest: RestState | null;
  onAdjust: (delta: number) => void;
  onSkip: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(() => localStorage.getItem(SOUND_KEY) !== "off");
  const firedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rest) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [rest]);

  const remaining = rest ? Math.max(0, (rest.endsAt - now) / 1000) : 0;
  const done = !!rest && remaining <= 0;

  useEffect(() => {
    if (!rest || !done || firedRef.current === rest.endsAt) return;
    firedRef.current = rest.endsAt;
    if (sound) chime();
    navigator.vibrate?.([200, 100, 200]);
    const t = window.setTimeout(onSkip, 4000);
    return () => window.clearTimeout(t);
  }, [done, rest, sound, onSkip]);

  if (!rest) return null;
  const progress = rest.duration > 0 ? remaining / rest.duration : 0;

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    localStorage.setItem(SOUND_KEY, next ? "on" : "off");
  };

  return (
    <div
      data-testid="rest-timer"
      className={cn(
        "fixed inset-x-3 bottom-[88px] z-50 flex items-center gap-3 rounded-xl border bg-[#0F172A]/95 p-3 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] backdrop-blur-md animate-fade-up lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[380px]",
        done ? "border-volt animate-pulse-ring" : "border-border",
      )}
    >
      <div className="relative grid size-16 shrink-0 place-items-center">
        <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
          <circle cx="28" cy="28" r={R} fill="none" stroke="#1E293B" strokeWidth="4" />
          <circle
            cx="28"
            cy="28"
            r={R}
            fill="none"
            stroke="#22C55E"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            style={{ transition: "stroke-dashoffset 250ms linear" }}
          />
        </svg>
        <span className="font-mono text-sm font-bold tabular-nums text-volt" data-testid="rest-timer-display">
          {done ? "GO" : fmtClock(remaining)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {done ? "Rest complete" : "Resting"}
        </p>
        <p className="truncate font-heading text-sm font-bold" data-testid="rest-timer-label">{rest.label}</p>
        <div className="mt-1.5 flex gap-1.5">
          <button type="button" onClick={() => onAdjust(-15)} data-testid="rest-timer-minus-15s" className="h-8 rounded-md bg-surface-active px-2.5 font-mono text-xs font-semibold transition-colors hover:bg-input">
            −15s
          </button>
          <button type="button" onClick={() => onAdjust(30)} data-testid="rest-timer-add-30s" className="h-8 rounded-md bg-surface-active px-2.5 font-mono text-xs font-semibold transition-colors hover:bg-input">
            +30s
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={toggleSound} data-testid="rest-timer-sound-toggle" aria-label="Toggle sound" className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
          {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
        </button>
        <button type="button" onClick={onSkip} data-testid="rest-timer-skip" aria-label="Skip rest" className="grid size-9 place-items-center rounded-md bg-amber-warn/15 text-amber-warn transition-colors hover:bg-amber-warn/25">
          <SkipForward className="size-4" />
        </button>
      </div>
    </div>
  );
}
