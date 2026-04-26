"use client";

import { useCallback, useRef, useState } from "react";
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
   * Override the default success message. Receives the sync result —
   * implementations MUST inspect `result.errors` because the same
   * formatter renders both success (`errors === 0`) and partial-failure
   * (`errors > 0`) toasts; a formatter that ignores `errors` will
   * mislead users on partial failures.
   */
  formatSuccess?: (result: SyncResult) => { title: string; description?: string };
}

interface UseSyncProviderReturn {
  /**
   * Trigger a manual sync. No-op if already in flight (returns null).
   *
   * Behavior on failure depends on the `notify` option:
   * - `notify: true` (default): errors are toasted, promise resolves to null
   * - `notify: false`: promise REJECTS with the underlying error so the
   *   caller can render their own UI. Always wrap in try/catch when
   *   using this option.
   */
  sync: () => Promise<SyncResult | null>;
  /** True between request start and request settle. */
  syncing: boolean;
  /** Last successful result. Persists across re-syncs until the next success. */
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
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  // Ref-based in-flight guard: closes a double-tap race that React's
  // state batching can let through, AND lets us drop `syncing` from the
  // useCallback deps so the `sync` identity stays stable across the
  // intermediate state flips.
  const inFlightRef = useRef(false);
  // Latest callbacks captured via ref so the hook's `sync` identity
  // doesn't change every time the caller passes inline closures.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    setSyncing(true);
    // Don't clear `lastResult` here — keep the previous successful result
    // visible to consumers (e.g. an inline banner) while the new sync is
    // in flight. Overwrite only when we have a fresh successful result.
    let result: SyncResult | null = null;
    try {
      const res = await api.post<SyncResponse>(
        `/v1/integrations/${provider}/sync`,
        {},
      );
      result = res.sync;
      setLastResult(result);

      const { notify = true, formatSuccess } = optionsRef.current;
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
    } catch (err) {
      const { notify = true } = optionsRef.current;
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
      } else {
        // notify:false callers want to render their own UI. Re-throw so
        // the caller's await sees the failure (silently returning null
        // would be indistinguishable from a successful no-op sync).
        throw err;
      }
    } finally {
      inFlightRef.current = false;
      setSyncing(false);
    }

    // onSuccess runs OUTSIDE the try so a callback throw doesn't get
    // caught by the error branch and falsely report failure to the
    // awaiter. The sync itself succeeded; downstream side-effects
    // failing is the caller's problem to handle.
    if (result !== null) {
      optionsRef.current.onSuccess?.(result);
    }
    return result;
  }, [provider]);

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
  if (!provider) return "Provider";
  return provider
    .split("_")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
