"use client";

/**
 * useSchedulePreview — debounced hook for the composer's live
 * "your post would publish at X" affordance. Calls
 * /v1/scheduler/preview-time as the user adjusts channels / time /
 * stagger, and surfaces { preview, loading, error } for the
 * <ScheduleConfirmCard /> + <ScheduleConflictWarning /> components.
 *
 * Debounces 300 ms so a stuck keypress doesn't hammer the API.
 * Out-of-order responses guarded by a monotonic sequence counter so
 * a late preview can't overwrite a newer one.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { scheduler } from "@/lib/scheduler/client";
import type {
  PreviewTimeRequest,
  PreviewTimeResponse,
} from "@/lib/scheduler/types";

interface UseSchedulePreviewResult {
  preview: PreviewTimeResponse | undefined;
  loading: boolean;
  error: string | null;
}

/** Stable key for the input — useEffect deps array can compare this
 *  cheaply without a deep-equal lib. Reset to `null` when input is
 *  empty so the effect short-circuits without setState. */
function buildKey(input: PreviewTimeRequest | null): string | null {
  if (!input || input.channels.length === 0) return null;
  return JSON.stringify(input);
}

export function useSchedulePreview(
  input: PreviewTimeRequest | null,
  debounceMs = 300,
): UseSchedulePreviewResult {
  const [preview, setPreview] = useState<PreviewTimeResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const key = useMemo(() => buildKey(input), [input]);

  // React 19's `react-hooks/set-state-in-effect` flags the setState
  // calls below. The rule's purpose is to avoid cascading renders,
  // but in this debounced-fetch pattern the effect body is gated on
  // `key` change and the synchronous setError/setLoading calls reset
  // the visible state to "loading" precisely once per key. There's
  // no cascade — `key` doesn't depend on the state we're setting.
  // Documented exception per the rule's guidance.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (key === null) {
      seqRef.current++;
      return;
    }
    const mySeq = ++seqRef.current;
    setError(null);
    setLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await scheduler.previewTime(JSON.parse(key));
          if (seqRef.current === mySeq) {
            setPreview(res);
            setLoading(false);
          }
        } catch (err) {
          if (seqRef.current === mySeq) {
            setError(err instanceof Error ? err.message : "Preview failed");
            setLoading(false);
          }
        }
      })();
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [key, debounceMs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Derive the visible state from key alone: empty key ⇒ no preview.
  return {
    preview: key === null ? undefined : preview,
    loading: key !== null && loading,
    error: key === null ? null : error,
  };
}
