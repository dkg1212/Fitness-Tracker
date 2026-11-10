/**
 * OnboardingTour — Interactive guided tour for IronCore.
 *
 * Key design decisions:
 *
 * MOBILE vs DESKTOP selectors
 * ───────────────────────────
 * On desktop (≥1024px, `lg:` breakpoint) the sidebar is visible and the bottom
 * nav is hidden. On mobile (<1024px) the bottom nav is shown and the sidebar is
 * hidden. We detect which is visible at measurement time by checking if the
 * target element has non-zero dimensions and is actually in the viewport, then
 * fall back to the alternative selector. This avoids hardcoded breakpoints.
 *
 * MOBILE TOOLTIP PLACEMENT
 * ────────────────────────
 * Bottom nav items sit at the very bottom of the screen. The tooltip must float
 * ABOVE the highlighted element. We detect "bottom nav" vs "sidebar" by checking
 * whether the target's top-edge is in the bottom 25% of the viewport.
 *
 * SCROLL LOCK
 * ───────────
 * While the tour is active we set `overflow: hidden` on <body> to prevent
 * accidental scrolling. We clean it up on unmount / idle.
 *
 * SAFE AREAS
 * ──────────
 * We read `visualViewport.height` (which excludes browser UI chrome on mobile)
 * and subtract the bottom safe-area inset so tooltips never hide under it.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  History,
  LayoutDashboard,
  Layers,
  List,
  PlayCircle,
  Plus,
  Save,
  Search,
  TrendingUp,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompleteOnboarding } from "@/lib/hooks";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TourStep {
  id: string;
  /** Route to navigate to before highlighting the element */
  route: string;
  /**
   * Comma-separated list of CSS selectors, tried in order.
   * We pick the first one that resolves to a visible (non-zero-size) element.
   * Put the more-specific / higher-priority selector first.
   */
  targetSelector: string;
  title: string;
  description: string;
  icon: typeof Dumbbell;
  /**
   * Preferred placement direction for the tooltip.
   * "auto-above" = always place the tooltip above the target (good for bottom-nav items).
   * "auto" = let the engine decide.
   */
  placement?: "top" | "bottom" | "left" | "right" | "auto-above" | "auto" | "center";
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  icon: typeof Dumbbell;
  steps: TourStep[];
}

// ─── MAIN APP TOUR (8 steps) ──────────────────────────────────────────────────

