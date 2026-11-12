import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ApiError, apiGet, apiPost } from "./api";
import type {
  AnalyticsSummary,
  CalendarResponse,
  ConsistencyStats,
  Exercise,
  SplitHistoryRecord,
  Template,
  TodayInfo,
  User,
  Workout,
  WorkoutStart,
  WorkoutSummary,
} from "./types";

// ─── Core data hooks ──────────────────────────────────────────────────────────

export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<User>("/auth/me"),
    retry: false,
    staleTime: 5 * 60_000,  // profile rarely changes
  });

export const useExercises = () =>
  useQuery({
    queryKey: ["exercises"],
    queryFn: () => apiGet<Exercise[]>("/exercises"),
    staleTime: 10 * 60_000, // exercise library rarely changes
  });

export const useTemplates = () =>
  useQuery({
    queryKey: ["templates"],
    queryFn: () => apiGet<Template[]>("/templates"),
    staleTime: 5 * 60_000,  // templates change infrequently
  });

export const useActiveWorkout = () =>
  useQuery({
    queryKey: ["workout", "active"],
    queryFn: () => apiGet<Workout | null>("/workouts/active"),
    staleTime: 30_000,  // 30s — prevents refetch on every route change in AppShell
  });

// ─── Dashboard / Today ────────────────────────────────────────────────────────

export const useTodayInfo = () =>
  useQuery({
    queryKey: ["today"],
    queryFn: () => apiGet<TodayInfo>("/today"),
    staleTime: 60_000,  // 1 min — daily schedule doesn't change mid-session
  });

export const useAnalyticsSummary = () =>
  useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => apiGet<AnalyticsSummary>("/analytics/summary"),
    staleTime: 5 * 60_000,  // analytics are stable; heavy query server-side
  });

export const useHistoryList = (limit = 500) =>
  useQuery({
    queryKey: ["workouts", "list", limit],
    queryFn: () => apiGet<WorkoutSummary[]>(`/workouts?limit=${limit}`),
    staleTime: 2 * 60_000,
  });

// ─── History / Consistency ────────────────────────────────────────────────────

export const useConsistencyStats = () =>
  useQuery({
    queryKey: ["history", "stats"],
    queryFn: () => apiGet<ConsistencyStats>("/history/stats"),
    staleTime: 3 * 60_000,
  });

export const useCalendar = (year: number, month: number) =>
  useQuery({
    queryKey: ["history", "calendar", year, month],
    queryFn: () => apiGet<CalendarResponse>(`/history/calendar?year=${year}&month=${month}`),
    staleTime: 3 * 60_000,
  });

export const useSplitHistory = () =>
  useQuery({
    queryKey: ["history", "splits"],
    queryFn: () => apiGet<SplitHistoryRecord[]>("/history/splits"),
    staleTime: 5 * 60_000,
  });

// ─── Onboarding ───────────────────────────────────────────────────────────────

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<User>("/auth/onboarding/complete"),
    onSuccess: (updated) => { qc.setQueryData(["me"], updated); },
  });
}

export function useResetOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<User>("/auth/onboarding/reset"),
    onSuccess: (updated) => { qc.setQueryData(["me"], updated); },
    onError: () => toast.error("Couldn't reset onboarding. Try again."),
  });
}

// ─── Workout actions ──────────────────────────────────────────────────────────

export function useStartWorkout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (body: WorkoutStart) => apiPost<Workout>("/workouts", body),
    onSuccess: (w) => {
      qc.setQueryData(["workout", "active"], w);
      // Invalidate today so "completed_today" re-evaluates
      qc.invalidateQueries({ queryKey: ["today"] });
      // Navigate to the active logger immediately after the workout is created
      navigate("/workout/active");
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.info("You already have a workout in progress — resuming it.");
        qc.invalidateQueries({ queryKey: ["workout", "active"] });
        navigate("/workout/active");
      } else {
        toast.error("Couldn't start workout. Check your connection.");
      }
    },
  });
}

export const useRecentWorkouts = (limit = 5) =>
  useQuery({
    queryKey: ["workouts", "recent", limit],
    queryFn: () => apiGet<WorkoutSummary[]>(`/workouts?limit=${limit}`),
    staleTime: 2 * 60_000,
  });
