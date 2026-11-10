import { useEffect, useRef, useState, useCallback } from "react";
import { NavLink, Navigate, Outlet, useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth, useClerk, useUser } from "@clerk/react";
import {
  CalendarDays, Dumbbell, History, Layers, LayoutDashboard,
  LogOut, PlayCircle, TrendingUp, UserRound, Zap, ChevronDown, X, BookOpen, MapPin,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useActiveWorkout, useMe, useResetOnboarding } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import OnboardingTour, {
  APP_TOUR_STEPS,
  ALL_TUTORIALS,
  type TourStep,
} from "@/components/OnboardingTour";

const SIDE = [
  { label: "Dashboard",        to: "/",               icon: LayoutDashboard, testid: "side-dashboard" },
  { label: "Active Logger",    to: "/workout/active", icon: PlayCircle,      testid: "side-active-logger" },
  { label: "Workout History",  to: "/history",        icon: History,         testid: "side-history" },
  { label: "Split Planner",    to: "/split",          icon: CalendarDays,    testid: "side-split-planner" },
  { label: "Templates",        to: "/templates",      icon: Layers,          testid: "side-templates" },
  { label: "Exercise Library", to: "/exercises",      icon: Dumbbell,        testid: "side-exercises" },
  { label: "Progress & 1RM",   to: "/analytics",      icon: TrendingUp,      testid: "side-analytics" },
  { label: "User Guide",       to: "/guide",          icon: BookOpen,        testid: "side-guide" },
];

const BOTTOM = [
  { label: "Today",   to: "/",               icon: LayoutDashboard, testid: "nav-today" },
  { label: "Train",   to: "/workout/active", icon: Dumbbell,        testid: "nav-train" },
  { label: "History", to: "/history",        icon: History,         testid: "nav-history" },
  { label: "Plan",    to: "/templates",      icon: Layers,          testid: "nav-plan" },
  { label: "Stats",   to: "/analytics",      icon: TrendingUp,      testid: "nav-analytics" },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5" data-testid="brand-link">
      <span className="grid size-9 place-items-center rounded-md bg-volt text-volt-ink">
        <Zap className="size-5" strokeWidth={2.6} />
      </span>
      <span className="font-heading text-lg font-extrabold uppercase tracking-tight text-foreground">
        Iron<span className="text-volt">Core</span>
      </span>
    </Link>
  );
}

// ─── Mobile bottom sheet account menu ────────────────────────────────────────