export const APP_TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    route: "/",
    // Desktop: sidebar link. Mobile: bottom nav "Today" tab.
    targetSelector: '[data-testid="side-dashboard"], [data-testid="nav-today"]',
    title: "Dashboard",
    description:
      "Your home base. See today's scheduled workout, week stats, recent sessions, and your top personal records — all at a glance.",
    icon: LayoutDashboard,
    placement: "auto",
  },
  {
    id: "logger",
    route: "/workout/active",
    // Desktop: sidebar "Active Logger". Mobile: bottom nav "Train" tab.
    targetSelector: '[data-testid="side-active-logger"], [data-testid="nav-train"]',
    title: "Active Workout Logger",
    description:
      "Start a session from a template or go freestyle. Log sets, weights, and reps in real time. The app auto-saves so you never lose progress.",
    icon: PlayCircle,
    placement: "auto",
  },
  {
    id: "history",
    route: "/history",
    // Desktop: sidebar. Mobile: bottom nav "History" tab.
    targetSelector: '[data-testid="side-history"], [data-testid="nav-history"]',
    title: "Workout History",
    description:
      "Browse every session you've ever logged. Tap any entry to view the full breakdown — exercises, sets, volume, and duration.",
    icon: History,
    placement: "auto",
  },
  {
    id: "split",
    route: "/split",
    // Desktop: sidebar "Split Planner". Mobile: top-bar calendar icon (no bottom-nav split item).
    targetSelector: '[data-testid="side-split-planner"], [data-testid="mobile-split-link"]',
    title: "Split Planner",
    description:
      "Assign templates to days of the week. IronCore uses your plan to show the right workout on the Dashboard every morning.",
    icon: CalendarDays,
    placement: "auto",
  },
  {
    id: "exercises",
    route: "/exercises",
    // Desktop: sidebar. Mobile: top-bar dumbbell icon.
    targetSelector: '[data-testid="side-exercises"], [data-testid="mobile-exercises-link"]',
    title: "Exercise Library",
    description:
      "Browse 80+ built-in exercises or create your own. Each exercise tracks muscle groups, equipment, and compound vs isolation type.",
    icon: Dumbbell,
    placement: "auto",
  },
  {
    id: "templates",
    route: "/templates",
    // Desktop: sidebar. Mobile: bottom nav "Plan" tab.
    targetSelector: '[data-testid="side-templates"], [data-testid="nav-plan"]',
    title: "Templates",
    description:
      "Build reusable workout templates — give them a name, add exercises, set target sets and reps. Use them to start workouts instantly.",
    icon: Layers,
    placement: "auto",
  },
  {
    id: "analytics",
    route: "/analytics",
    // Desktop: sidebar. Mobile: bottom nav "Stats" tab.
    targetSelector: '[data-testid="side-analytics"], [data-testid="nav-analytics"]',
    title: "Progress & 1RM",
    description:
      "Track your progress over time. See e1RM curves, volume charts, and muscle group breakdowns. Personal records are automatically detected.",
    icon: BarChart2,
    placement: "auto",
  },
  {
    id: "profile",
    route: "/",
    // Desktop: topbar or sidebar dropdown. Mobile: avatar button in top bar.
    targetSelector:
      '[data-testid="sidebar-profile-button"], [data-testid="topbar-profile-button"], [data-testid="mobile-profile-button"]',
    title: "Profile & Settings",
    description:
      "Update your name, bodyweight, height, and sex. These values power your 1RM estimates and training load calculations. Access tutorials and replay this tour anytime.",
    icon: UserRound,
    placement: "auto",
  },
];

// ─── TUTORIAL: Add a custom exercise ─────────────────────────────────────────

export const TUTORIAL_CUSTOM_EXERCISE: Tutorial = {
  id: "custom-exercise",
  title: "How to Add a Custom Exercise",
  description: "Create an exercise that isn't in the default library.",
  icon: Plus,
  steps: [
    {
      id: "ex-nav",
      route: "/exercises",
      targetSelector: '[data-testid="side-exercises"], [data-testid="mobile-exercises-link"]',
      title: "Open Exercise Library",
      description:
        "The Exercise Library lives in the sidebar on desktop, or the dumbbell icon in the top bar on mobile. It contains 80+ built-in exercises — and you can add your own.",
      icon: Dumbbell,
      placement: "auto",
    },
    {
      id: "ex-create-btn",
      route: "/exercises",
      targetSelector: '[data-testid="exercise-create-button"]',
      title: "Custom Exercise Button",
      description:
        "Tap \"+ Custom exercise\" at the top of the Exercise Library page. This opens the exercise creation form where you define every detail.",
      icon: Plus,
      placement: "auto",
    },
    {
      id: "ex-search",
      route: "/exercises",
      targetSelector: '[data-testid="exercise-search-input"]',
      title: "Search First",
      description:
        "Before creating a new exercise, search the library to make sure it doesn't already exist. Use the search bar to filter by name.",
      icon: Search,
      placement: "auto",
    },
    {
      id: "ex-form-explained",
      route: "/exercises",
      targetSelector: '[data-testid="exercise-create-button"]',
      title: "What the Form Asks For",
      description:
        "The form has: Name, Muscle group (e.g. Chest), Equipment (e.g. Barbell), Exercise type (Compound hits multiple joints; Isolation targets one), Primary muscles (the main targets), and Secondary muscles (assistors that help but aren't the focus).",
      icon: List,
      placement: "auto",
    },
    {
      id: "ex-muscle-filter",
      route: "/exercises",
      targetSelector: '[data-testid="muscle-group-filter-all"]',
      title: "Filter by Muscle Group",
      description:
        "Once your exercise is saved it appears in the library. Use the muscle group chips to filter and find it quickly. It will also show up when you search inside a workout.",
      icon: Dumbbell,
      placement: "auto",
    },
  ],
};

