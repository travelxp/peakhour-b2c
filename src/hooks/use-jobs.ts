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

// ── CMS (cross-org, ops scope) ───────────────────────────────

/** Technical-row shape returned by `/v1/cms/jobs` (`projectJobForOps`). */
export interface CmsJobRow extends Job {
  priority: number;
  orgId?: string;
  businessId?: string;
  enqueuedByUserId?: string;
  parentJobId?: string;
  childJobIds: string[];
  idempotencyKey?: string;
  params?: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  phaseHistory: Array<{
    phase: string;
    startedAt: string;
    finishedAt?: string;
    durationMs?: number;
    ok?: boolean;
    error?: string;
  }>;
  result?: Record<string, unknown>;
  claimedAt?: string;
  claimedUntil?: string;
  workerId?: string;
  currentPhase?: string;
  updatedAt?: string;
}

export interface CmsJobsListResponse {
  period: { days: number; since: string };
  total: number;
  offset: number;
  limit: number;
  rows: CmsJobRow[];
}

export interface CmsJobsFilters {
  days?: string;
  limit?: number;
  offset?: number;
  kind?: string;
  status?: string;
  orgId?: string;
  businessId?: string;
  showChildren?: boolean;
}

export const cmsJobsKeys = {
  list: (filters: CmsJobsFilters) => ["cms-jobs", "list", filters] as const,
  detail: (id: string) => ["cms-jobs", "detail", id] as const,
};

/** GET /v1/cms/jobs — cross-org list for ops. */
export function useCmsJobs(filters: CmsJobsFilters) {
  return useQuery({
    queryKey: cmsJobsKeys.list(filters),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (filters.days) params.days = filters.days;
      if (filters.limit) params.limit = String(filters.limit);
      if (filters.offset) params.offset = String(filters.offset);
      if (filters.kind) params.kind = filters.kind;
      if (filters.status) params.status = filters.status;
      if (filters.orgId) params.orgId = filters.orgId;
      if (filters.businessId) params.businessId = filters.businessId;
      if (filters.showChildren) params.showChildren = "true";
      return api.get<CmsJobsListResponse>("/v1/cms/jobs", params);
    },
    // Modest auto-refresh — ops watch this for stuck/recently-failed work.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });
}

/**
 * GET /v1/cms/jobs/:id — full technical drilldown (includes children).
 * Polls at 5s while the job is non-terminal so an ops user watching a
 * stuck running job sees claimedUntil/childrenDone tick live; stops as
 * soon as the job (or its fetch) terminates.
 */
export function useCmsJobDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? cmsJobsKeys.detail(id) : ["cms-jobs", "detail", "__noop__"],
    queryFn: () => api.get<CmsJobRow & { children: CmsJobRow[] }>(`/v1/cms/jobs/${id}`),
    enabled: !!id,
    refetchInterval: (q) => {
      if (q.state.error) return false;
      const data = q.state.data as CmsJobRow | undefined;
      if (!data) return q.state.dataUpdatedAt === 0 ? 5_000 : false;
      return data.status === "pending" || data.status === "running" ? 5_000 : false;
    },
    refetchIntervalInBackground: false,
  });
}
