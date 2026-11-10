import { useState } from "react";
import {
  BookOpen, Dumbbell, BarChart2, CalendarDays, Layers,
  Play, CheckCircle, Zap, Target, Timer, TrendingUp,
  Star, Shield, RefreshCw, Flame, ListChecks,
  PlusCircle, Settings, Award, ChevronRight,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  icon: typeof Play;
  title: string;
  description: string;
  tip?: string;
}

interface Section {
  id: string;
  label: string;
  icon: typeof BookOpen;
  color: string;
  bg: string;
  border: string;
  headline: string;
  sub: string;
  steps: Step[];
}

// ─── Content ──────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: "start",
    label: "Getting started",
    icon: Zap,
    color: "text-volt",
    bg: "bg-volt/10",
    border: "border-volt/20",
    headline: "Up and running in 2 minutes",
    sub: "Everything you need to log your first workout.",
    steps: [
      {
        icon: Settings,
        title: "Complete your profile",
        description:
          "Open the account menu (top right) → Edit profile. Enter your name, bodyweight, height and sex. This unlocks analytics and bodyweight-exercise tracking.",
        tip: "Your bodyweight is used for exercises like Pull-Ups and Dips so the total load is calculated correctly.",
      },
      {
        icon: CalendarDays,
        title: "Set up your weekly split",
        description:
          "Open Split Planner from the sidebar. Assign a training template to each day of the week — leave rest days empty. The Dashboard will then show today's planned session every time you open the app.",
        tip: "Not sure yet? Skip this — you can always start a quick freestyle workout directly from the Train tab.",
      },
      {
        icon: Play,
        title: "Start your first workout",
        description:
          "Tap Train in the bottom nav (mobile) or Active Logger in the sidebar (desktop). Hit Start empty workout or choose one of your templates.",
      },
      {
        icon: Dumbbell,
        title: "Add exercises and log sets",
        description:
          "Tap Add exercise, search or filter by muscle group, then tap to add. For each set: enter the weight, enter reps, then hit the green tick. Done.",
        tip: "Weight entry adapts to equipment — barbell shows plates per side, dumbbell shows per-dumbbell weight, cable shows stack weight.",
      },
      {
        icon: CheckCircle,
        title: "Finish your session",
        description:
          "Tap Finish at the top right. IronCore saves the session, checks for new PRs, and shows a summary with volume, sets and any new records.",
      },
    ],
  },
  {
    id: "logger",
    label: "Workout logger",
    icon: ListChecks,
    color: "text-cyan-focus",
    bg: "bg-cyan-focus/10",
    border: "border-cyan-focus/20",
    headline: "Log smarter, not harder",
    sub: "Every feature inside the live training session.",
    steps: [
      {
        icon: PlusCircle,
        title: "Adding & reordering exercises",
        description:
          "Tap Add exercise. Use the search bar or tap a muscle group chip to filter. Inside each exercise card, tap the ⋮ menu to move it up / down or remove it.",
      },
      {
        icon: Dumbbell,
        title: "Equipment-specific weight entry",
        description:
          "Barbell exercises show a bar weight strip at the top (set once) and plates-per-side for each set. Smith machine lets you mark bar resistance as known or unknown. Bodyweight exercises ask for your bodyweight once, then just the added or assistance weight per set.",
        tip: "The calculated total (bar + plates, or bodyweight ± extra) is shown below the input so you always know the actual load.",
      },
      {
        icon: Target,
        title: "Set types: W / N / D / F",
        description:
          "Tap the set number on the left to change type. W = warm-up (excluded from volume and PRs). N = normal working set. D = drop set. F = failure set.",
      },
      {
        icon: Timer,
        title: "Rest timer",
        description:
          "Every time you complete a set the rest timer starts automatically. Tap the clock chip on the exercise card to cycle through rest lengths (60 s → 90 s → 2 min → 5 min).",
        tip: "Big compound lifts default to 2m 30s rest; isolation moves default to 2 minutes.",
      },
      {
        icon: BarChart2,
        title: "RPE / RIR effort tracking",
        description:
          "Tap the rpe or rir chip to toggle the effort mode. Then select your perceived effort from the dropdown on each set. RPE 10 = max effort, RIR 0 = nothing left.",
      },
      {
        icon: Shield,
        title: "Autosave & offline support",
        description:
          "Every change is saved to the server automatically. If you lose connection, the session is saved on the device and synced when you're back online. The status badge shows Saved / Saving / Offline.",
      },
    ],
  },
  {
    id: "templates",
    label: "Templates",
    icon: Layers,
    color: "text-amber-warn",
    bg: "bg-amber-warn/10",
    border: "border-amber-warn/20",
    headline: "Build once, repeat forever",
    sub: "Templates save your exercise selection, set counts and rest times.",
    steps: [
      {
        icon: PlusCircle,
        title: "Creating a template",
        description:
          "Go to Templates → New template. Give it a name (e.g. Push A, Pull B, Legs). Add exercises, set target sets, rep ranges and rest time for each.",
        tip: "Rep ranges like 8–12 are stored as text so you can be as flexible as you like (5, 3×5, AMRAP, etc.).",
      },
      {
        icon: Play,
        title: "Starting from a template",
        description:
          "On the Train page, your templates are listed as cards. Tap one to start the session. All exercises are pre-loaded. You can still add or remove exercises during the session.",
      },
      {
        icon: RefreshCw,
        title: "Save a finished workout as a template",
        description:
          "Inside any active or completed session, open the ⋮ menu → Save as template. The exercise order, set counts and rest times are captured automatically.",
      },
    ],
  },
  {
    id: "split",
    label: "Split planner",
    icon: CalendarDays,
    color: "text-cyan-focus",
    bg: "bg-cyan-focus/10",
    border: "border-cyan-focus/20",
    headline: "Plan your week",
    sub: "Assign templates to days so the app always knows what's next.",
    steps: [
      {
        icon: CalendarDays,
        title: "Assigning days",
        description:
          "Open Split Planner. Each day of the week has a dropdown. Select a template for training days and leave rest days empty. The split repeats every 7 days.",
      },
      {
        icon: Star,
        title: "Today's card on the Dashboard",
        description:
          "Once your split is set, the Dashboard shows today's template name, the exercise list and a Start button. No more guessing what to train.",
      },
      {
        icon: RefreshCw,
        title: "Changing your split",
        description:
          "Open Split Planner and reassign any day. Changes take effect immediately.",
        tip: "Running a 4-day Upper/Lower or a 6-day PPL? Just leave the extra days empty and the split still works perfectly.",
      },
    ],
  },
  {
    id: "analytics",
    label: "Analytics & PRs",
    icon: TrendingUp,
    color: "text-volt",
    bg: "bg-volt/10",
    border: "border-volt/20",
    headline: "Track every gain",
    sub: "Volume, PRs, e1RM and muscle breakdown — all automatic.",
    steps: [
      {
        icon: Award,
        title: "Personal records",
        description:
          "PRs are detected automatically when you finish a workout — both top weight and best e1RM. The PR banner appears on the finish screen and the Analytics page shows all-time bests.",
        tip: "Weight labels tell you exactly what the number means — 'per dumbbell', 'total barbell load', 'stack weight'. A 25 kg dumbbell PR is always 25 kg per dumbbell, never silently doubled.",
      },
      {
        icon: TrendingUp,
        title: "Estimated 1RM (e1RM)",
        description:
          "e1RM uses the Epley formula: weight × (1 + reps ÷ 30). For example, 5 reps at 100 kg ≈ 117 kg e1RM. e1RM is not calculated for resistance band exercises without a numeric load.",
      },
      {
        icon: BarChart2,
        title: "Volume & muscle workload",
        description:
          "The Analytics page shows weekly volume over 12 weeks and muscle workload over the last 4 weeks. The sub-muscle breakdown shows primary vs secondary muscle involvement.",
      },
      {
        icon: Target,
        title: "Exercise progress chart",
        description:
          "Select any exercise from the PR table. A line chart shows top weight, e1RM and session volume over time.",
      },
    ],
  },
  {
    id: "exercises",
    label: "Exercise library",
    icon: Dumbbell,
    color: "text-crimson",
    bg: "bg-crimson/10",
    border: "border-crimson/20",
    headline: "80+ exercises, fully customisable",
    sub: "Find, filter and create exercises that match how you train.",
    steps: [
      {
        icon: Dumbbell,
        title: "Browsing the library",
        description:
          "Open Exercise Library from the sidebar or the dumbbell icon in the mobile top bar. Filter by muscle group, equipment type or compound vs isolation. Use the search bar for quick lookup.",
      },
      {
        icon: PlusCircle,
        title: "Adding a custom exercise",
        description:
          "Tap New exercise. Enter the name, pick the muscle group and equipment type. Optionally set exercise type and primary/secondary muscles. Custom exercises appear everywhere in the app.",
        tip: "Pick the right equipment type — it determines which weight-entry fields appear in the logger.",
      },
      {
        icon: TrendingUp,
        title: "Exercise progress shortcut",
        description:
          "On each exercise card in the library, tap the chart icon (↗) to jump straight to that exercise's progress chart in Analytics.",
      },
    ],
  },
];

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({ step, index, isLast }: { step: Step; index: number; isLast: boolean }) {
  return (
    <div className="flex gap-3 sm:gap-4">
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-active sm:size-10">
          <step.icon className="size-4 text-muted-foreground sm:size-5" />
        </div>
        {!isLast && <div className="mt-2 w-px flex-1 bg-border/40" />}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1 pb-5 sm:pb-6">
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 sm:text-[10px]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="mt-0.5 font-heading text-sm font-bold text-foreground sm:text-base">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
        {step.tip && (
          <div className="mt-2.5 flex gap-2 rounded-lg border border-volt/20 bg-volt/5 px-3 py-2.5">
            <Zap className="mt-0.5 size-3 shrink-0 text-volt sm:size-3.5" />
            <p className="text-xs leading-relaxed text-volt/80">{step.tip}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Guide() {
  const [active, setActive] = useState("start");
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  const handleSelect = (id: string) => {
    setActive(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Help" title="User guide" testid="guide-title" />
      <p className="mb-5 text-sm text-muted-foreground">
        Everything you need to get the most out of IronCore — from your first workout to reading your analytics.
      </p>

      {/* ── Mobile tab strip (full-width, above content) ──────────────── */}
      <div className="-mx-4 mb-5 overflow-x-auto px-4 lg:hidden">
        <div className="flex gap-2 pb-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelect(s.id)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
                active === s.id
                  ? `${s.border} ${s.bg} ${s.color}`
                  : "border-border text-muted-foreground hover:border-input hover:text-foreground",
              )}
            >
              <s.icon className="size-3.5 shrink-0" />
              <span className="whitespace-nowrap">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Layout: sidebar + content ─────────────────────────────────── */}
      <div className="flex gap-6 lg:gap-8">

        {/* Desktop sidebar nav */}
        <nav className="hidden w-48 shrink-0 flex-col gap-0.5 lg:flex">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelect(s.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                active === s.id
                  ? "bg-surface-active text-foreground shadow-[inset_3px_0_0_var(--volt)]"
                  : "text-muted-foreground hover:bg-surface-active/60 hover:text-foreground",
              )}
            >
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", s.bg)}>
                <s.icon className={cn("size-3.5", s.color)} />
              </span>
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </nav>

        {/* Section content — full width on mobile, flex-1 on desktop */}
        <div className="w-full min-w-0 lg:flex-1">
          {/* Section header card */}
          <div className={cn("mb-5 rounded-2xl border p-4 sm:p-5 animate-fade-up", section.bg, section.border)}>
            <div className="flex items-start gap-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-background/40 sm:size-10", section.bg)}>
                <section.icon className={cn("size-5", section.color)} />
              </span>
              <div className="min-w-0">
                <h2 className="font-heading text-lg font-extrabold text-foreground sm:text-xl">
                  {section.headline}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{section.sub}</p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="animate-fade-up">
            {section.steps.map((step, i) => (
              <StepCard
                key={step.title}
                step={step}
                index={i}
                isLast={i === section.steps.length - 1}
              />
            ))}
          </div>

          {/* Quick-nav to other sections */}
          <div className="mt-4 border-t border-border/50 pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Explore more
            </p>
            <div className="flex flex-wrap gap-2">
              {SECTIONS.filter((s) => s.id !== active).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelect(s.id)}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-input hover:text-foreground active:bg-surface-active"
                >
                  <s.icon className="size-3 shrink-0" />
                  {s.label}
                  <ChevronRight className="size-3 opacity-40" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