function MobileAccountSheet({
  open,
  onClose,
  displayName,
  initial,
  onReplayTour,
}: {
  open: boolean;
  onClose: () => void;
  displayName: string;
  initial: string;
  onReplayTour: () => void;
}) {
  const navigate = useNavigate();
  const { signOut } = useClerk();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col justify-end"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet panel */}
      <div
        className="relative z-10 w-full rounded-t-2xl border-t border-border bg-popover pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-volt text-sm font-extrabold text-volt-ink">
              {initial}
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">Signed in</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-active hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mx-4 mb-2 h-px bg-border/60" />

        {/* Menu items */}
        <div className="flex flex-col gap-1 px-3 pb-4">
          <button
            type="button"
            onClick={() => { navigate("/profile"); onClose(); }}
            data-testid="account-menu-profile"
            className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-base font-semibold text-foreground transition-colors active:bg-surface-active"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-volt/10 text-volt">
              <UserRound className="size-5" />
            </span>
            Edit profile
          </button>

          <button
            type="button"
            onClick={() => { navigate("/guide"); onClose(); }}
            data-testid="account-menu-guide"
            className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-base font-semibold text-foreground transition-colors active:bg-surface-active"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-cyan-focus/10 text-cyan-focus">
              <BookOpen className="size-5" />
            </span>
            User guide
          </button>

          {/* ── Replay App Tour ── */}
          <button
            type="button"
            onClick={() => { onReplayTour(); onClose(); }}
            data-testid="account-menu-replay-tour"
            className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-base font-semibold text-foreground transition-colors active:bg-surface-active"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-volt/10 text-volt">
              <MapPin className="size-5" />
            </span>
            Replay app tour
          </button>

          <button
            type="button"
            onClick={() => void signOut({ redirectUrl: "/login" })}
            data-testid="account-menu-logout"
            className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-base font-semibold text-crimson transition-colors active:bg-crimson/10"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-crimson/10 text-crimson">
              <LogOut className="size-5" />
            </span>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop dropdown account menu ───────────────────────────────────────────

function DesktopAccountDropdown({
  displayName,
  initial,
  variant,
  onReplayTour,
}: {
  displayName: string;
  initial: string;
  variant: "topbar" | "sidebar";
  onReplayTour: () => void;
}) {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      const keyHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("click", handler);
      document.addEventListener("keydown", keyHandler);
      return () => {
        document.removeEventListener("click", handler);
        document.removeEventListener("keydown", keyHandler);
      };
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  const isTopbar = variant === "topbar";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid={`${variant}-profile-button`}
        className={cn(
          "flex items-center gap-2.5 transition-colors",
          isTopbar
            ? "rounded-xl px-3 py-2 hover:bg-surface-active"
            : "w-full rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-volt font-extrabold text-volt-ink",
            isTopbar ? "size-8 text-sm" : "size-7 text-xs",
          )}
        >
          {initial}
        </span>

        {isTopbar ? (
          <>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-foreground">{displayName}</span>
              <span className="block text-xs text-muted-foreground">Account menu</span>
            </span>
            <ChevronDown
              className={cn(
                "ml-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{displayName}</span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 w-56 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl",
            isTopbar ? "right-0 top-full mt-1.5" : "bottom-full left-0 mb-1.5",
          )}
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => { navigate("/profile"); setOpen(false); }}
            data-testid="account-menu-profile"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-active"
          >
            <UserRound className="size-4 shrink-0 text-volt" />
            Edit profile
          </button>
          <div className="mx-3 h-px bg-border/60" />
          <button
            role="menuitem"
            type="button"
            onClick={() => { navigate("/guide"); setOpen(false); }}
            data-testid="account-menu-guide"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-active"
          >
            <BookOpen className="size-4 shrink-0 text-cyan-focus" />
            User guide
          </button>
          <div className="mx-3 h-px bg-border/60" />

          {/* ── Replay App Tour ── */}
          <button
            role="menuitem"
            type="button"
            onClick={() => { onReplayTour(); setOpen(false); }}
            data-testid="account-menu-replay-tour"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-active"
          >
            <MapPin className="size-4 shrink-0 text-volt" />
            Replay app tour
          </button>
          <div className="mx-3 h-px bg-border/60" />

          <button
            role="menuitem"
            type="button"
            onClick={() => void signOut({ redirectUrl: "/login" })}
            data-testid="account-menu-logout"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-semibold text-crimson transition-colors hover:bg-crimson/10"
          >
            <LogOut className="size-4 shrink-0" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── App shell ───────────────────────────────────────────────────────────────

export default function AppShell() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const me = useMe();
  const active = useActiveWorkout();
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Onboarding tour state ────────────────────────────────────────────────
  const [tourActive, setTourActive] = useState(false);
  const [tourSteps, setTourSteps] = useState<TourStep[]>(APP_TOUR_STEPS);
  const [isTutorial, setIsTutorial] = useState(false);
  const autoStartedRef = useRef(false);

  const resetOnboarding = useResetOnboarding();

  // Auto-start the tour for new users once profile is complete
  useEffect(() => {
    if (
      !autoStartedRef.current &&
      me.data &&
      me.data.weight_kg &&
      me.data.height_cm &&
      me.data.sex &&
      !me.data.onboarding_completed &&
      pathname !== "/profile"
    ) {
      autoStartedRef.current = true;
      setTourSteps(APP_TOUR_STEPS);
      setIsTutorial(false);
      setTourActive(true);
    }
  }, [me.data, pathname]);

  // Launch a specific tutorial via ?tutorial=<id> query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tutorialId = params.get("tutorial");
    if (!tutorialId || !me.data?.weight_kg) return;

    if (tutorialId === "app-tour") {
      // Remove the param so it doesn't re-trigger
      const url = new URL(window.location.href);
      url.searchParams.delete("tutorial");
      window.history.replaceState({}, "", url.toString());
      setTourSteps(APP_TOUR_STEPS);
      setIsTutorial(false);
      setTourActive(true);
      return;
    }

    const tutorial = ALL_TUTORIALS.find((t) => t.id === tutorialId);
    if (tutorial) {
      const url = new URL(window.location.href);
      url.searchParams.delete("tutorial");
      window.history.replaceState({}, "", url.toString());
      setTourSteps(tutorial.steps);
      setIsTutorial(true);
      setTourActive(true);
    }
  // Only run when me.data first loads and when pathname changes (navigation after ?tutorial= nav)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data, pathname]);

  // "Replay app tour" — resets in DB then starts the full tour
  const handleReplayTour = useCallback(() => {
    resetOnboarding.mutate(undefined, {
      onSuccess: () => {
        setTourSteps(APP_TOUR_STEPS);
        setIsTutorial(false);
        setTourActive(true);
      },
    });
  }, [resetOnboarding]);

  const handleTourSkip = useCallback(() => {
    // Skip = dismiss without marking complete; tour will show again next login
    // unless the user explicitly replays and finishes it.
    setTourActive(false);
  }, []);

  const handleTourComplete = useCallback(() => {
    setTourActive(false);
  }, []);

  // Close mobile sheet on navigation
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  if (isLoaded && !isSignedIn) return <Navigate to="/login" replace />;
  if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/login" replace />;
  if (
    me.data && pathname !== "/profile" &&
    (!me.data.weight_kg || !me.data.height_cm || !me.data.sex)
  ) return <Navigate to="/profile?onboarding=1" replace />;

  const onLogger = pathname.startsWith("/workout");
  const hasActive = !!active.data && !active.isError;
  const showResume = hasActive && !onLogger;

  const displayName = user?.username ?? me.data?.name ?? "Athlete";
  const initial = displayName.slice(0, 1).toUpperCase();
  const firstName = me.data?.name?.split(" ")[0] ?? displayName;

  return (
    <div className="min-h-dvh lg:pl-64">

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar/95 px-4 py-6 backdrop-blur lg:flex">
        <Brand />
        <nav className="mt-10 flex flex-1 flex-col gap-0.5">
          {SIDE.map(({ label, to, icon: Icon, testid }) => {
            const isLoggerLink = to === "/workout/active";
            return (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                data-testid={testid}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-sidebar-accent text-foreground shadow-[inset_3px_0_0_var(--volt)]"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground",
                  )
                }
              >
                <span className="relative">
                  <Icon className="size-4 transition-transform duration-150 group-hover:scale-110" />
                  {isLoggerLink && hasActive && (
                    <span className="absolute -right-1 -top-1 size-2 rounded-full border border-sidebar bg-volt" />
                  )}
                </span>
                {label}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-sidebar-border pt-4">
          <DesktopAccountDropdown
            displayName={displayName}
            initial={initial}
            variant="sidebar"
            onReplayTour={handleReplayTour}
          />
        </div>
      </aside>

      {/* ── Mobile top bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <NavLink
            to="/split"
            data-testid="mobile-split-link"
            className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground"
            aria-label="Split planner"
          >
            <CalendarDays className="size-5" />
          </NavLink>
          <NavLink
            to="/exercises"
            data-testid="mobile-exercises-link"
            className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground"
            aria-label="Exercise library"
          >
            <Dumbbell className="size-5" />
          </NavLink>

          {/* Profile button — opens bottom sheet on mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            data-testid="mobile-profile-button"
            aria-label="Account menu"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-active active:bg-surface-active"
          >
            <span className="grid size-8 place-items-center rounded-full bg-volt text-sm font-extrabold text-volt-ink">
              {initial}
            </span>
            <span className="max-w-[80px] truncate text-sm font-semibold text-foreground">
              {displayName}
            </span>
          </button>
        </div>
      </header>

      {/* Mobile bottom sheet — rendered at this level, outside header */}
      <MobileAccountSheet
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        displayName={displayName}
        initial={initial}
        onReplayTour={handleReplayTour}
      />

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-36 pt-4 sm:px-6 lg:px-10 lg:pb-16 lg:pt-6">
        {/* Desktop topbar account */}
        <div className="mb-5 hidden items-center justify-end lg:flex">
          <DesktopAccountDropdown
            displayName={displayName}
            initial={initial}
            variant="topbar"
            onReplayTour={handleReplayTour}
          />
        </div>
        <Outlet />
      </main>

      {/* ── Resume bar ───────────────────────────────────────────────── */}
      {showResume && (
        <Link
          to="/workout/active"
          data-testid="resume-workout-bar"
          className="fixed inset-x-3 bottom-[80px] z-40 flex items-center justify-between rounded-xl border border-volt/50 bg-[#0F172A]/95 px-4 py-3 shadow-2xl backdrop-blur-md transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-80"
        >
          <span className="flex items-center gap-3">
            <span className="size-2.5 animate-pulse-ring rounded-full bg-volt" />
            <span>
              <span className="block text-xs uppercase tracking-wider text-muted-foreground">In progress</span>
              <span className="block font-heading font-bold text-foreground">{active.data?.name}</span>
            </span>
          </span>
          <span className="text-sm font-semibold text-volt">Resume →</span>
        </Link>
      )}

      {/* ── Mobile bottom nav ─────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        {BOTTOM.map(({ label, to, icon: Icon, testid }) => {
          const isTrainTab = to === "/workout/active";
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={testid}
              className={({ isActive }) =>
                cn(
                  "relative flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors active:scale-95",
                  isActive ? "text-volt" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <span className="relative">
                <Icon className="size-5" />
                {isTrainTab && hasActive && (
                  <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-background bg-volt animate-pulse-ring" />
                )}
              </span>
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Onboarding tour (portal, renders above everything) ───────── */}
      {tourActive && (
        <OnboardingTour
          userName={firstName}
          autoStart={tourActive}
          steps={tourSteps}
          isTutorial={isTutorial}
          onSkip={handleTourSkip}
          onComplete={handleTourComplete}
        />
      )}
    </div>
  );
}
