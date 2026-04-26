"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

export interface SyncResult {
  added: number;
  updated: number;
  errors: number;
  postsFetched?: number;
}

interface SyncResponse {
  provider: string;
  sync: SyncResult;
}

export interface UseSyncProviderOptions {
  /**
   * Called after a successful sync. Use it to invalidate or refetch
   * caller-specific queries (the hook doesn't know what's relevant to
   * each surface).
   */
  onSuccess?: (result: SyncResult) => void;
  /**
   * Set to false to suppress toast notifications and let the caller
   * render results in its own UI (e.g. the integrations page uses an
   * inline banner instead of a toast).
   */
  notify?: boolean;
  /**
   * Override the default success message. Receives the sync result.
   */
  formatSuccess?: (result: SyncResult) => { title: string; description?: string };
}

interface UseSyncProviderReturn {
  /** Trigger a manual sync. No-op if already in flight. */
  sync: () => Promise<SyncResult | null>;
  /** True between request start and request settle. */
  syncing: boolean;
  /** Last completed result (cleared on next sync start). */
  lastResult: SyncResult | null;
}

/**
 * Wraps `POST /v1/integrations/:provider/sync` with loading state, toast
 * UX, and error-code handling (ALREADY_RUNNING / NOT_CONNECTED).
 *
 * Used anywhere the user can trigger a manual sync — currently the
 * /dashboard/content/beehiiv library, planned for the channels hub and
 * strategist surfaces. Callers pass `onSuccess` to refetch their own
 * queries; the hook doesn't assume what's relevant.
 */
export function useSyncProvider(
  provider: string,
  options: UseSyncProviderOptions = {},
): UseSyncProviderReturn {
  const { onSuccess, notify = true, formatSuccess } = options;
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (syncing) return null;
    setSyncing(true);
    setLastResult(null);
    try {
      const res = await api.post<SyncResponse>(
        `/v1/integrations/${provider}/sync`,
        {},
      );
      const result = res.sync;
      setLastResult(result);

      if (notify) {
        const formatted = formatSuccess
          ? formatSuccess(result)
          : defaultSuccessMessage(result);
        if (result.errors > 0) {
          toast.warning(formatted.title, { description: formatted.description });
        } else {
          toast.success(formatted.title, { description: formatted.description });
        }
      }

      onSuccess?.(result);
      return result;
    } catch (err) {
      if (notify) {
        if (err instanceof ApiError && err.code === "ALREADY_RUNNING") {
          toast.error("A sync is already in progress", {
            description: "Wait for it to complete before triggering another.",
          });
        } else if (err instanceof ApiError && err.code === "NOT_CONNECTED") {
          toast.error(`${humanProvider(provider)} is not connected`, {
            description: "Reconnect from the Integrations page.",
          });
        } else {
          const msg = err instanceof Error ? err.message : "Sync failed";
          toast.error("Sync failed", { description: msg });
        }
      } else if (!(err instanceof ApiError)) {
        // When notifications are suppressed, callers want to handle errors
        // themselves — but unexpected non-ApiError throws should still
        // surface so they don't get swallowed silently.
        throw err;
      }
      return null;
    } finally {
      setSyncing(false);
    }
  }, [provider, syncing, onSuccess, notify, formatSuccess]);

  return { sync, syncing, lastResult };
}

function defaultSuccessMessage(result: SyncResult): {
  title: string;
  description?: string;
} {
  const { added, updated, errors, postsFetched } = result;
  if (errors > 0) {
    return {
      title: `Synced with ${errors} error${errors === 1 ? "" : "s"}`,
      description: `${added} added, ${updated} updated. Check the integration page for details.`,
    };
  }
  if (added === 0 && updated === 0) {
    return {
      title: "Already up to date",
      description:
        postsFetched && postsFetched > 0
          ? `Provider returned ${postsFetched} item${postsFetched === 1 ? "" : "s"}, all already imported.`
          : "No new items since the last sync.",
    };
  }
  const total = added + updated;
  return {
    title: `${total} item${total === 1 ? "" : "s"} synced`,
    description: `${added} new, ${updated} updated.`,
  };
}

/** Title-case a provider key for user-facing messages. */
function humanProvider(provider: string): string {
  return provider
    .split("_")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
