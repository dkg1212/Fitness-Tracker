import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import { apiGet, apiPut } from "@/lib/api";
import { useTemplates } from "@/lib/hooks";
import type { Split, SplitDay, Template, TodayInfo } from "@/lib/types";
import { WEEKDAYS } from "@/lib/workout";
import { cn } from "@/lib/utils";

const REST = "rest";

function SplitForm({ split, templates, todayWeekday }: { split: Split; templates: Template[]; todayWeekday?: number }) {
  const qc = useQueryClient();
  const [name, setName] = useState(split.name);
  const [days, setDays] = useState<SplitDay[]>(split.days);
  const labels: Record<string, string> = { [REST]: "Rest day", ...Object.fromEntries(templates.map((t) => [t.id, t.name])) };

  const save = useMutation({
    mutationFn: (body: Split) => apiPut<Split>("/split", body),
    onSuccess: (s) => {
      qc.setQueryData(["split"], s);
      qc.invalidateQueries({ queryKey: ["today"] });
      toast.success("Split saved");
    },
    onError: () => toast.error("Couldn't save split"),
  });

  const trainingDays = days.filter((d) => d.template_id).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-2">
        {days.map((d) => {
          const isToday = todayWeekday === d.weekday;
          const value = d.template_id ?? REST;
          return (
            <div
              key={d.weekday}
              data-testid={`split-day-${d.weekday}`}
              className={cn(
                "grid grid-cols-[110px_1fr] items-center gap-3 rounded-xl border p-3 transition-colors sm:grid-cols-[160px_1fr]",
                isToday ? "border-volt/70 bg-volt/[0.07]" : "border-border bg-surface-card/60",
              )}
            >
              <div>
                <p className="font-heading text-lg font-bold">{WEEKDAYS[d.weekday]}</p>
                {isToday && <p className="font-mono text-[10px] uppercase tracking-widest text-volt">Today</p>}
              </div>
              <select
                value={value}
                onChange={(event) => {
                  const v = event.target.value;
                  setDays((list) => list.map((x) => (x.weekday === d.weekday ? { ...x, template_id: v === REST ? null : v, template_name: v === REST ? null : labels[v] } : x)))
                }}
                aria-label={`${WEEKDAYS[d.weekday]} workout`}
                data-testid={`split-day-select-${d.weekday}`}
                className="h-14 w-full cursor-pointer appearance-auto rounded-xl border border-input bg-background px-4 text-base font-medium text-foreground outline-none transition-colors hover:border-volt focus:border-volt"
              >
                <option value={REST}>Rest day</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
            </div>
          );
        })}
      </div>
      <aside className="h-fit space-y-4 rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-10">
        <div className="space-y-1.5">
          <label htmlFor="split-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Split name</label>
          <Input id="split-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" data-testid="split-name-input" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg border border-border p-3">
            <p className="font-mono text-2xl font-bold text-volt" data-testid="split-training-days">{trainingDays}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Training</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="font-mono text-2xl font-bold text-cyan-focus" data-testid="split-rest-days">{7 - trainingDays}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rest</p>
          </div>
        </div>
        <Button
          onClick={() => save.mutate({ name: name.trim() || "My Split", days: days.map((d) => ({ ...d, template_name: null })) })}
          disabled={save.isPending}
          className="h-12 w-full font-bold"
          data-testid="split-save-button"
        >
          <Save className="size-4" /> {save.isPending ? "Saving…" : "Save split"}
        </Button>
      </aside>
    </div>
  );
}

export default function SplitPlanner() {
  const split = useQuery({ queryKey: ["split"], queryFn: () => apiGet<Split>("/split") });
  const today = useQuery({ queryKey: ["today"], queryFn: () => apiGet<TodayInfo>("/today") });
  const templates = useTemplates();
  const ready = split.data && templates.data && !split.isError && !templates.isError;

  return (
    <div>
      <PageHeader eyebrow="Schedule" title="Weekly split planner" testid="split-title" />
      {!ready ? (
        <div className="h-64 animate-pulse rounded-xl bg-surface" data-testid="split-loading" />
      ) : (
        <SplitForm key={JSON.stringify(split.data)} split={split.data!} templates={templates.data!} todayWeekday={today.data?.weekday} />
      )}
    </div>
  );
}
