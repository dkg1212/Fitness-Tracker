import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, Dumbbell, Flame, Trophy } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/PageHeader";
import { apiGet } from "@/lib/api";
import type { AnalyticsSummary, ExerciseProgress } from "@/lib/types";
import { fmtDate, fmtKg, fmtVolume, MUSCLE_COLORS } from "@/lib/workout";

const AXIS = { stroke: "#64748B", fontSize: 11, fontFamily: "JetBrains Mono Variable" };
const TOOLTIP = {
  contentStyle: { background: "#0F172A", border: "1px solid #334155", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#94A3B8" },
};

function Card({ title, icon: Icon, children, testid, className = "" }: { title: string; icon: typeof Trophy; children: React.ReactNode; testid: string; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-surface-card/60 p-4 sm:p-5 animate-fade-up ${className}`} data-testid={testid}>
      <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><Icon className="size-4 text-volt" />{title}</h2>
      {children}
    </section>
  );
}

export default function Analytics() {
  const [params, setParams] = useSearchParams();
  const summaryQ = useQuery({ queryKey: ["analytics", "summary"], queryFn: () => apiGet<AnalyticsSummary>("/analytics/summary") });
  const s = summaryQ.isError ? undefined : summaryQ.data;
  const selected = params.get("exercise") ?? s?.prs[0]?.exercise_id ?? "";

  const progressQ = useQuery({
    queryKey: ["analytics", "exercise", selected],
    queryFn: () => apiGet<ExerciseProgress>(`/analytics/exercise/${selected}`),
    enabled: !!selected,
  });
  const progress = progressQ.isError ? undefined : progressQ.data;

  const exerciseLabels = useMemo(() => {
    const m: Record<string, string> = Object.fromEntries((s?.prs ?? []).map((p) => [p.exercise_id, p.exercise_name]));
    if (progress && !m[progress.exercise_id]) m[progress.exercise_id] = progress.exercise_name;
    return m;
  }, [s, progress]);

  const weekly = (s?.weekly_volume ?? []).map((w) => ({ ...w, label: fmtDate(w.week_start, "dd/MM") }));
  const points = (progress?.points ?? []).map((p) => ({ ...p, label: fmtDate(p.date, "dd/MM") }));
  const best = points.length ? Math.max(...points.map((p) => p.e1rm)) : 0;
  const first = points[0]?.e1rm ?? 0;
  const delta = points.length > 1 ? best - first : 0;

  return (
    <div>
      <PageHeader eyebrow="Progress" title="Analytics & 1RM" testid="analytics-title" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Total sessions", v: s ? String(s.total_workouts) : "–", icon: Dumbbell, t: "analytics-total-workouts" },
          { k: "Week streak", v: s ? String(s.week_streak) : "–", icon: Flame, t: "analytics-week-streak" },
          { k: "This week", v: s ? `${fmtVolume(s.this_week_volume)} kg` : "–", icon: Activity, t: "analytics-week-volume" },
          { k: "Tracked lifts", v: s ? String(s.prs.length) : "–", icon: Trophy, t: "analytics-tracked-lifts" },
        ].map(({ k, v, icon: Icon, t }) => (
          <div key={k} className="rounded-xl border border-border bg-surface p-4" data-testid={t}>
            <Icon className="size-4 text-muted-foreground" />
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{v}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Exercise progression" icon={Activity} testid="analytics-progress-card" className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Select value={selected} onValueChange={(v: string) => setParams({ exercise: v })}>
              <SelectTrigger className="h-11 w-full sm:w-72" data-testid="analytics-exercise-select">
                <SelectValue>{(v) => exerciseLabels[v as string] ?? "Pick an exercise"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(s?.prs ?? []).map((p) => (
                  <SelectItem key={p.exercise_id} value={p.exercise_id} data-testid={`analytics-exercise-option-${p.exercise_id}`}>{p.exercise_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {points.length > 0 && (
              <div className="flex gap-4 font-mono text-sm">
                <span><span className="text-muted-foreground">Best e1RM </span><b data-testid="analytics-best-e1rm">{fmtKg(best)} kg</b></span>
                <span className={delta >= 0 ? "text-volt" : "text-crimson"} data-testid="analytics-e1rm-delta">{delta >= 0 ? "+" : ""}{fmtKg(Math.round(delta * 10) / 10)} kg</span>
              </div>
            )}
          </div>
          <div className="h-72">
            {points.length === 0 ? (
              <p className="grid h-full place-items-center text-sm text-muted-foreground" data-testid="analytics-progress-empty">
                {selected ? "No completed sets for this exercise yet." : "Log a workout to see progression."}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="label" {...AXIS} tickLine={false} />
                  <YAxis {...AXIS} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                  <Tooltip {...TOOLTIP} formatter={(value: number, name: string) => [`${fmtKg(value)} kg`, name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="e1rm" name="Est. 1RM" stroke="#22C55E" strokeWidth={2.5} dot={{ r: 3, fill: "#22C55E" }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="top_weight" name="Top weight" stroke="#06B6D4" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5, fill: "#06B6D4" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card title="Muscle workload · 4 wks" icon={Dumbbell} testid="analytics-muscle-card">
          <div className="h-72">
            {(s?.muscle_workload.length ?? 0) === 0 ? (
              <p className="grid h-full place-items-center text-sm text-muted-foreground">No sets in the last 4 weeks.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s?.muscle_workload} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                  <XAxis type="number" {...AXIS} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="muscle_group" {...AXIS} tickLine={false} axisLine={false} width={80} />
                  <Tooltip {...TOOLTIP} cursor={{ fill: "rgba(148,163,184,0.06)" }} formatter={(value: number) => [`${value} sets`, "Working sets"]} />
                  <Bar dataKey="sets" radius={[0, 4, 4, 0]}>
                    {s?.muscle_workload.map((m) => <Cell key={m.muscle_group} fill={MUSCLE_COLORS[m.muscle_group] ?? "#94A3B8"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card title="Weekly volume (kg)" icon={Activity} testid="analytics-weekly-volume-card" className="lg:col-span-3">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid stroke="#1E293B" vertical={false} />
                <XAxis dataKey="label" {...AXIS} tickLine={false} />
                <YAxis {...AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtVolume(v)} />
                <Tooltip {...TOOLTIP} cursor={{ fill: "rgba(148,163,184,0.06)" }} labelFormatter={(label: string) => `Week of ${label}`} formatter={(value: number) => [`${fmtVolume(value)} kg`, "Volume"]} />
                <Bar dataKey="volume" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Personal records" icon={Trophy} testid="analytics-pr-card" className="lg:col-span-3">
          {(s?.prs.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground" data-testid="analytics-pr-empty">No records yet.</p>
          ) : (
            <Table data-testid="analytics-pr-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Exercise</TableHead>
                  <TableHead className="text-right">Heaviest</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Best e1RM</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s?.prs.map((p) => (
                  <TableRow key={p.exercise_id} className="cursor-pointer" onClick={() => setParams({ exercise: p.exercise_id })} data-testid={`analytics-pr-row-${p.exercise_id}`}>
                    <TableCell>
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="size-1.5 rounded-full" style={{ background: MUSCLE_COLORS[p.muscle_group] }} />{p.exercise_name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmtKg(p.best_weight)} × {p.best_weight_reps}</TableCell>
                    <TableCell className="hidden text-right font-mono text-muted-foreground sm:table-cell">{fmtDate(p.best_weight_date)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-volt">{fmtKg(p.best_e1rm)}</TableCell>
                    <TableCell className="hidden text-right font-mono text-muted-foreground sm:table-cell">{fmtDate(p.best_e1rm_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