// ─── TUTORIAL: Add exercise to workout ────────────────────────────────────────

export const TUTORIAL_ADD_TO_WORKOUT: Tutorial = {
  id: "add-to-workout",
  title: "How to Add an Exercise to a Workout",
  description: "Find and add any exercise while a session is active.",
  icon: PlayCircle,
  steps: [
    {
      id: "atw-logger",
      route: "/workout/active",
      targetSelector: '[data-testid="side-active-logger"], [data-testid="nav-train"]',
      title: "Open the Logger",
      description:
        "Go to Train (bottom nav on mobile, or Active Logger in the sidebar on desktop). Start a new session from a template or tap \"Start empty workout\".",
      icon: PlayCircle,
      placement: "auto",
    },
    {
      id: "atw-logger-page",
      route: "/workout/active",
      targetSelector: '[data-testid="logger-start-empty-button"], [data-testid="logger-empty-title"]',
      title: "Start a Session",
      description:
        "Tap \"Start empty workout\" to open a blank session, or tap a template card to load pre-filled exercises. Both let you add exercises freely.",
      icon: PlayCircle,
      placement: "auto",
    },
    {
      id: "atw-train-nav",
      route: "/workout/active",
      targetSelector: '[data-testid="side-active-logger"], [data-testid="nav-train"]',
      title: "Inside the Logger",
      description:
        "Once a session is running, scroll down past your current exercises and tap \"+ Add exercise\". A searchable picker opens showing every exercise in the library.",
      icon: Search,
      placement: "auto",
    },
    {
      id: "atw-history-ref",
      route: "/workout/active",
      targetSelector: '[data-testid="side-history"], [data-testid="nav-history"]',
      title: "Log Sets & Save",
      description:
        "After adding an exercise, enter weight, reps, and optionally RPE or RIR for each set. Tap the checkmark to complete a set. The session auto-saves — your data is never lost.",
      icon: Save,
      placement: "auto",
    },
  ],
};

// ─── TUTORIAL: Workout Logger deep-dive ───────────────────────────────────────

export const TUTORIAL_LOGGER: Tutorial = {
  id: "logger",
  title: "How to Use the Workout Logger",
  description: "Make the most of real-time session tracking.",
  icon: PlayCircle,
  steps: [
    {
      id: "log-nav",
      route: "/workout/active",
      targetSelector: '[data-testid="side-active-logger"], [data-testid="nav-train"]',
      title: "Active Logger",
      description:
        "The Train tab is your live workout hub. If a session is in progress the tab glows green. Tap it to resume from anywhere in the app.",
      icon: PlayCircle,
      placement: "auto",
    },
    {
      id: "log-templates",
      route: "/workout/active",
      targetSelector: '[data-testid="logger-empty-title"]',
      title: "Start from a Template",
      description:
        "When no session is active you'll see template cards. Tap one to load your pre-planned exercises — sets, reps, and rest times are pre-filled.",
      icon: Layers,
      placement: "auto",
    },
    {
      id: "log-history-link",
      route: "/history",
      targetSelector: '[data-testid="side-history"], [data-testid="nav-history"]',
      title: "Review After Finishing",
      description:
        "After tapping Finish, your session is saved to Workout History. You'll see total volume, duration, and all completed sets. Personal records are automatically flagged.",
      icon: History,
      placement: "auto",
    },
  ],
};

// ─── TUTORIAL: Progress & e1RM ────────────────────────────────────────────────

