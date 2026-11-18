"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Types: the fixed contract of GET /v1/cms/schedules (peakhour-api) ──
// Friendly names, areas and cadences are served by the api; b2c keeps no copy.

/**
 * `never_ran` is legacy: an older api sends it where the current one sends
 * `waiting`. The page treats it, and any status it does not know, as `waiting`.
 */
export type ScheduleStatus =
  | "healthy"
  | "failing"
  | "missed"
  | "did_not_finish"
  | "running"
  | "waiting"
  | "never_ran";

export interface ScheduleArea {
  area: string;
  label: string;
}

export interface ScheduleRow {
  name: string;
  label: string;
  description: string;
  area: string;
  cron: string;
  cadence: string;
  slotGated: boolean;
  /** null on production. */
  devEnabled: boolean | null;
  nextRunAt: string | null;
  /** The latest fire time that has passed its grace period; absent on an older api. */
  dueAt?: string | null;
  status: ScheduleStatus;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastHttpStatus: number | null;
  lastDurationMs: number | null;
  lastFailedSteps: string[];
  consecutiveFailures: number;
  runs24h: number;
  failures24h: number;
}

export interface SchedulesResponse {
  environment: "production" | "dev";
  areas: ScheduleArea[];
  /** When the run log began; absent on an older api. */
  recordingSince?: string | null;
  schedules: ScheduleRow[];
}

export interface ScheduleRun {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  httpStatus: number;
  outcome: "succeeded" | "failed";
  failedSteps: string[];
  executionId: string | null;
  trigger: "vercel" | "other";
}

export interface ScheduleRunsResponse {
  schedule: { name: string; label: string };
  runs: ScheduleRun[];
}

export const RUNS_LIMIT = 50;

export const schedulesKeys = {
  list: () => ["cms-schedules", "list"] as const,
  runs: (name: string, limit: number) => ["cms-schedules", "runs", name, limit] as const,
};

/** GET /v1/cms/schedules — every schedule with its latest status. */
export function useCmsSchedules() {
  return useQuery({
    queryKey: schedulesKeys.list(),
    queryFn: () => api.get<SchedulesResponse>("/v1/cms/schedules"),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });
}

/** GET /v1/cms/schedules/:name/runs — newest first. */
export function useCmsScheduleRuns(name: string | null | undefined, limit = RUNS_LIMIT) {
  return useQuery({
    queryKey: name ? schedulesKeys.runs(name, limit) : ["cms-schedules", "runs", "__noop__"],
    queryFn: () =>
      api.get<ScheduleRunsResponse>(`/v1/cms/schedules/${encodeURIComponent(name!)}/runs`, {
        limit: String(limit),
      }),
    enabled: !!name,
    refetchInterval: (q) => (q.state.error ? false : 30_000),
    refetchIntervalInBackground: false,
  });
}
