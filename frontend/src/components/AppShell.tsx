import { NavLink, Navigate, Outlet, useLocation, Link } from "react-router-dom";
import { useAuth, useClerk, useUser } from "@clerk/react";
import { CalendarDays, Dumbbell, History, Layers, LayoutDashboard, LogOut, PlayCircle, TrendingUp, UserRound, Zap } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useActiveWorkout, useMe } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const SIDE = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, testid: "side-dashboard" },
  { label: "Active Logger", to: "/workout/active", icon: PlayCircle, testid: "side-active-logger" },
  { label: "Workout History", to: "/history", icon: History, testid: "side-history" },
  { label: "Split Planner", to: "/split", icon: CalendarDays, testid: "side-split-planner" },
  { label: "Templates", to: "/templates", icon: Layers, testid: "side-templates" },
  { label: "Exercise Library", to: "/exercises", icon: Dumbbell, testid: "side-exercises" },
  { label: "Progress & 1RM", to: "/analytics", icon: TrendingUp, testid: "side-analytics" },
  { label: "Profile", to: "/profile", icon: UserRound, testid: "side-profile" },
];

const BOTTOM = [
  { label: "Today", to: "/", icon: LayoutDashboard, testid: "nav-today" },
  { label: "Train", to: "/workout/active", icon: Dumbbell, testid: "nav-train" },
  { label: "History", to: "/history", icon: History, testid: "nav-history" },
  { label: "Plan", to: "/templates", icon: Layers, testid: "nav-plan" },
  { label: "Stats", to: "/analytics", icon: TrendingUp, testid: "nav-analytics" },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5" data-testid="brand-link">
      <span className="grid size-9 place-items-center rounded-md bg-volt text-volt-ink">
        <Zap className="size-5" strokeWidth={2.6} />
      </span>
      <span className="font-heading text-lg font-extrabold uppercase tracking-tight">
        Iron<span className="text-volt">Core</span>
      </span>
    </Link>
  );
}

export default function AppShell() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const me = useMe();
  const active = useActiveWorkout();
  const { pathname } = useLocation();

  if (isLoaded && !isSignedIn) return <Navigate to="/login" replace />;
  if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/login" replace />;
  if (me.data && (!me.data.weight_kg || !me.data.height_cm) && pathname !== "/profile") return <Navigate to="/profile?onboarding=1" replace />;

  const onLogger = pathname.startsWith("/workout");
  const showResume = !!active.data && !active.isError && !onLogger;

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar/95 px-4 py-6 backdrop-blur lg:flex">
        <Brand />
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {SIDE.map(({ label, to, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={testid}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground",
                  isActive && "bg-sidebar-accent text-foreground shadow-[inset_3px_0_0_var(--volt)]",
                )
              }
            >
              <Icon className="size-4.5 transition-transform duration-150 group-hover:scale-110" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="truncate text-sm font-semibold" data-testid="sidebar-user-name">{user?.username ?? me.data?.name ?? "Athlete"}</p>
          <p className="truncate text-xs text-muted-foreground" data-testid="sidebar-user-email">{me.data?.email ?? ""}</p>
          <button
            type="button"
            onClick={() => void signOut({ redirectUrl: "/login" })}
            data-testid="sidebar-logout-button"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-crimson hover:text-crimson"
          >
            <LogOut className="size-3.5" /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <NavLink to="/split" data-testid="mobile-split-link" className="grid size-10 place-items-center rounded-md text-muted-foreground hover:text-foreground" aria-label="Split planner">
            <CalendarDays className="size-5" />
          </NavLink>
          <NavLink to="/exercises" data-testid="mobile-exercises-link" className="grid size-10 place-items-center rounded-md text-muted-foreground hover:text-foreground" aria-label="Exercise library">
            <Dumbbell className="size-5" />
          </NavLink>
          <NavLink to="/profile" data-testid="mobile-profile-link" className="flex max-w-28 items-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold text-foreground hover:bg-surface-active" aria-label="Edit profile">
            <UserRound className="size-4 shrink-0 text-volt" /><span className="truncate">{user?.username ?? me.data?.name ?? "Profile"}</span>
          </NavLink>
          <button type="button" onClick={() => void signOut({ redirectUrl: "/login" })} data-testid="mobile-logout-button" className="grid size-10 place-items-center rounded-md text-muted-foreground hover:text-crimson" aria-label="Log out">
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
        <header className="mb-7 hidden h-14 items-center justify-end border-b border-border lg:flex">
          <Link to="/profile" data-testid="topbar-profile-link" className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-active">
            <span className="grid size-8 place-items-center rounded-full bg-volt text-sm font-extrabold text-volt-ink">{(user?.username ?? me.data?.name ?? "A").slice(0, 1).toUpperCase()}</span>
            <span className="text-right leading-tight"><span className="block text-sm font-semibold">{user?.username ?? me.data?.name ?? "Athlete"}</span><span className="block text-xs text-muted-foreground">View profile</span></span>
          </Link>
        </header>
        <Outlet />
      </main>

      {showResume && (
        <Link
          to="/workout/active"
          data-testid="resume-workout-bar"
          className="fixed inset-x-3 bottom-[76px] z-40 flex items-center justify-between rounded-lg border border-volt/50 bg-[#0F172A]/95 px-4 py-3 shadow-2xl backdrop-blur-md transition-transform duration-150 hover:-translate-y-0.5 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-80"
        >
          <span className="flex items-center gap-3">
            <span className="size-2.5 animate-pulse-ring rounded-full bg-volt" />
            <span>
              <span className="block text-xs uppercase tracking-wider text-muted-foreground">In progress</span>
              <span className="block font-heading font-bold">{active.data?.name}</span>
            </span>
          </span>
          <span className="text-sm font-semibold text-volt">Resume →</span>
        </Link>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        {BOTTOM.map(({ label, to, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            data-testid={testid}
            className={({ isActive }) =>
              cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors",
                isActive && "text-volt",
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
