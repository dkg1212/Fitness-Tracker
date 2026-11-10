import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, Dumbbell, Flame, Trophy, TrendingUp, Target, Layers } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList,
  Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import { apiGet } from "@/lib/api";
import { useAnalyticsSummary } from "@/lib/hooks";
import type { ExerciseProgress, SubMuscleBreakdown } from "@/lib/types";
import { fmtDate, fmtKg, fmtVolume, MUSCLE_COLORS } from "@/lib/workout";

const AXIS = { stroke: "#64748B", fontSize: 10, fontFamily: "JetBrains Mono Variable" };
const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#0F172A",
    border: "1px solid #334155",
    borderRadius: 10,
    fontSize: 12,
    padding: "8px 12px",
  },
  labelStyle: { color: "#94A3B8", marginBottom: 4 },
  itemStyle: { color: "#F8FAFC" },
};

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ label, value, icon: Icon, testid, accent = "text-volt" }: {
  label: string; value: string; icon: typeof Trophy; testid: string; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 sm:p-4" data-testid={testid}>
      <Icon className={`size-4 ${accent}`} />
      <p className="mt-2 font-mono text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[10px]">{label}</p>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ title, icon: Icon, children, testid, className = "" }: {
  title: string; icon: typeof Trophy; children: React.ReactNode; testid: string; className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-surface-card/60 p-4 animate-fade-up ${className}`}
      data-testid={testid}
    >
      <h2 className="mb-4 flex items-center gap-2 font-heading text-base font-bold sm:text-lg">
        <Icon className="size-4 text-volt" />
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── Sub-muscle breakdown ──────────────────────────────────────────────────────
const SUB_MUSCLE_COLORS: Record<string, string> = {
  "Upper Chest": "#22C55E", "Middle Chest": "#16A34A", "Lower Chest": "#15803D",
  "Lats": "#06B6D4", "Mid Back": "#0891B2", "Upper Back": "#0E7490",
  "Lower Back": "#155E75", "Traps": "#164E63",
  "Front Deltoids": "#F59E0B", "Side Deltoids": "#D97706", "Rear Deltoids": "#B45309",
  "Quadriceps": "#A3E635", "Hamstrings": "#14B8A6", "Glutes": "#F97316",
  "Gastrocnemius": "#94A3B8", "Soleus": "#64748B",
  "Biceps": "#38BDF8", "Biceps Long Head": "#7DD3FC", "Biceps Short Head": "#BAE6FD",
  "Brachialis": "#0284C7", "Triceps": "#FACC15", "Triceps Long Head": "#FDE047",
  "Triceps Lateral Head": "#EAB308", "Triceps Medial Head": "#CA8A04",
  "Rectus Abdominis": "#FF3B30", "Obliques": "#FF6B35",
  "Transverse Abdominis": "#FF8C69", "Hip Flexors": "#FF6B6B",
};

function MuscleBar({ muscle, sets, max, color, credit }: {
  muscle: string; sets: number; max: number; color: string; credit?: string;
}) {
  const pct = Math.round((sets / max) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
          <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate">{muscle}</span>
        </span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {typeof sets === "number" && !Number.isInteger(sets) ? sets.toFixed(1) : sets}
          {credit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-active">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

function SubMuscleCard() {
  const q = useQuery({
    queryKey: ["analytics", "sub-muscle"],
    queryFn: () => apiGet<SubMuscleBreakdown>("/analytics/sub-muscle"),
    staleTime: 5 * 60_000,
  });
  const data = q.isError ? undefined : q.data;
  const primary = (data?.primary ?? []).slice(0, 12);
  const secondary = (data?.secondary ?? []).slice(0, 8);

  if (q.isLoading) {
    return (
      <Card title="Sub-muscle breakdown" icon={Layers} testid="analytics-submuscle-card" className="lg:col-span-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {[1,2,3,4].map((n) => (
            <div key={n} className="flex flex-col gap-1">
              <div className="h-3 w-full animate-pulse rounded bg-surface-active" />
              <div className="h-1.5 w-full animate-pulse rounded-full bg-surface-active" />
            </div>
          ))}
        </div>
      </Card>
    );
  }
  if (!data || primary.length === 0) return null;

  const maxP = primary[0]?.sets ?? 1;
  const maxS = secondary[0]?.sets ?? 1;

  return (
    <Card title="Sub-muscle breakdown · 4 wks" icon={Layers} testid="analytics-submuscle-card" className="lg:col-span-3">
      <p className="mb-4 text-xs text-muted-foreground">
        Primary muscles get full set credit. Secondary assistors get 0.5× credit.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-volt">Primary targets</p>
          <div className="grid gap-2.5">
            {primary.map(({ muscle, sets }) => (
              <MuscleBar
                key={muscle}
                muscle={muscle}
                sets={sets}
                max={maxP}
                color={SUB_MUSCLE_COLORS[muscle] ?? "#94A3B8"}
                credit=" sets"
              />
            ))}
          </div>
        </div>
        {secondary.length > 0 && (
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-cyan-focus">Secondary involvement</p>
            <div className="grid gap-2.5">
              {secondary.map(({ muscle, sets }) => (
                <MuscleBar
                  key={muscle}
                  muscle={muscle}
                  sets={sets}
                  max={maxS}
                  color={SUB_MUSCLE_COLORS[muscle] ?? "#94A3B8"}
                  credit="×"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── PR table (mobile-friendly card list) ─────────────────────────────────────
function PRTable({ prs, onSelect }: {
  prs: AnalyticsSummary["prs"];
  onSelect: (id: string) => void;
}) {
  if (prs.length === 0) {
    return (
      <div className="flex flex-col items-center py-8" data-testid="analytics-pr-empty">
        <Trophy className="size-8 text-muted-foreground/30" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">No records yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PRs are tracked automatically when you complete sets.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1" data-testid="analytics-pr-table">
      {prs.map((p) => (
        <button
          key={p.exercise_id}
          type="button"
          onClick={() => onSelect(p.exercise_id)}
          data-testid={`analytics-pr-row-${p.exercise_id}`}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-surface-active active:bg-surface-active"
        >
          {/* Colour dot + name */}
          <span
            className="mt-0.5 size-2 shrink-0 rounded-full"
            style={{ background: MUSCLE_COLORS[p.muscle_group] ?? "#94A3B8" }}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {p.exercise_name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {fmtKg(p.best_weight)} kg
              {p.weight_note ? ` (${p.weight_note})` : ""}
              {" "}× {p.best_weight_reps}
              <span className="mx-1 opacity-40">·</span>
              {fmtDate(p.best_weight_date, "dd/MM/yy")}
            </span>
          </span>
          {/* e1RM */}
          <span className="shrink-0 text-right">
            <span className="block font-mono text-sm font-bold text-volt">
              {fmtKg(p.best_e1rm)} kg
            </span>
            <span className="block text-[10px] text-muted-foreground">e1RM</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [params, setParams] = useSearchParams();
  const summaryQ = useAnalyticsSummary();
  const s = summaryQ.isError ? undefined : summaryQ.data;
  const selected = params.get("exercise") ?? s?.prs[0]?.exercise_id ?? "";

  const progressQ = useQuery({
    queryKey: ["analytics", "exercise", selected],
    queryFn: () => apiGet<ExerciseProgress>(`/analytics/exercise/${selected}`),
    enabled: !!selected,
    staleTime: 5 * 60_000,
  });
  const progress = progressQ.isError ? undefined : progressQ.data;

  const weekly = (s?.weekly_volume ?? []).map((w) => ({
    ...w,
    label: fmtDate(w.week_start, "dd/MM"),
  }));
  const points = (progress?.points ?? []).map((p) => ({
    ...p,
    label: fmtDate(p.date, "dd/MM"),
  }));
  const best = points.length ? Math.max(...points.map((p) => p.e1rm)) : 0;
  const first = points[0]?.e1rm ?? 0;
  const delta = points.length > 1 ? best - first : 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Progress" title="Analytics & 1RM" testid="analytics-title" />

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatChip label="Total sessions" value={s ? String(s.total_workouts) : "–"} icon={Dumbbell} testid="analytics-total-workouts" accent="text-muted-foreground" />
        <StatChip label="Week streak" value={s ? `${s.week_streak}wk` : "–"} icon={Flame} testid="analytics-week-streak" accent="text-amber-warn" />
        <StatChip label="This week" value={s ? `${fmtVolume(s.this_week_volume)} kg` : "–"} icon={Activity} testid="analytics-week-volume" accent="text-volt" />
        <StatChip label="Tracked lifts" value={s ? String(s.prs.length) : "–"} icon={Trophy} testid="analytics-tracked-lifts" accent="text-amber-warn" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">

        {/* ── Exercise progression ───────────────────────────────────── */}
        <Card title="Exercise progression" icon={Activity} testid="analytics-progress-card" className="lg:col-span-2">
          {/* Exercise selector */}
          <Select value={selected} onValueChange={(v: string) => setParams({ exercise: v })}>
            <SelectTrigger className="mb-3 h-11 w-full" data-testid="analytics-exercise-select">
              <SelectValue placeholder="Pick an exercise" />
            </SelectTrigger>
            <SelectContent>
              {(s?.prs ?? []).map((p) => (
                <SelectItem key={p.exercise_id} value={p.exercise_id} data-testid={`analytics-exercise-option-${p.exercise_id}`}>
                  {p.exercise_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Delta */}
          {points.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-3 font-mono text-sm">
              <span>
                <span className="text-muted-foreground">Best e1RM </span>
                <b data-testid="analytics-best-e1rm">{fmtKg(best)} kg</b>
              </span>
              <span className={delta >= 0 ? "text-volt" : "text-crimson"} data-testid="analytics-e1rm-delta">
                {delta >= 0 ? "+" : ""}{fmtKg(Math.round(delta * 10) / 10)} kg
              </span>
            </div>
          )}

          {/* Chart */}
          <div className="h-52 sm:h-64">
            {points.length === 0 ? (
              <div className="grid h-full place-items-center" data-testid="analytics-progress-empty">
                <div className="text-center">
                  <TrendingUp className="mx-auto size-8 text-muted-foreground/30" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selected ? "No completed sets for this exercise yet." : "Log a workout to see progression."}
                  </p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="label" {...AXIS} tickLine={false} interval="preserveStartEnd" />
                  <YAxis {...AXIS} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => fmtKg(v)} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value: number, name: string) => [`${fmtKg(value)} kg`, name]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {best > 0 && <ReferenceLine y={best} stroke="#22C55E" strokeDasharray="4 4" strokeOpacity={0.4} />}
                  <Line type="monotone" dataKey="e1rm" name="Est. 1RM" stroke="#22C55E" strokeWidth={2.5} dot={{ r: 3, fill: "#22C55E" }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="top_weight" name="Top weight" stroke="#06B6D4" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5, fill: "#06B6D4" }} activeDot={{ r: 4, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* ── Muscle workload ────────────────────────────────────────── */}
        <Card title="Muscle workload · 4 wks" icon={Dumbbell} testid="analytics-muscle-card">
          <div className="h-52 sm:h-64">
            {(s?.muscle_workload.length ?? 0) === 0 ? (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <Dumbbell className="mx-auto size-8 text-muted-foreground/30" />
                  <p className="mt-2 text-sm text-muted-foreground">No sets in the last 4 weeks.</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s?.muscle_workload} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
                  <XAxis type="number" {...AXIS} tickLine={false} axisLine={false} hide />
                  <YAxis type="category" dataKey="muscle_group" {...AXIS} tickLine={false} axisLine={false} width={70} />
                  <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(148,163,184,0.06)" }} formatter={(value: number) => [`${value} sets`, "Working sets"]} />
                  <Bar dataKey="sets" radius={[0, 6, 6, 0]}>
                    <LabelList dataKey="sets" position="right" style={{ fill: "#94A3B8", fontSize: 10, fontFamily: "JetBrains Mono Variable" }} />
                    {s?.muscle_workload.map((m) => (
                      <Cell key={m.muscle_group} fill={MUSCLE_COLORS[m.muscle_group] ?? "#94A3B8"} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* ── Weekly volume ──────────────────────────────────────────── */}
        <Card title="Weekly volume (kg)" icon={Activity} testid="analytics-weekly-volume-card" className="lg:col-span-3">
          <div className="h-44 sm:h-56">
            {weekly.length === 0 ? (
              <div className="grid h-full place-items-center">
                <p className="text-sm text-muted-foreground">No data yet. Log some workouts first.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={{ top: 16, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="label" {...AXIS} tickLine={false} />
                  <YAxis {...AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtVolume(v)} width={40} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    cursor={{ fill: "rgba(148,163,184,0.06)" }}
                    labelFormatter={(label: string) => `Week of ${label}`}
                    formatter={(value: number) => [`${fmtVolume(value)} kg`, "Volume"]}
                  />
                  <Bar dataKey="volume" fill="#22C55E" radius={[4, 4, 0, 0]} fillOpacity={0.9}>
                    <LabelList
                      dataKey="volume"
                      position="top"
                      formatter={(v: number) => (v > 0 ? fmtVolume(v) : "")}
                      style={{ fill: "#64748B", fontSize: 9, fontFamily: "JetBrains Mono Variable" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* ── Personal records ───────────────────────────────────────── */}
        <Card title="Personal records" icon={Trophy} testid="analytics-pr-card" className="lg:col-span-3">
          <PRTable prs={s?.prs ?? []} onSelect={(id) => setParams({ exercise: id })} />
        </Card>

        {/* ── Sub-muscle breakdown ───────────────────────────────────── */}
        <SubMuscleCard />
      </div>
    </div>
  );
}
