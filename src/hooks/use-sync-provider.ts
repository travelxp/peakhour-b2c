"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

export interface SyncEnqueueResponse {
  provider: string;
  jobId: string;
  status: "pending" | "running" | "done" | "failed" | "cancelled";
}

export interface UseSyncProviderOptions {
  /**
   * Called after a successful enqueue. Use it to invalidate or refetch
   * caller-specific queries that depend on the synced data so they're
   * fresh when the user returns from /dashboard/tasks. The hook does NOT
   * wait for the job to finish — invalidations here run on enqueue, not
   * completion.
   */
  onEnqueue?: (response: SyncEnqueueResponse) => void;
  /**
   * If true (default), redirect the user to /dashboard/tasks?jobId=…
   * after the enqueue succeeds so they can monitor progress. Set to
   * false to keep them on the current page (e.g. an admin surface that
   * just wants to fire-and-forget).
   */
  redirectToTasks?: boolean;
}

interface UseSyncProviderReturn {
  /** Enqueue a sync job. No-op if a previous enqueue is still in flight. */
  sync: () => Promise<SyncEnqueueResponse | null>;
  /** True between request start and request settle (the enqueue, not the job). */
  syncing: boolean;
}

/**
 * Wraps `POST /v1/integrations/:provider/sync`.
 *
 * The api now enqueues an `integration_sync` job and returns
 * `{ jobId }` instead of running synchronously — single source of
 * truth so every sync (manual + cron) is observable in
 * /dashboard/tasks and /cms/jobs. By default the hook redirects the
 * user to the Tasks page with the new jobId in the URL so they see
 * their submission highlighted.
 *
 * Idempotency: the api stamps a per-connection `idempotencyKey`. A
 * double-click while the previous sync is still queued|running
 * returns the same jobId — no double-spend.
 */
export function useSyncProvider(
  provider: string,
  options: UseSyncProviderOptions = {},
): UseSyncProviderReturn {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  // Ref-based in-flight guard: closes a double-tap race that React's
  // state batching can let through, AND lets us drop `syncing` from the
  // useCallback deps so the `sync` identity stays stable across the
  // intermediate state flips.
  const inFlightRef = useRef(false);
  // Latest options captured via ref so the hook's `sync` identity
  // doesn't change when callers pass inline closures.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sync = useCallback(async (): Promise<SyncEnqueueResponse | null> => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    setSyncing(true);
    try {
      const res = await api.post<SyncEnqueueResponse>(
        `/v1/integrations/${provider}/sync`,
        {},
      );

      const { onEnqueue, redirectToTasks = true } = optionsRef.current;
      onEnqueue?.(res);

      toast.success(`${humanProvider(provider)} sync queued`, {
        description: "Track progress on the Tasks page.",
      });

      if (redirectToTasks) {
        router.push(`/dashboard/tasks?jobId=${res.jobId}`);
      }
      return res;
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_CONNECTED") {
        toast.error(`${humanProvider(provider)} is not connected`, {
          description: "Reconnect from the Integrations page.",
        });
      } else if (err instanceof ApiError && err.code === "SYNC_NOT_SUPPORTED") {
        toast.error(`${humanProvider(provider)} doesn't support sync.`);
      } else {
        const msg = err instanceof Error ? err.message : "Sync failed";
        toast.error("Couldn't queue sync", { description: msg });
      }
      return null;
    } finally {
      inFlightRef.current = false;
      setSyncing(false);
    }
  }, [provider, router]);

  return { sync, syncing };
}

/** Title-case a provider key for user-facing messages. */
function humanProvider(provider: string): string {
  if (!provider) return "Provider";
  return provider
    .split("_")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
