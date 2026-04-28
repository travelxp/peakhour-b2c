"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────

export interface Job {
  _id: string;
  kind: string;
  status: "pending" | "running" | "done" | "failed" | "cancelled";
  displayName?: string;
  displayHint?: string;
  progress?: {
    totalUnits: number;
    processedUnits: number;
    currentLabel?: string;
    etaMs?: number;
  };
  childrenTotal?: number;
  childrenDone?: number;
  cancelRequested: boolean;
  createdAt: string;
  finishedAt?: string;
}

export interface JobChild {
  _id: string;
  status: Job["status"];
  displayName?: string;
  progress?: Job["progress"];
}

export interface JobDetail extends Job {
  children: JobChild[];
}

export type JobListStatus = "active" | "recent" | "all";

// ── Query keys ───────────────────────────────────────────────

export const jobsKeys = {
  all: ["jobs"] as const,
  list: (status: JobListStatus) => ["jobs", "list", status] as const,
  detail: (id: string) => ["jobs", "detail", id] as const,
};

// ── Hooks ────────────────────────────────────────────────────

/**
 * Polls the user's job list.
 *
 * `active` (pending+running): 10s when there's anything to watch, 60s
 * when the list is empty — the latter is the "is anything queued?" poll
 * driving the nav badge on every dashboard route, and we don't want
 * that hammering the api at 6 RPM forever for an idle user.
 *
 * `recent` (last 24h finished): 60s; rows aren't moving but new completions
 * still surface here without a refresh.
 */
export function useJobs(status: JobListStatus = "active") {
  const isActive = status === "active";
  return useQuery({
    queryKey: jobsKeys.list(status),
    queryFn: () => api.get<{ rows: Job[] }>("/v1/jobs", { status }),
    refetchInterval: (q) => {
      if (!isActive) return 60_000;
      const data = q.state.data as { rows: Job[] } | undefined;
      return data?.rows?.length ? 10_000 : 60_000;
    },
    // Don't burn polls when the user has tabbed away.
    refetchIntervalInBackground: false,
    staleTime: isActive ? 5_000 : 30_000,
  });
}

/**
 * Drilldown for a single job — includes children in summarised form.
 * Polling stops once the job reaches a terminal state OR if the request
 * errors (e.g. 404 after the row was TTL'd) so we don't spin forever.
 */
export function useJobDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? jobsKeys.detail(id) : ["jobs", "detail", "__noop__"],
    queryFn: () => api.get<JobDetail>(`/v1/jobs/${id}`),
    enabled: !!id,
    refetchInterval: (q) => {
      // If the request errored (404, 403, etc.) stop polling.
      if (q.state.error) return false;
      const data = q.state.data as JobDetail | undefined;
      // Pre-first-fetch: poll once at 5s.
      if (!data) return q.state.dataUpdatedAt === 0 ? 5_000 : false;
      // Active jobs poll; terminal jobs don't.
      return data.status === "pending" || data.status === "running" ? 5_000 : false;
    },
  });
}

interface EnqueueParams {
  kind: "content_analyse";
  params?: Record<string, unknown>;
  displayName?: string;
  displayHint?: string;
  idempotencyKey?: string;
}

interface EnqueueResponse {
  jobId: string;
  kind: string;
  status: Job["status"];
  priority: number;
  displayName?: string;
  displayHint?: string;
}

/** POST /v1/jobs — enqueue a job. */
export function useEnqueueJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: EnqueueParams) => api.post<EnqueueResponse>("/v1/jobs", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}

/**
 * POST /v1/jobs/:id/cancel — cooperative cancel.
 *
 * The runner picks up `cancelRequested` at the next chunk boundary
 * (running children) or at claim time (pending children). Backend
 * confirmation arrives on the next poll up to 10s later, so we
 * optimistically flip `cancelRequested:true` on the cached row to
 * remove the Cancel button immediately.
 *
 * On error we restore the snapshot — relying on `invalidateQueries`
 * alone leaves the optimistic-flipped row visible until the next poll
 * lands.
 */
export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation<
    { jobId: string; status: string },
    Error,
    string,
    { prevList?: { rows: Job[] }; prevDetail?: JobDetail }
  >({
    mutationFn: (id: string) =>
      api.post<{ jobId: string; status: string }>(`/v1/jobs/${id}/cancel`),
    onMutate: async (id: string) => {
      // Cancel any in-flight refetch so it can't overwrite our optimistic write.
      await queryClient.cancelQueries({ queryKey: jobsKeys.all });
      const prevList = queryClient.getQueryData<{ rows: Job[] }>(jobsKeys.list("active"));
      const prevDetail = queryClient.getQueryData<JobDetail>(jobsKeys.detail(id));
      const flip = (rows?: Job[]) =>
        rows?.map((j) => (j._id === id ? { ...j, cancelRequested: true } : j));
      if (prevList) {
        queryClient.setQueryData<{ rows: Job[] }>(
          jobsKeys.list("active"),
          { ...prevList, rows: flip(prevList.rows) || prevList.rows },
        );
      }
      if (prevDetail) {
        queryClient.setQueryData<JobDetail>(jobsKeys.detail(id), {
          ...prevDetail,
          cancelRequested: true,
        });
      }
      return { prevList, prevDetail };
    },
    onError: (_err, id, ctx) => {
      if (ctx?.prevList) {
        queryClient.setQueryData(jobsKeys.list("active"), ctx.prevList);
      }
      if (ctx?.prevDetail) {
        queryClient.setQueryData(jobsKeys.detail(id), ctx.prevDetail);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}

// ── Derived helpers ──────────────────────────────────────────

/** Count of currently-running jobs — used by the nav badge. */
export function useRunningJobCount(): number {
  const { data } = useJobs("active");
  if (!data?.rows) return 0;
  return data.rows.filter((j) => j.status === "running" || j.status === "pending").length;
}