export const TUTORIAL_ANALYTICS: Tutorial = {
  id: "analytics",
  title: "How to Understand Progress & e1RM",
  description: "Read your strength curves and spot personal records.",
  icon: TrendingUp,
  steps: [
    {
      id: "an-nav",
      route: "/analytics",
      targetSelector: '[data-testid="side-analytics"], [data-testid="nav-analytics"]',
      title: "Progress & 1RM",
      description:
        "The Stats tab (desktop: Progress & 1RM in the sidebar) shows your strength trajectory across all exercises.",
      icon: BarChart2,
      placement: "auto",
    },
    {
      id: "an-e1rm",
      route: "/analytics",
      targetSelector: '[data-testid="side-analytics"], [data-testid="nav-analytics"]',
      title: "What is e1RM?",
      description:
        "Estimated 1-Rep Max (e1RM) is calculated from your logged sets using the Brzycki formula. It lets you compare sets at different rep ranges to track pure strength over time.",
      icon: TrendingUp,
      placement: "auto",
    },
    {
      id: "an-volume",
      route: "/analytics",
      targetSelector: '[data-testid="side-analytics"], [data-testid="nav-analytics"]',
      title: "Volume & Muscle Workload",
      description:
        "The volume chart tracks total kg lifted per week. The muscle workload breakdown shows how evenly you're training each muscle group — useful for spotting imbalances.",
      icon: BarChart2,
      placement: "auto",
    },
    {
      id: "an-pr-dash",
      route: "/",
      targetSelector: '[data-testid="today-card"]',
      title: "PRs on the Dashboard",
      description:
        "New personal records are automatically detected the moment you finish a session. They're highlighted in the post-workout summary and appear in the Top Lifts card on your Dashboard.",
      icon: LayoutDashboard,
      placement: "auto",
    },
  ],
};

// All tutorials registered here — used by the Guide page
export const ALL_TUTORIALS: Tutorial[] = [
  TUTORIAL_CUSTOM_EXERCISE,
  TUTORIAL_ADD_TO_WORKOUT,
  TUTORIAL_LOGGER,
  TUTORIAL_ANALYTICS,
];

// ─── Geometry helpers ─────────────────────────────────────────────────────────

interface Rect { top: number; left: number; width: number; height: number }
interface TooltipPos {
  top: number;
  left: number;
  arrowSide: "top" | "bottom" | "left" | "right" | null;
}

const TOOLTIP_W = 320;
const TOOLTIP_H_EST = 230;
const MARGIN = 14;
const SCREEN_PAD = 12;

/** Returns the usable viewport height, accounting for browser chrome and safe areas. */
function getViewportHeight(): number {
  // visualViewport is more accurate on mobile (excludes browser chrome)
  const vvH = window.visualViewport?.height ?? window.innerHeight;
  // Read CSS env(safe-area-inset-bottom) if available
  const safeBottom = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--sab") || "0",
    10,
  ) || 0;
  return vvH - safeBottom;
}

function getViewportWidth(): number {
  return window.visualViewport?.width ?? window.innerWidth;
}

/** Determine if a resolved element is "in the bottom nav zone" (bottom 20% of screen). */
function isInBottomNav(rect: Rect): boolean {
  const vh = getViewportHeight();
  return rect.top > vh * 0.75;
}

/** Determine if a resolved element is "in the top bar zone" (top 10% of screen). */
function isInTopBar(rect: Rect): boolean {
  return rect.top < getViewportHeight() * 0.12;
}

