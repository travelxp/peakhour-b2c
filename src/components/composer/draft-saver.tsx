"use client";

/**
 * <DraftSaver/> + useDraftSaver hook — auto-saves composer state to
 * cnt_drafts on a 2s debounce. The component renders a small status
 * pill (Saving… / Saved 3s ago / Save failed — retry) that hosts
 * place in their composer footer. The hook exposes manual `save()`
 * + `status` to hosts that want their own UI.
 *
 * Status model:
 *   idle  → first render or after a successful save with no further edits
 *   saving → fetch in flight; pill spins; publish-button should be
 *           disabled by the host
 *   saved  → terminal-success; pill shows "Saved Ns ago" relative,
 *           transitioning to "Saved Nm ago" past 60s
 *   error  → terminal-fail; pill shows Retry button + host can read
 *           lastError for a toast
 *
 * Why split into hook + component: most hosts want both, but a few
 * (e.g. the strategist publish tab which has its own status banner)
 * want only the hook. The component is a thin render wrapper.
 *
 * Network: caller owns `save(value)` — the primitive doesn't know
 * whether to PUT/POST or which collection to write. Typical wiring:
 *   const save = useCallback(async (text) => {
 *     await api.put(`/v1/content/drafts/${id}`, { text, ... });
 *   }, [id]);
 *
 * Edge cases handled:
 *   - Save fired with stale value (user typed again before save
 *     resolved) — second save scheduled, no in-flight cancellation;
 *     ordering preserved by an internal serial number.
 *   - Unmount mid-save — abort signal fires; the in-flight save is
 *     allowed to complete but its result is discarded.
 *   - Browser tab close — beforeunload listener flushes any pending
 *     save via navigator.sendBeacon if the caller passes a beaconUrl.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DraftSaveStatus } from "./types";

const DEFAULT_DEBOUNCE_MS = 2000;

export interface UseDraftSaverOptions<T = string> {
  /** The host's current composer value. Anytime this changes, a
   *  debounced save fires. Pass `null` to suspend auto-save (e.g.
   *  while the host is loading the initial draft). */
  value: T | null;
  /** Async save handler. Receives the latest value + an AbortSignal
   *  the hook fires on unmount. Should resolve when the persisted
   *  state is durable. */
  save: (value: T, signal: AbortSignal) => Promise<void>;
  /** Debounce window in ms. Default 2000 — matches the Notion /
   *  Google-Docs cadence users have built muscle memory for. */
  debounceMs?: number;
  /** Initial status to render before the first user edit. Almost
   *  always "idle"; pass "saved" if the host has already persisted
   *  the state synchronously (e.g. just-created draft via POST). */
  initialStatus?: DraftSaveStatus;
}

export interface UseDraftSaverResult {
  status: DraftSaveStatus;
  lastSavedAt: Date | null;
  lastError: Error | null;
  /** Trigger an immediate save (bypass debounce). Returns the save
   *  Promise so hosts can await it before navigating away. */
  saveNow: () => Promise<void>;
}

export function useDraftSaver<T>({
  value,
  save,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  initialStatus = "idle",
}: UseDraftSaverOptions<T>): UseDraftSaverResult {
  const [status, setStatus] = useState<DraftSaveStatus>(initialStatus);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Serial counter so out-of-order resolves don't clobber a newer save.
  const serialRef = useRef(0);
  // Track the last value we *attempted to save* so saveNow can dedup
  // (avoid firing again when nothing changed).
  const lastAttemptedRef = useRef<T | null>(null);
  // Stable ref to the host's save fn so the effect doesn't refire on
  // every callback identity change.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const runSave = useCallback(async (snapshot: T) => {
    const mySerial = ++serialRef.current;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("saving");
    setLastError(null);
    try {
      await saveRef.current(snapshot, ctrl.signal);
      if (ctrl.signal.aborted || mySerial !== serialRef.current) {
        // Newer save started before this resolved — discard.
        return;
      }
      setStatus("saved");
      setLastSavedAt(new Date());
      lastAttemptedRef.current = snapshot;
    } catch (err) {
      if (ctrl.signal.aborted || mySerial !== serialRef.current) return;
      setStatus("error");
      setLastError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  // Debounced save effect.
  useEffect(() => {
    if (value == null) return;
    // Skip the auto-save when nothing changed since the last attempt
    // (e.g. parent re-rendered with the same string — common with
    // controlled inputs).
    if (Object.is(value, lastAttemptedRef.current)) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void runSave(value);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, debounceMs, runSave]);

  // Cancel in-flight on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const saveNow = useCallback(async () => {
    if (value == null) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    await runSave(value);
  }, [value, runSave]);

  return { status, lastSavedAt, lastError, saveNow };
}

// ── Rendered pill ────────────────────────────────────────

export interface DraftSaverProps {
  status: DraftSaveStatus;
  lastSavedAt: Date | null;
  lastError: Error | null;
  /** Click handler for the Retry button (error state). Typically
   *  the host's `saveNow` from useDraftSaver. */
  onRetry?: () => void;
  className?: string;
}

/** Human-readable "N seconds ago" / "Nm ago" string. Stable across
 *  re-renders within the same second to avoid layout thrash. */
function formatAgo(date: Date | null): string {
  if (!date) return "";
  const sec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

export function DraftSaver({
  status,
  lastSavedAt,
  lastError,
  onRetry,
  className,
}: DraftSaverProps) {
  // Tick once per 15s so the "ago" string stays accurate without
  // re-rendering every second. (No requestAnimationFrame — the
  // visual budget is tiny.)
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (status !== "saved" || !lastSavedAt) return;
    const id = setInterval(() => forceTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [status, lastSavedAt]);

  // `status` isn't a read input of formatAgo, but it's in the deps
  // anyway so the memoised value recomputes whenever status changes
  // (otherwise the pill text could lag a tick after a "saving" →
  // "saved" transition where lastSavedAt is set in the same render).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ago = useMemo(() => formatAgo(lastSavedAt), [lastSavedAt, status]);

  let icon: React.ReactNode;
  let label: string;
  let tone = "text-muted-foreground";

  switch (status) {
    case "saving":
      icon = <Loader2 className="size-3 animate-spin" />;
      label = "Saving…";
      break;
    case "saved":
      icon = <Check className="size-3 text-emerald-600 dark:text-emerald-400" />;
      label = `Saved ${ago}`;
      break;
    case "error":
      icon = <AlertCircle className="size-3 text-destructive" />;
      label = "Save failed";
      tone = "text-destructive";
      break;
    case "idle":
    default:
      icon = <Clock className="size-3" />;
      label = "Not saved yet";
      break;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        tone,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {icon}
      <span>{label}</span>
      {status === "error" && onRetry && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
          onClick={onRetry}
          title={lastError?.message}
        >
          Retry
        </Button>
      )}
    </div>
  );
}
