import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Layers, Pencil, Trash2, Weight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { apiDelete, apiGet } from "@/lib/api";
import type { WorkoutSummary } from "@/lib/types";
import { fmtDate, fmtVolume, MUSCLE_COLORS } from "@/lib/workout";
import { cn } from "@/lib/utils";

export default function History() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["workouts", "list"], queryFn: () => apiGet<WorkoutSummary[]>("/workouts?limit=500") });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [toDelete, setToDelete] = useState<WorkoutSummary | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/workouts/${id}`),
    onSuccess: () => {
      for (const k of [["workouts"], ["analytics"], ["previous"]]) qc.invalidateQueries({ queryKey: k });
      setToDelete(null);
      toast.success("Workout deleted");
    },
    onError: () => toast.error("Couldn't delete workout"),
  });

  const grouped = useMemo(() => {
    const rows = (list.isError ? [] : list.data ?? []).filter((w) => (!from || w.date >= from) && (!to || w.date <= to));
    const map = new Map<string, WorkoutSummary[]>();
    for (const w of rows) {
      const k = w.date.slice(0, 7);
      map.set(k, [...(map.get(k) ?? []), w]);
    }
    return [...map.entries()];
  }, [list.data, list.isError, from, to]);

  return (
    <div>
      <PageHeader
        eyebrow="Log"
        title="Workout history"
        testid="history-title"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-[140px] [color-scheme:dark]" aria-label="From date" data-testid="history-from-date" />
            <span className="text-muted-foreground">→</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-[140px] [color-scheme:dark]" aria-label="To date" data-testid="history-to-date" />
            {(from || to) && (
              <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }} data-testid="history-clear-filter">Clear</Button>
            )}
          </div>
        }
      />

      {list.isLoading && <div className="h-40 animate-pulse rounded-xl bg-surface" />}
      {!list.isLoading && grouped.length === 0 && (
        <div className="rounded-xl border border-dashed border-input p-10 text-center text-muted-foreground" data-testid="history-empty">
          {list.isError ? "History is unavailable right now." : "No workouts in this range yet."}
        </div>
      )}

      <div className="space-y-8">
        {grouped.map(([month, rows]) => (
          <section key={month}>
            <h2 className="mb-3 flex items-baseline gap-3 font-heading text-lg font-bold">
              {fmtDate(`${month}-01`, "MMMM yyyy")}
              <span className="font-mono text-xs font-normal text-muted-foreground">{rows.length} sessions · {fmtVolume(rows.reduce((a, r) => a + r.volume, 0))} kg</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((w) => (
                <article key={w.id} className="group rounded-xl border border-border bg-surface-card/70 p-4 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-input animate-fade-up" data-testid={`history-item-${w.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{fmtDate(w.date, "EEE · dd/MM/yyyy")}</p>
                      <h3 className="font-heading text-xl font-bold">{w.name}</h3>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link to={`/workout/${w.id}`} className={cn(buttonVariants({ variant: "ghost" }), "h-10 gap-1.5 px-3 text-xs")} aria-label="Edit workout" data-testid={`history-edit-${w.id}`}>
                        <Pencil className="size-4" />
                        Edit
                      </Link>
                      <Button variant="ghost" className="h-10 gap-1.5 px-3 text-xs hover:text-crimson" onClick={() => setToDelete(w)} aria-label="Delete workout" data-testid={`history-delete-${w.id}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 font-mono text-sm">
                    <span className="flex items-center gap-1.5"><Weight className="size-3.5 text-volt" />{fmtVolume(w.volume)} kg</span>
                    <span className="flex items-center gap-1.5"><Layers className="size-3.5 text-cyan-focus" />{w.completed_sets} sets</span>
                    <span className="flex items-center gap-1.5"><Clock className="size-3.5 text-amber-warn" />{w.duration_min ?? "–"} min</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{w.exercise_names.join(" · ")}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {w.muscle_groups.map((m) => (
                      <span key={m} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px]">
                        <span className="size-1.5 rounded-full" style={{ background: MUSCLE_COLORS[m] }} />{m}
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
            <DialogTitle className="font-heading text-xl font-bold">Delete {toDelete?.name}?</DialogTitle>
            <DialogDescription>{toDelete && fmtDate(toDelete.date)} · this removes it from history and analytics.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => toDelete && del.mutate(toDelete.id)} disabled={del.isPending} data-testid="history-delete-confirm">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