function computeTooltipPos(
  rect: Rect,
  placement: TourStep["placement"],
  vw: number,
  vh: number,
): TooltipPos {
  if (placement === "center" || !rect.width) {
    return {
      top: Math.max(SCREEN_PAD, (vh - TOOLTIP_H_EST) / 2),
      left: Math.max(SCREEN_PAD, (vw - TOOLTIP_W) / 2),
      arrowSide: null,
    };
  }

  // Auto-detect best placement based on where the target actually lives
  let effectivePlacement = placement;
  if (placement === "auto" || placement === "auto-above") {
    if (isInBottomNav(rect)) {
      effectivePlacement = "top"; // tooltip above the bottom nav item
    } else if (isInTopBar(rect)) {
      effectivePlacement = "bottom"; // tooltip below the top-bar icon
    } else {
      // Sidebar item on desktop — prefer right, fall back to below
      effectivePlacement = "right";
    }
  }

  const tryPlacements: Array<typeof effectivePlacement> = [
    effectivePlacement!,
    "bottom",
    "top",
    "right",
    "left",
  ];

  for (const p of tryPlacements) {
    let top = 0;
    let left = 0;
    let arrowSide: TooltipPos["arrowSide"] = null;

    if (p === "right") {
      left = rect.left + rect.width + MARGIN;
      top = rect.top + rect.height / 2 - TOOLTIP_H_EST / 2;
      arrowSide = "left";
    } else if (p === "left") {
      left = rect.left - TOOLTIP_W - MARGIN;
      top = rect.top + rect.height / 2 - TOOLTIP_H_EST / 2;
      arrowSide = "right";
    } else if (p === "bottom") {
      top = rect.top + rect.height + MARGIN;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      arrowSide = "top";
    } else if (p === "top") {
      top = rect.top - TOOLTIP_H_EST - MARGIN;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      arrowSide = "bottom";
    }

    // Clamp within safe viewport
    const maxLeft = vw - TOOLTIP_W - SCREEN_PAD;
    left = Math.max(SCREEN_PAD, Math.min(left, maxLeft));
    top = Math.max(SCREEN_PAD, Math.min(top, vh - TOOLTIP_H_EST - SCREEN_PAD));

    // Accept this placement if the tooltip doesn't substantially overlap the target
    const overlapsX =
      left < rect.left + rect.width + 4 && left + TOOLTIP_W > rect.left - 4;
    const overlapsY =
      top < rect.top + rect.height + 4 && top + TOOLTIP_H_EST > rect.top - 4;

    if (!overlapsX || !overlapsY) {
      return { top, left, arrowSide };
    }
  }

  // Absolute fallback: center
  return {
    top: Math.max(SCREEN_PAD, (vh - TOOLTIP_H_EST) / 2),
    left: Math.max(SCREEN_PAD, (vw - TOOLTIP_W) / 2),
    arrowSide: null,
  };
}

// ─── Element resolver ─────────────────────────────────────────────────────────

/**
 * Find the first visible element from a comma-separated selector list.
 * "Visible" means: in the DOM, non-zero bounding rect, not `display:none`.
 */
function resolveTarget(selectorString: string): Element | null {
  const selectors = selectorString.split(",").map((s) => s.trim()).filter(Boolean);
  for (const sel of selectors) {
    try {
      const candidates = Array.from(document.querySelectorAll(sel));
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          // Check it's not `display:none` via its style
          const style = window.getComputedStyle(el);
          if (style.display !== "none" && style.visibility !== "hidden") {
            return el;
          }
        }
      }
    } catch {
      // Invalid selector — skip
    }
  }
  return null;
}

// ─── Spotlight SVG ────────────────────────────────────────────────────────────

