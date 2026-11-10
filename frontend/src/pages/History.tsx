import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  History as HistoryIcon,
  Layers,
  List,
  Pencil,
  Target,
  Trash2,
  TrendingUp,
  Weight,
  XCircle,
  Zap,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { apiDelete } from "@/lib/api";
import { useCalendar, useConsistencyStats, useHistoryList, useSplitHistory } from "@/lib/hooks";
import type {
  CalendarDay,
  CalendarWorkoutSummary,
  SplitHistoryRecord,
  WorkoutSummary,
} from "@/lib/types";
import { fmtDate, fmtVolume, MUSCLE_COLORS } from "@/lib/workout";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

function fmtVol(v: number): string {
  return fmtVolume(v);
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "text-volt",
  testid,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Flame;
  accent?: string;
  testid?: string;
}) {
  return (
    <div
      className="flex flex-col rounded-xl border border-border bg-surface-card/70 p-3.5 sm:p-4"
      data-testid={testid}
    >
      <Icon className={cn("size-4 shrink-0", accent)} />
      <p className="mt-2 font-mono text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[10px]">
        {label}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Consistency ring ─────────────────────────────────────────────────────────

function ConsistencyRing({
  pct: p,
  label,
  size = 72,
}: {
  pct: number;
  label: string;
  size?: number;
}) {
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const dash = (p / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1E293B" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#22C55E"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <span className="-mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
        {pct(p)}
      </span>
      <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

// ─── Consistency tab ──────────────────────────────────────────────────────────

function ConsistencyTab() {
  const stats = useConsistencyStats();
  const splitHistory = useSplitHistory();
  const s = stats.data;

  if (stats.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (stats.isError || !s) {
    return (
      <p className="rounded-xl border border-dashed border-input p-10 text-center text-muted-foreground">
        Couldn't load stats right now.
      </p>
    );
  }

  const history = splitHistory.data ?? [];

  return (
    <div className="space-y-6">
      {/* ── All-time stats grid ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          All-time stats
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
          <StatCard label="Total sessions" value={String(s.total_sessions)} icon={Activity} accent="text-muted-foreground" />
          <StatCard label="Workout days" value={String(s.total_workout_days)} icon={CalendarDays} accent="text-cyan-focus"
            sub={s.total_sessions !== s.total_workout_days ? `${s.total_sessions} sessions` : undefined} />
          <StatCard label="Current streak" value={`${s.current_streak}d`} icon={Flame} accent="text-amber-warn" />
          <StatCard label="Longest streak" value={`${s.longest_streak}d`} icon={Zap} accent="text-volt" />
          <StatCard label="This week" value={String(s.this_week_sessions)} icon={HistoryIcon} accent="text-volt" />
          <StatCard label="This month" value={String(s.this_month_sessions)} icon={CalendarDays} accent="text-cyan-focus" />
          <StatCard label="This year" value={String(s.this_year_sessions)} icon={TrendingUp} accent="text-amber-warn" />
          <StatCard
            label="Completed days"
            value={String(s.completed_scheduled_days)}
            icon={CheckCircle2}
            accent="text-volt"
            sub={`of ${s.scheduled_days_total} scheduled`}
          />
        </div>
      </section>

      {/* ── Consistency rings ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface-card/60 p-4 sm:p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Schedule consistency
        </h2>
        <div className="flex flex-wrap justify-around gap-6">
          <ConsistencyRing pct={s.weekly_consistency_pct} label="This week" size={80} />
          <ConsistencyRing pct={s.monthly_consistency_pct} label="This month" size={80} />
          <ConsistencyRing pct={s.all_time_consistency_pct} label="All time" size={80} />
        </div>

        {/* Breakdown bar */}
        {s.scheduled_days_total > 0 && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3 text-volt" />
                {s.completed_scheduled_days} completed
              </span>
              <span className="flex items-center gap-1.5">
                <XCircle className="size-3 text-crimson" />
                {s.missed_scheduled_days} missed
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-active">
              <div
                className="h-full rounded-full bg-volt transition-all duration-700"
                style={{ width: `${(s.completed_scheduled_days / s.scheduled_days_total) * 100}%` }}
              />
            </div>
            <p className="text-right text-[10px] text-muted-foreground">
              Excludes rest days and future days
            </p>
          </div>
        )}
      </section>

      {/* ── Split history ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Schedule history
        </h2>
        {splitHistory.isLoading && (
          <div className="h-20 animate-pulse rounded-xl bg-surface" />
        )}
        {!splitHistory.isLoading && history.length === 0 && (
          <p className="rounded-xl border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
            No schedule changes recorded yet. History is preserved from the moment you update your split.
          </p>
        )}
        {history.length > 0 && (
          <div className="space-y-2">
            {[...history].reverse().map((rec, i) => (
              <SplitHistoryCard key={rec.effective_from} record={rec} isCurrent={i === 0} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SplitHistoryCard({
  record,
  isCurrent,
}: {
  record: SplitHistoryRecord;
  isCurrent: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const trainDays = record.days.filter((d) => d.template_id !== null);
  return (
    <div className="rounded-xl border border-border bg-surface-card/60 p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{record.split_name}</p>
            {isCurrent && (
              <span className="rounded-full bg-volt/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-volt">
                Active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            From {fmtDate(record.effective_from, "dd MMM yyyy")}
            {record.effective_to
              ? ` → ${fmtDate(record.effective_to, "dd MMM yyyy")}`
              : " (current)"}
            <span className="mx-1.5 opacity-40">·</span>
            {trainDays.length} training day{trainDays.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          {expanded ? <ChevronLeft className="size-4 rotate-90" /> : <ChevronRight className="size-4 rotate-90" />}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 grid grid-cols-7 gap-1 border-t border-border pt-3">
          {record.days.map((d) => {
            const labels = ["M", "T", "W", "T", "F", "S", "S"];
            const isTraining = d.template_id !== null;
            return (
              <div key={d.weekday} className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold uppercase text-muted-foreground">
                  {labels[d.weekday]}
                </span>
                <span
                  className={cn(
                    "flex h-8 w-full items-center justify-center rounded-lg text-[9px] font-semibold leading-tight text-center px-0.5",
                    isTraining
                      ? "border border-volt/30 bg-volt/10 text-volt"
                      : "border border-border bg-surface/50 text-muted-foreground/50",
                  )}
                >
                  {isTraining ? (d.template_name ?? "—").slice(0, 5) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Calendar tab ─────────────────────────────────────────────────────────────

function CalendarTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [selected, setSelected] = useState<CalendarDay | null>(null);

  const calQ = useCalendar(year, month);
  const days = calQ.data?.days ?? [];

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
    setSelected(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
    setSelected(null);
  };
  const isCurrentOrPast = year < today.getFullYear() || (year === today.getFullYear() && month <= today.getMonth() + 1);

  // Stable handler — doesn't change between renders unless `selected` changes
  const handleDayClick = useCallback((day: CalendarDay) => {
    setSelected((prev) => prev?.date === day.date ? null : day);
  }, []);

  const firstDay = days[0] ? new Date(`${days[0].date}T00:00:00`).getDay() : 1;
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const done = days.filter((d) => d.status === "done").length;
  const missed = days.filter((d) => d.status === "missed").length;
  const scheduled = days.filter((d) => d.is_scheduled && d.status !== "future" && d.status !== "today").length;

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={prevMonth}
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground active:scale-95"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h2 className="font-heading text-lg font-bold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button
          type="button"
          onClick={nextMonth}
          disabled={year === today.getFullYear() && month === today.getMonth() + 1}
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground active:scale-95 disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Month summary pills */}
      {isCurrentOrPast && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-full border border-volt/30 bg-volt/10 px-3 py-1 font-semibold text-volt">
            <CheckCircle2 className="size-3" /> {done} completed
          </span>
          {missed > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-crimson/30 bg-crimson/10 px-3 py-1 font-semibold text-crimson">
              <XCircle className="size-3" /> {missed} missed
            </span>
          )}
          {scheduled > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-semibold text-muted-foreground">
              {pct(done / scheduled * 100)} consistency
            </span>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {calQ.isLoading && (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      )}

      {/* Calendar grid */}
      {!calQ.isLoading && (
        <div>
          {/* Day-of-week headers */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {/* Leading empty cells */}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => (
              <MemoCalendarCell
                key={day.date}
                day={day}
                isSelected={selected?.date === day.date}
                onClick={handleDayClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <LegendItem color="bg-volt" label="Done" />
        <LegendItem color="bg-crimson" label="Missed" />
        <LegendItem color="bg-cyan-focus/60" label="Today" />
        <LegendItem color="bg-surface-active" label="Rest / No data" />
        <LegendItem color="bg-volt/20 border border-volt/30" label="Upcoming" />
      </div>

      {/* Selected day detail */}
      {selected && <DayDetail day={selected} />}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm", color)} />
      {label}
    </span>
  );
}

function CalendarCell({
  day,
  isSelected,
  onClick,
}: {
  day: CalendarDay;
  isSelected: boolean;
  onClick: (day: CalendarDay) => void;
}) {
  const dayNum = parseInt(day.date.slice(8), 10);
  const isClickable = day.status !== "rest" && day.status !== "none";
  const hasWorkouts = day.workouts.length > 0;

  const cellCls = cn(
    "relative flex flex-col items-center justify-center rounded-lg aspect-square text-[11px] sm:text-xs font-semibold transition-all duration-150",
    day.status === "done" && "bg-volt/20 text-volt border border-volt/40",
    day.status === "missed" && "bg-crimson/15 text-crimson border border-crimson/30",
    day.status === "today" && "bg-cyan-focus/20 text-cyan-focus border-2 border-cyan-focus",
    day.status === "future" && "bg-volt/8 text-volt/60 border border-volt/20",
    (day.status === "rest" || day.status === "none") && "bg-surface/40 text-muted-foreground/50 border border-transparent",
    isSelected && "ring-2 ring-offset-1 ring-offset-background ring-volt scale-105",
    isClickable && "cursor-pointer hover:scale-105 active:scale-95",
  );

  return (
    <button
      type="button"
      className={cellCls}
      onClick={isClickable ? () => onClick(day) : undefined}
      disabled={!isClickable}
      title={day.scheduled_template_name ?? undefined}
    >
      <span>{dayNum}</span>
      {hasWorkouts && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {day.workouts.slice(0, 3).map((_, i) => (
            <span key={i} className="size-1 rounded-full bg-volt/80" />
          ))}
        </span>
      )}
    </button>
  );
}
const MemoCalendarCell = memo(CalendarCell);

function DayDetail({ day }: { day: CalendarDay }) {
  const d = new Date(`${day.date}T00:00:00`);
  const label = `${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`;

  return (
    <div className="animate-fade-up rounded-xl border border-border bg-surface-card/70 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-0.5 font-heading text-base font-bold">
            {day.status === "done" && "Workout completed"}
            {day.status === "missed" && "Scheduled workout missed"}
            {day.status === "rest" && "Rest day"}
            {day.status === "today" && "Today"}
            {day.status === "future" && "Upcoming scheduled day"}
          </p>
        </div>
        <StatusBadge status={day.status} />
      </div>

      {day.scheduled_template_name && (
        <p className="mb-3 text-sm text-muted-foreground">
          Scheduled: <span className="font-semibold text-foreground">{day.scheduled_template_name}</span>
        </p>
      )}

      {day.workouts.length > 0 ? (
        <div className="space-y-2">
          {day.workouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </div>
      ) : (
        day.status !== "rest" && day.status !== "future" && (
          <p className="text-sm text-muted-foreground">No sessions logged on this day.</p>
        )
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "done") return <span className="rounded-full bg-volt/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-volt">Done</span>;
  if (status === "missed") return <span className="rounded-full bg-crimson/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-crimson">Missed</span>;
  if (status === "rest") return <span className="rounded-full bg-surface-active px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rest</span>;
  if (status === "future") return <span className="rounded-full border border-volt/30 bg-volt/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-volt/80">Upcoming</span>;
  if (status === "today") return <span className="rounded-full bg-cyan-focus/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-focus">Today</span>;
  return null;
}

function WorkoutCard({ workout: w }: { workout: CalendarWorkoutSummary }) {
  return (
    <Link
      to={`/workout/${w.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 transition-colors hover:border-input hover:bg-surface-active"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold text-sm">{w.name}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
          {fmtVol(w.volume)} kg
          <span className="mx-1 opacity-40">·</span>
          {w.completed_sets} sets
          {w.duration_min !== null && (
            <>
              <span className="mx-1 opacity-40">·</span>
              {w.duration_min} min
            </>
          )}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

// ─── List tab (existing functionality, improved mobile) ───────────────────────

function ListTab() {
  const qc = useQueryClient();
  const list = useHistoryList(500);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [toDelete, setToDelete] = useState<WorkoutSummary | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/workouts/${id}`),
    onSuccess: () => {
      for (const k of [["workouts"], ["analytics"], ["previous"], ["history"]]) {
        qc.invalidateQueries({ queryKey: k });
      }
      setToDelete(null);
      toast.success("Workout deleted");
    },
    onError: () => toast.error("Couldn't delete workout"),
  });

  const grouped = useMemo(() => {
    const rows = (list.isError ? [] : list.data ?? []).filter(
      (w) => (!from || w.date >= from) && (!to || w.date <= to),
    );
    const map = new Map<string, WorkoutSummary[]>();
    for (const w of rows) {
      const k = w.date.slice(0, 7);
      map.set(k, [...(map.get(k) ?? []), w]);
    }
    return [...map.entries()];
  }, [list.data, list.isError, from, to]);

  return (
    <div>
      {/* Date range filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-10 w-[140px] [color-scheme:dark]"
          aria-label="From date"
          data-testid="history-from-date"
        />
        <span className="text-muted-foreground">→</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-10 w-[140px] [color-scheme:dark]"
          aria-label="To date"
          data-testid="history-to-date"
        />
        {(from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFrom(""); setTo(""); }}
            data-testid="history-clear-filter"
          >
            Clear
          </Button>
        )}
      </div>

      {list.isLoading && <div className="h-40 animate-pulse rounded-xl bg-surface" />}
      {!list.isLoading && grouped.length === 0 && (
        <div
          className="rounded-xl border border-dashed border-input p-10 text-center text-muted-foreground"
          data-testid="history-empty"
        >
          {list.isError ? "History is unavailable right now." : "No workouts in this range yet."}
        </div>
      )}

      <div className="space-y-8">
        {grouped.map(([month, rows]) => (
          <section key={month}>
            <h2 className="mb-3 flex flex-wrap items-baseline gap-2 font-heading text-base font-bold sm:text-lg">
              {fmtDate(`${month}-01`, "MMMM yyyy")}
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {rows.length} session{rows.length !== 1 ? "s" : ""} · {fmtVolume(rows.reduce((a, r) => a + r.volume, 0))} kg
              </span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((w) => (
                <article
                  key={w.id}
                  className="group rounded-xl border border-border bg-surface-card/70 p-4 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-input animate-fade-up"
                  data-testid={`history-item-${w.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        {fmtDate(w.date, "EEE · dd/MM/yyyy")}
                      </p>
                      <h3 className="font-heading text-lg font-bold leading-tight sm:text-xl">{w.name}</h3>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Link
                        to={`/workout/${w.id}`}
                        className={cn(buttonVariants({ variant: "ghost" }), "h-9 gap-1.5 px-2.5 text-xs sm:h-10 sm:px-3")}
                        aria-label="Edit workout"
                        data-testid={`history-edit-${w.id}`}
                      >
                        <Pencil className="size-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </Link>
                      <Button
                        variant="ghost"
                        className="h-9 gap-1.5 px-2.5 text-xs hover:text-crimson sm:h-10 sm:px-3"
                        onClick={() => setToDelete(w)}
                        aria-label="Delete workout"
                        data-testid={`history-delete-${w.id}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 font-mono text-xs sm:gap-4 sm:text-sm">
                    <span className="flex items-center gap-1.5">
                      <Weight className="size-3.5 text-volt" />{fmtVolume(w.volume)} kg
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Layers className="size-3.5 text-cyan-focus" />{w.completed_sets} sets
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-amber-warn" />{w.duration_min ?? "–"} min
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-xs text-muted-foreground sm:line-clamp-2 sm:text-sm">
                    {w.exercise_names.join(" · ")}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {w.muscle_groups.map((m) => (
                      <span
                        key={m}
                        className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] sm:text-[11px]"
                      >
                        <span className="size-1.5 rounded-full" style={{ background: MUSCLE_COLORS[m] }} />
                        {m}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent data-testid="history-delete-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">
              Delete {toDelete?.name}?
            </DialogTitle>
            <DialogDescription>
              {toDelete && fmtDate(toDelete.date)} · this removes it from history and analytics.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => toDelete && del.mutate(toDelete.id)}
              disabled={del.isPending}
              data-testid="history-delete-confirm"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = "list" | "calendar" | "consistency";

const TABS: { id: Tab; label: string; icon: typeof List }[] = [
  { id: "list", label: "Sessions", icon: List },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "consistency", label: "Consistency", icon: Target },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function History() {
  const [tab, setTab] = useState<Tab>("list");

  return (
    <div>
      <PageHeader eyebrow="Log" title="Workout history" testid="history-title" />

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 rounded-xl border border-border bg-surface-card/50 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            data-testid={`history-tab-${id}`}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors sm:gap-2 sm:text-sm",
              tab === id
                ? "bg-surface-active text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0 sm:size-4" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.slice(0, 4)}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "list" && <ListTab />}
      {tab === "calendar" && <CalendarTab />}
      {tab === "consistency" && <ConsistencyTab />}
    </div>
  );
}
