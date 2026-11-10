import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ApiError, apiGet, apiPost } from "./api";
import type { CalendarResponse, ConsistencyStats, Exercise, SplitHistoryRecord, Template, User, Workout, WorkoutStart } from "./types";

export const useMe = () =>
  useQuery({ queryKey: ["me"], queryFn: () => apiGet<User>("/auth/me"), retry: false, staleTime: 5 * 60_000 });

export const useExercises = () =>
  useQuery({ queryKey: ["exercises"], queryFn: () => apiGet<Exercise[]>("/exercises"), staleTime: 10 * 60_000 });

export const useTemplates = () =>
  useQuery({ queryKey: ["templates"], queryFn: () => apiGet<Template[]>("/templates") });

export const useActiveWorkout = () =>
  useQuery({ queryKey: ["workout", "active"], queryFn: () => apiGet<Workout | null>("/workouts/active") });

export const useConsistencyStats = () =>
  useQuery({
    queryKey: ["history", "stats"],
    queryFn: () => apiGet<ConsistencyStats>("/history/stats"),
    staleTime: 2 * 60_000,
  });

export const useCalendar = (year: number, month: number) =>
  useQuery({
    queryKey: ["history", "calendar", year, month],
    queryFn: () => apiGet<CalendarResponse>(`/history/calendar?year=${year}&month=${month}`),
    staleTime: 2 * 60_000,
  });

export const useSplitHistory = () =>
  useQuery({
    queryKey: ["history", "splits"],
    queryFn: () => apiGet<SplitHistoryRecord[]>("/history/splits"),
    staleTime: 5 * 60_000,
  });

/** Mark the onboarding tour as completed. Updates the "me" cache immediately. */
export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<User>("/auth/onboarding/complete"),
    onSuccess: (updated) => {
      qc.setQueryData(["me"], updated);
    },
  });
}

/** Reset onboarding so the tour can be replayed. Updates the "me" cache immediately. */
export function useResetOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<User>("/auth/onboarding/reset"),
    onSuccess: (updated) => {
      qc.setQueryData(["me"], updated);
    },
    onError: () => toast.error("Couldn't reset onboarding. Try again."),
  });
}

/** Start a workout (empty or from a template) and jump into the logger. */
export function useStartWorkout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (body: WorkoutStart) => apiPost<Workout>("/workouts", body),
    onSuccess: (w) => {
      qc.setQueryData(["workout", "active"], w);
      qc.invalidateQueries({ queryKey: ["today"] });
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