function SpotlightOverlay({
  rect,
  padding = 8,
  borderRadius = 12,
}: {
  rect: Rect | null;
  padding?: number;
  borderRadius?: number;
}) {
  const vw = getViewportWidth();
  const vh = window.innerHeight; // use full innerHeight for the SVG so it covers browser chrome too

  if (!rect || !rect.width) {
    return <div className="pointer-events-none fixed inset-0 z-[9990] bg-black/72" />;
  }

  const x = Math.max(0, rect.left - padding);
  const y = Math.max(0, rect.top - padding);
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;
  const r = Math.min(borderRadius, w / 2, h / 2);

  const path = [
    `M 0 0 H ${vw} V ${vh} H 0 Z`,
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `Z`,
  ].join(" ");

  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[9990]"
      width={vw}
      height={vh}
      viewBox={`0 0 ${vw} ${vh}`}
      style={{ display: "block", transition: "all 0.25s ease" }}
      aria-hidden
    >
      <defs>
        <filter id="tour-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <path d={path} fill="rgba(0,0,0,0.75)" fillRule="evenodd" />
      {/* Volt highlight ring */}
      <rect
        x={x - 2}
        y={y - 2}
        width={w + 4}
        height={h + 4}
        rx={r + 2}
        fill="none"
        stroke="#22C55E"
        strokeWidth="2"
        opacity="0.85"
        filter="url(#tour-glow)"
      />
    </svg>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function WelcomeScreen({
  name,
  stepCount,
  onStart,
  onSkip,
}: {
  name: string;
  stepCount: number;
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm animate-fade-up rounded-2xl border border-border bg-popover p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-volt/15 blur-3xl" />

        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-volt text-volt-ink shadow-[0_0_24px_rgba(34,197,94,0.4)]">
            <Zap className="size-6" strokeWidth={2.6} />
          </span>
          <span className="font-heading text-xl font-extrabold uppercase tracking-tight">
            Iron<span className="text-volt">Core</span>
          </span>
        </div>

        <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">
          Welcome, <span className="text-volt">{name}</span>!
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Let's take a quick tour so you know where everything lives.
        </p>

        <ul className="mt-5 space-y-2">
          {[
            "Track workouts with smart set logging",
            "Build your weekly training split",
            "Monitor PRs and progress over time",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 shrink-0 text-volt" />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onStart}
            data-testid="onboarding-start-button"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-volt px-5 font-bold text-volt-ink transition-opacity hover:opacity-90 active:scale-[0.97]"
          >
            <ArrowRight className="size-4" /> Start tour ({stepCount} steps)
          </button>
          <button
            type="button"
            onClick={onSkip}
            data-testid="onboarding-skip-button"
            className="flex h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold text-muted-foreground transition-colors hover:border-input hover:text-foreground"
          >
            Skip for now
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground/60">
          Replay the tour anytime from your account menu.
        </p>
      </div>
    </div>
  );
}

// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({
  isTutorial,
  onFinish,
}: {
  isTutorial: boolean;
  onFinish: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm animate-fade-up rounded-2xl border border-border bg-popover p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-volt/15 blur-3xl" />

        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-volt/15">
          <CheckCircle2 className="size-7 text-volt" />
        </div>

        <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">
          {isTutorial ? "Tutorial complete!" : "You're all set!"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isTutorial
            ? "Head to the app and try it out. You can replay this tutorial anytime from the Guide page."
            : "You've seen everything IronCore has to offer. Time to start training."}
        </p>

        {!isTutorial && (
          <ul className="mt-5 space-y-2">
            {[
              "Set up your split planner",
              "Create a workout template",
              "Log your first session",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <ArrowRight className="size-4 shrink-0 text-volt" />
                {item}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onFinish}
          data-testid="onboarding-finish-button"
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-volt px-5 font-bold text-volt-ink transition-opacity hover:opacity-90 active:scale-[0.97]"
        >
          <Zap className="size-4" strokeWidth={2.6} />
          {isTutorial ? "Got it" : "Start training"}
        </button>
      </div>
    </div>
  );
}

// ─── Step tooltip ─────────────────────────────────────────────────────────────

function StepTooltip({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: Rect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const [dims, setDims] = useState({ vw: getViewportWidth(), vh: getViewportHeight() });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Re-read viewport on every render (orientation changes etc.)
  useEffect(() => {
    const update = () => setDims({ vw: getViewportWidth(), vh: getViewportHeight() });
    window.addEventListener("resize", update, { passive: true });
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  const Icon = step.icon;

  const effectiveRect: Rect = targetRect ?? { top: 0, left: 0, width: 0, height: 0 };
  const pos = computeTooltipPos(effectiveRect, step.placement ?? "auto", dims.vw, dims.vh);

  // Tooltip width: on narrow screens fill the available width minus padding
  const tooltipWidth = Math.min(TOOLTIP_W, dims.vw - SCREEN_PAD * 2);

  const arrowBase = "absolute size-2.5 border-border bg-popover";

  return (
    <div
      ref={tooltipRef}
      data-testid={`onboarding-step-${step.id}`}
      className="fixed z-[9999] animate-fade-up"
      style={{ top: pos.top, left: pos.left, width: tooltipWidth }}
    >
      {/* Directional arrow */}
      {pos.arrowSide === "left" && (
        <span
          className={cn(arrowBase, "border-b border-l")}
          style={{
            left: -5,
            top: "50%",
            transform: "translateY(-50%) rotate(45deg)",
            position: "absolute",
          }}
        />
      )}
      {pos.arrowSide === "right" && (
        <span
          className={cn(arrowBase, "border-r border-t")}
          style={{
            right: -5,
            top: "50%",
            transform: "translateY(-50%) rotate(45deg)",
            position: "absolute",
          }}
        />
      )}
      {pos.arrowSide === "top" && (
        <span
          className={cn(arrowBase, "border-l border-t")}
          style={{
            top: -5,
            left: "50%",
            transform: "translateX(-50%) rotate(45deg)",
            position: "absolute",
          }}
        />
      )}
      {pos.arrowSide === "bottom" && (
        <span
          className={cn(arrowBase, "border-b border-r")}
          style={{
            bottom: -5,
            left: "50%",
            transform: "translateX(-50%) rotate(45deg)",
            position: "absolute",
          }}
        />
      )}

      {/* Card body */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
        {/* Subtle volt gradient at top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-volt/50 to-transparent" />

        {/* Skip × */}
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip tour"
          data-testid="onboarding-step-skip"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground active:scale-95"
        >
          <X className="size-3.5" />
        </button>

        {/* Content */}
        <div className="p-4 pb-3">
          <div className="mb-2.5 flex items-center gap-2.5 pr-8">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-volt/15">
              <Icon className="size-4 text-volt" />
            </span>
            <h3 className="font-heading text-[15px] font-bold leading-snug">{step.title}</h3>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          {/* Dot progress */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "rounded-full transition-all duration-200",
                  i === stepIndex
                    ? "h-1.5 w-3 bg-volt"
                    : "size-1.5 bg-border",
                )}
              />
            ))}
          </div>

          {/* Nav */}
          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                type="button"
                onClick={onPrev}
                data-testid="onboarding-step-prev"
                className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-input hover:text-foreground active:scale-95"
              >
                <ArrowLeft className="size-3" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              data-testid="onboarding-step-next"
              className="flex h-9 items-center gap-1 rounded-xl bg-volt px-4 text-xs font-bold text-volt-ink transition-opacity hover:opacity-90 active:scale-95"
            >
              {isLast ? "Finish" : "Next"} <ArrowRight className="size-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main controller ──────────────────────────────────────────────────────────

type TourPhase = "welcome" | "touring" | "done" | "idle";

export interface OnboardingTourProps {
  userName: string;
  /** true → show welcome screen first (new user / replay main tour) */
  autoStart: boolean;
  /** Steps to run. Defaults to APP_TOUR_STEPS. */
  steps?: TourStep[];
  /** Is this a named tutorial (not the full onboarding)? */
  isTutorial?: boolean;
  /** Called when user skips — does NOT persist completion */
  onSkip: () => void;
  /** Called when user finishes — persists completion (main tour only) */
  onComplete: () => void;
}

export default function OnboardingTour({
  userName,
  autoStart,
  steps = APP_TOUR_STEPS,
  isTutorial = false,
  onSkip,
  onComplete,
}: OnboardingTourProps) {
  const navigate = useNavigate();
  const complete = useCompleteOnboarding();

  const [phase, setPhase] = useState<TourPhase>(autoStart ? "welcome" : "idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [navigating, setNavigating] = useState(false);
  const rafRef = useRef<number>(0);
  const retryRef = useRef<ReturnType<typeof setTimeout>>();

  const step = steps[stepIndex];

  // ── Scroll lock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "idle") {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [phase]);

  // ── Target measurement ──────────────────────────────────────────────────────
  const measureTarget = useCallback(() => {
    if (phase !== "touring" || !step) return;

    const el = resolveTarget(step.targetSelector);

    if (!el) {
      setTargetRect(null);
      return;
    }

    // Scroll into view without touching body scroll (the element may be fixed)
    const r = el.getBoundingClientRect();
    const isFixed =
      window.getComputedStyle(el).position === "fixed" ||
      window.getComputedStyle(el).position === "sticky";

    if (!isFixed) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }

    // Re-read after potential scroll
    const r2 = el.getBoundingClientRect();
    setTargetRect({ top: r2.top, left: r2.left, width: r2.width, height: r2.height });
  }, [phase, step]);

  // Run measurement after navigation + DOM settle
  useLayoutEffect(() => {
    if (phase !== "touring") return;

    clearTimeout(retryRef.current);
    cancelAnimationFrame(rafRef.current);

    const run = () => {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          measureTarget();
          setNavigating(false);
        });
      });
    };

    run();
    // Extra retry for async-rendered pages
    retryRef.current = setTimeout(run, 400);

    return () => {
      clearTimeout(retryRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, stepIndex, navigating, measureTarget]);

  // Re-measure on viewport resize / orientation change
  useEffect(() => {
    if (phase !== "touring") return;
    const handler = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => measureTarget());
    };
    window.addEventListener("resize", handler, { passive: true });
    window.addEventListener("orientationchange", handler);
    window.visualViewport?.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("orientationchange", handler);
      window.visualViewport?.removeEventListener("resize", handler);
    };
  }, [phase, measureTarget]);

  // ── Step navigation ─────────────────────────────────────────────────────────
  const goToStep = useCallback(
    (index: number) => {
      const target = steps[index];
      if (!target) return;
      setTargetRect(null);
      setStepIndex(index);
      setNavigating(true);
      navigate(target.route);
    },
    [navigate, steps],
  );

  const handleStart = () => {
    setPhase("touring");
    setStepIndex(0);
    setNavigating(true);
    navigate(steps[0].route);
  };

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      goToStep(stepIndex + 1);
    } else {
      setPhase("done");
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) goToStep(stepIndex - 1);
  };

  const handleSkip = () => {
    setPhase("idle");
    document.body.style.overflow = "";
    onSkip();
  };

  const handleFinish = () => {
    setPhase("idle");
    document.body.style.overflow = "";
    if (!isTutorial) {
      complete.mutate(undefined, { onSuccess: onComplete });
    } else {
      onComplete();
    }
    navigate("/");
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (phase === "idle") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSkip();
      if (phase === "touring") {
        if (e.key === "ArrowRight") handleNext();
        if (e.key === "ArrowLeft") handlePrev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // deps intentionally limited — handlers close over latest stepIndex via callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (phase === "idle") return null;

  if (phase === "welcome") {
    return createPortal(
      <WelcomeScreen
        name={userName}
        stepCount={steps.length}
        onStart={handleStart}
        onSkip={handleSkip}
      />,
      document.body,
    );
  }

  if (phase === "done") {
    return createPortal(
      <CompletionScreen isTutorial={isTutorial} onFinish={handleFinish} />,
      document.body,
    );
  }

  // touring
  return createPortal(
    <>
      {/* Full-screen click-blocker (behind tooltip, above spotlight) */}
      <div
        className="fixed inset-0 z-[9989] cursor-default touch-none"
        onTouchMove={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        aria-hidden
      />

      <SpotlightOverlay rect={targetRect} />

      {!navigating && step && (
        <StepTooltip
          step={step}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          targetRect={targetRect}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
        />
      )}
    </>,
    document.body,
  );
}
