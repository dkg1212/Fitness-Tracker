import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, BookOpen, CheckCircle2, Flame, Play, Plus, Trophy, Activity, CalendarCheck, ChevronRight, Dumbbell, TrendingUp } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import StartWorkoutButton from "@/components/StartWorkoutButton";
import { apiGet } from "@/lib/api";
import { useActiveWorkout, useMe } from "@/lib/hooks";
import type { AnalyticsSummary, TodayInfo, WorkoutSummary } from "@/lib/types";
import { fmtDate, fmtKg, fmtVolume, MUSCLE_COLORS, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/workout";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  testid,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Flame;
  testid: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-card/70 p-4 animate-fade-up" data-testid={testid}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <Icon className={cn("size-4", accent)} />
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums" data-testid={`${testid}-value`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const me = useMe();
  const today = useQuery({ queryKey: ["today"], queryFn: () => apiGet<TodayInfo>("/today") });
  const summary = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => apiGet<AnalyticsSummary>("/analytics/summary"),
  });
  const recent = useQuery({
    queryKey: ["workouts", "recent"],
    queryFn: () => apiGet<WorkoutSummary[]>("/workouts?limit=5"),
  });
  const active = useActiveWorkout();

  const t = today.isError ? undefined : today.data;
  const s = summary.isError ? undefined : summary.data;
  const hasActive = !!active.data && !active.isError;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div>
      <PageHeader
        eyebrow={t ? fmtDate(t.date, "EEEE · dd/MM/yyyy") : "Today"}
        title={
          <>
            {greeting},{" "}
            <span className="text-volt">{me.data?.name?.split(" ")[0] ?? "Athlete"}</span>.
          </>
        }
        testid="dashboard-title"
      />

      {/* New-user guide banner — shown when there are no completed workouts yet */}
      {s && s.total_workouts === 0 && (
        <Link
          to="/guide"
          className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-cyan-focus/30 bg-cyan-focus/8 px-4 py-3.5 transition-colors hover:border-cyan-focus/50 hover:bg-cyan-focus/12 animate-fade-up"
          data-testid="guide-banner"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-focus/15 text-cyan-focus">
              <BookOpen className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">New to IronCore?</p>
              <p className="text-xs text-muted-foreground">Read the user guide to get started in 2 minutes.</p>
            </div>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hero: today's split day */}
        <section
          className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-card to-surface p-5 lg:col-span-2 lg:p-8 animate-fade-up"
          data-testid="today-card"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-volt/10 blur-3xl" />
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t ? `${WEEKDAYS[t.weekday]} · ${t.split.name}` : "Scheduled"}
          </p>

          {today.isLoading ? (
            <div className="mt-3 space-y-2">
              <div className="h-10 w-48 animate-pulse rounded-lg bg-surface-active" />
              <div className="h-4 w-32 animate-pulse rounded bg-surface-active" />
            </div>
          ) : t?.is_rest ? (
            <div className="mt-2 flex items-center gap-3">
              <BedDouble className="size-8 text-cyan-focus" />
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl" data-testid="today-template-name">
                Rest day
              </h2>
            </div>
          ) : (
            <h2
              className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl"
              data-testid="today-template-name"
            >
              {t?.template?.name ?? "No template set"}
            </h2>
          )}

          {t?.template && (
            <div className="mt-4 flex flex-wrap gap-1.5" data-testid="today-exercise-list">
              {t.template.exercises.map((e) => (
                <span
                  key={e.exercise_id}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-3 py-1 text-xs"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: MUSCLE_COLORS[e.muscle_group] }}
                  />
                  {e.exercise_name}{" "}
                  <span className="font-mono text-muted-foreground">
                    {e.target_sets}×{e.target_reps}
                  </span>
                </span>
              ))}
            </div>
          )}

          {t?.is_rest && (
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Recovery is training too. Want to move anyway? Start a quick session.
            </p>
          )}

          {!t && !today.isLoading && (
            <p className="mt-3 text-sm text-muted-foreground">
              Set up your weekly split to see today's workout here.{" "}
              <Link to="/split" className="font-semibold text-volt hover:underline">
                Set up split →
              </Link>
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {hasActive ? (
              <Link
                to="/workout/active"
                className={cn(buttonVariants(), "h-12 px-6 text-base font-bold active:scale-[0.97]")}
                data-testid="dashboard-resume-workout-button"
              >
                <Play className="size-4" /> Resume {active.data?.name}
              </Link>
            ) : t?.completed_today ? (
              /* Today's planned session is already done — show a "Done" badge + link to that session */
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="flex items-center gap-2 rounded-xl border border-volt/40 bg-volt/10 px-5 py-3 text-base font-bold text-volt"
                  data-testid="dashboard-completed-today-badge"
                >
                  <CheckCircle2 className="size-5" />
                  Completed today
                </span>
                <Link
                  to={`/workout/${t.completed_workout_id}`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-12 px-5 active:scale-[0.97]")}
                  data-testid="dashboard-view-completed-button"
                >
                  View session
                </Link>
              </div>
            ) : (
              <>
                {t?.template && (
                  <StartWorkoutButton
                    body={{ template_id: t.template!.id, name: null }}
                    className="h-12 px-6 text-base font-bold active:scale-[0.97]"
                    testid="dashboard-start-workout-button"
                  >
                    <Play className="size-4" /> Start {t.template.name}
                  </StartWorkoutButton>
                )}
                <StartWorkoutButton
                  body={{ template_id: null, name: null }}
                  variant="outline"
                  className="h-12 px-5 active:scale-[0.97]"
                  testid="dashboard-quick-workout-button"
                >
                  <Plus className="size-4" /> Quick workout
                </StartWorkoutButton>
              </>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <StatCard
            label="Week streak"
            value={s ? `${s.week_streak}wk` : "–"}
            sub={s ? `${s.total_workouts} total sessions` : "consecutive weeks"}
            icon={Flame}
            accent="text-amber-warn"
            testid="stat-week-streak"
          />
          <StatCard
            label="This week"
            value={s ? `${fmtVolume(s.this_week_volume)} kg` : "–"}
            sub={s ? `${s.this_week_workouts} session${s.this_week_workouts !== 1 ? "s" : ""}` : undefined}
            icon={Activity}
            accent="text-volt"
            testid="stat-week-volume"
          />
        </div>
      </div>

      {/* Week strip */}
      <section className="mt-6 animate-fade-up">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
            This week's split
          </h3>
          <Link
            to="/split"
            className="text-sm font-semibold text-volt hover:underline"
            data-testid="dashboard-edit-split-link"
          >
            Edit split
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2" data-testid="week-strip">
          {(
            t?.split.days ??
            Array.from({ length: 7 }, (_, i) => ({
              weekday: i,
              template_id: null,
              template_name: null,
            }))
          ).map((d) => {
            const isToday = t?.weekday === d.weekday;
            const isRest = !d.template_id;
            const isDoneToday = isToday && t?.completed_today;
            return (
              <Link
                to="/split"
                key={d.weekday}
                data-testid={`week-strip-day-${d.weekday}`}
                className={cn(
                  "rounded-xl border p-2 text-center transition-colors sm:p-3",
                  isDoneToday
                    ? "border-volt/60 bg-volt/15"
                    : isToday
                    ? "border-volt bg-volt/10"
                    : isRest
                    ? "border-border bg-surface/40"
                    : "border-border bg-surface/70 hover:border-input",
                )}
              >
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    isToday ? "text-volt" : "text-muted-foreground",
                  )}
                >
                  {WEEKDAYS_SHORT[d.weekday]}
                </p>
                {isDoneToday ? (
                  <CheckCircle2 className="mx-auto mt-1 size-3.5 text-volt" />
                ) : (
                  <p
                    className={cn(
                      "mt-1 truncate text-[10px] font-semibold sm:text-[11px]",
                      isRest ? "text-muted-foreground/50" : "text-foreground",
                    )}
                  >
                    {d.template_name ?? "—"}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Recent sessions */}
        <section
          className="rounded-xl border border-border bg-surface/70 p-4 animate-fade-up"
          data-testid="recent-workouts"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-heading text-lg font-bold">
              <CalendarCheck className="size-4 text-volt" /> Recent sessions
            </h3>
            <Link
              to="/history"
              className="text-sm font-semibold text-volt hover:underline"
              data-testid="dashboard-history-link"
            >
              See all
            </Link>
          </div>

          {recent.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-32 animate-pulse rounded bg-surface-active" />
                    <div className="h-3 w-48 animate-pulse rounded bg-surface-active" />
                  </div>
                  <div className="h-4 w-16 animate-pulse rounded bg-surface-active" />
                </div>
              ))}
            </div>
          )}

          {!recent.isLoading && (recent.isError || recent.data?.length === 0) && (
            <div className="flex flex-col items-center py-8 text-center">
              <Dumbbell className="size-8 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">No sessions yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Your workout history will appear here.</p>
              <StartWorkoutButton
                body={{ template_id: null, name: null }}
                className="mt-4 h-10 px-5 text-sm font-bold"
                testid="dashboard-empty-start"
              >
                <Play className="size-3.5" /> Log first workout
              </StartWorkoutButton>
            </div>
          )}

          <div className="divide-y divide-border">
            {!recent.isError &&
              recent.data?.map((w) => (
                <Link
                  key={w.id}
                  to={`/workout/${w.id}`}
                  className="group flex items-center justify-between gap-3 py-3.5 active:bg-surface-active/50 rounded-lg px-1 transition-colors"
                  data-testid={`recent-workout-${w.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{w.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {fmtDate(w.date, "EEE dd/MM")} · {w.completed_sets} sets ·{" "}
                      {w.duration_min ?? "–"} min
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-sm font-semibold tabular-nums">
                    {fmtVolume(w.volume)} kg{" "}
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
          </div>
        </section>

        {/* Top lifts / PRs */}
        <section
          className="rounded-xl border border-border bg-surface/70 p-4 animate-fade-up"
          data-testid="top-prs"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-heading text-lg font-bold">
              <Trophy className="size-4 text-amber-warn" /> Top lifts
            </h3>
            <Link
              to="/analytics"
              className="text-sm font-semibold text-volt hover:underline"
              data-testid="dashboard-analytics-link"
            >
              Analytics
            </Link>
          </div>

          {summary.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex items-center justify-between px-2 py-2">
                  <div className="h-4 w-28 animate-pulse rounded bg-surface-active" />
                  <div className="h-4 w-16 animate-pulse rounded bg-surface-active" />
                </div>
              ))}
            </div>
          )}

          {!summary.isLoading && (!s || s.prs.length === 0) && (
            <div className="flex flex-col items-center py-8 text-center">
              <TrendingUp className="size-8 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">No records yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PRs are tracked automatically as you train.
              </p>
            </div>
          )}

          <div className="space-y-1">
            {s?.prs.slice(0, 6).map((p) => (
              <Link
                key={p.exercise_id}
                to={`/analytics?exercise=${p.exercise_id}`}
                className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-surface-active active:bg-surface-active"
                data-testid={`top-pr-${p.exercise_id}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: MUSCLE_COLORS[p.muscle_group] ?? "#94A3B8" }}
                  />
                  {p.exercise_name}
                </span>
                <span className="text-right font-mono text-xs">
                  <span className="block text-sm font-bold text-volt">{fmtKg(p.best_e1rm)} kg</span>
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
