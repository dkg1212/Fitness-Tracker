import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, Flame, Play, Plus, Trophy, Activity, CalendarCheck, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import StartWorkoutButton from "@/components/StartWorkoutButton";
import { apiGet } from "@/lib/api";
import { useActiveWorkout, useMe } from "@/lib/hooks";
import type { AnalyticsSummary, TodayInfo, WorkoutSummary } from "@/lib/types";
import { fmtDate, fmtKg, fmtVolume, MUSCLE_COLORS, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/workout";
import { cn } from "@/lib/utils";

function Stat({ label, value, sub, icon: Icon, testid, accent }: { label: string; value: string; sub?: string; icon: typeof Flame; testid: string; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-card/70 p-4 animate-fade-up" data-testid={testid}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <Icon className={cn("size-4", accent)} />
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums" data-testid={`${testid}-value`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const me = useMe();
  const today = useQuery({ queryKey: ["today"], queryFn: () => apiGet<TodayInfo>("/today") });
  const summary = useQuery({ queryKey: ["analytics", "summary"], queryFn: () => apiGet<AnalyticsSummary>("/analytics/summary") });
  const recent = useQuery({ queryKey: ["workouts", "recent"], queryFn: () => apiGet<WorkoutSummary[]>("/workouts?limit=5") });
  const active = useActiveWorkout();

  const t = today.isError ? undefined : today.data;
  const s = summary.isError ? undefined : summary.data;
  const hasActive = !!active.data && !active.isError;

  return (
    <div>
      <PageHeader eyebrow={t ? fmtDate(t.date, "EEEE · dd/MM/yyyy") : "Today"} title={<>Let's train, {me.data?.name ?? "Athlete"}.</>} testid="dashboard-title" />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hero: today's split day */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-card to-surface p-6 lg:col-span-2 lg:p-8 animate-fade-up" data-testid="today-card">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-volt/10 blur-3xl" />
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t ? `${WEEKDAYS[t.weekday]} · ${t.split.name}` : "Scheduled"}
          </p>
          {today.isLoading ? (
            <div className="mt-3 h-10 w-48 animate-pulse rounded bg-surface-active" />
          ) : t?.is_rest ? (
            <div className="mt-2 flex items-center gap-3">
              <BedDouble className="size-8 text-cyan-focus" />
              <h2 className="text-4xl font-extrabold tracking-tight" data-testid="today-template-name">Rest day</h2>
            </div>
          ) : (
            <h2 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl" data-testid="today-template-name">{t?.template?.name ?? "—"}</h2>
          )}
          {t?.template && (
            <div className="mt-4 flex flex-wrap gap-1.5" data-testid="today-exercise-list">
              {t.template.exercises.map((e) => (
                <span key={e.exercise_id} className="flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-3 py-1 text-xs">
                  <span className="size-1.5 rounded-full" style={{ background: MUSCLE_COLORS[e.muscle_group] }} />
                  {e.exercise_name} <span className="font-mono text-muted-foreground">{e.target_sets}×{e.target_reps}</span>
                </span>
              ))}
            </div>
          )}
          {t?.is_rest && <p className="mt-3 max-w-md text-sm text-muted-foreground">Recovery is training too. Want to move anyway? Start a quick session.</p>}

          <div className="mt-6 flex flex-wrap gap-2">
            {hasActive ? (
              <Link to="/workout/active" className={cn(buttonVariants(), "h-12 px-6 text-base font-bold")} data-testid="dashboard-resume-workout-button">
                <Play className="size-4" /> Resume {active.data?.name}
              </Link>
            ) : (
              <>
                {t?.template && (
                  <StartWorkoutButton body={{ template_id: t.template!.id, name: null }} className="h-12 px-6 text-base font-bold" testid="dashboard-start-workout-button">
                    <Play className="size-4" /> Start {t.template.name}
                  </StartWorkoutButton>
                )}
                <StartWorkoutButton body={{ template_id: null, name: null }} variant="outline" className="h-12 px-5" testid="dashboard-quick-workout-button">
                  <Plus className="size-4" /> Quick empty workout
                </StartWorkoutButton>
              </>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Stat label="Week streak" value={s ? `${s.week_streak}` : "–"} sub="consecutive weeks trained" icon={Flame} accent="text-amber-warn" testid="stat-week-streak" />
          <Stat label="This week" value={s ? `${fmtVolume(s.this_week_volume)} kg` : "–"} sub={s ? `${s.this_week_workouts} sessions` : undefined} icon={Activity} accent="text-volt" testid="stat-week-volume" />
        </div>
      </div>

      {/* Week strip */}
      <section className="mt-6 animate-fade-up">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">This week's split</h3>
          <Link to="/split" className="text-sm font-semibold text-volt hover:underline" data-testid="dashboard-edit-split-link">Edit split</Link>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2" data-testid="week-strip">
          {(t?.split.days ?? Array.from({ length: 7 }, (_, i) => ({ weekday: i, template_id: null, template_name: null }))).map((d) => {
            const isToday = t?.weekday === d.weekday;
            return (
              <div
                key={d.weekday}
                data-testid={`week-strip-day-${d.weekday}`}
                className={cn(
                  "rounded-lg border p-2 text-center sm:p-3",
                  isToday ? "border-volt bg-volt/10" : "border-border bg-surface/70",
                )}
              >
                <p className={cn("text-[10px] font-bold uppercase tracking-wider", isToday ? "text-volt" : "text-muted-foreground")}>{WEEKDAYS_SHORT[d.weekday]}</p>
                <p className={cn("mt-1 truncate text-[11px] font-semibold sm:text-sm", !d.template_name && "text-muted-foreground")}>
                  {d.template_name ?? "Rest"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-border bg-surface/70 p-4 animate-fade-up" data-testid="recent-workouts">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-heading text-lg font-bold"><CalendarCheck className="size-4 text-volt" /> Recent sessions</h3>
            <Link to="/history" className="text-sm font-semibold text-volt hover:underline" data-testid="dashboard-history-link">All</Link>
          </div>
          {recent.isLoading && <div className="h-24 animate-pulse rounded bg-surface-active" />}
          {(recent.isError || recent.data?.length === 0) && <p className="py-6 text-center text-sm text-muted-foreground">No sessions logged yet.</p>}
          <div className="divide-y divide-border">
            {!recent.isError && recent.data?.map((w) => (
              <Link key={w.id} to={`/workout/${w.id}`} className="group flex items-center justify-between gap-3 py-3" data-testid={`recent-workout-${w.id}`}>
                <div className="min-w-0">
                  <p className="font-semibold">{w.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{fmtDate(w.date, "EEE dd/MM")} · {w.completed_sets} sets · {w.duration_min ?? "–"} min</p>
                </div>
                <span className="flex items-center gap-1 font-mono text-sm font-semibold">
                  {fmtVolume(w.volume)} kg <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface/70 p-4 animate-fade-up" data-testid="top-prs">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-heading text-lg font-bold"><Trophy className="size-4 text-amber-warn" /> Top lifts</h3>
            <Link to="/analytics" className="text-sm font-semibold text-volt hover:underline" data-testid="dashboard-analytics-link">Analytics</Link>
          </div>
          {(!s || s.prs.length === 0) && <p className="py-6 text-center text-sm text-muted-foreground">PRs appear after your first session.</p>}
          <div className="space-y-2">
            {s?.prs.slice(0, 5).map((p) => (
              <Link key={p.exercise_id} to={`/analytics?exercise=${p.exercise_id}`} className="flex items-center justify-between rounded-md px-2 py-2 transition-colors hover:bg-surface-active" data-testid={`top-pr-${p.exercise_id}`}>
                <span className="text-sm font-semibold">{p.exercise_name}</span>
                <span className="text-right font-mono text-xs">
                  <span className="block text-sm font-bold text-foreground">{fmtKg(p.best_e1rm)} kg</span>
                  <span className="text-muted-foreground">e1RM</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
