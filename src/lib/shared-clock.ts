/**
 * One clock that several components read, so they can never disagree about
 * what time it is (b2c review R2 on WA T4).
 *
 * ★WHY NOT `useNow` IN EACH. Two components that each start their own interval
 * tick at different moments: near a deadline one has passed it and the other
 * has not, so the 24h badge said "under a minute left" above a composer that
 * had already switched to templates. Everything reading this clock re-renders
 * from the same snapshot, in the same commit.
 *
 * The interval runs only while something is subscribed, re-reads the time at
 * once when the tab is shown again (browsers throttle hidden tabs), and
 * `refresh()` lets a caller with a known deadline move it exactly on time.
 *
 * @package peakhour-b2c
 */

export interface SharedClock {
  /** The snapshot: stable between ticks (as `useSyncExternalStore` needs). */
  now(): number;
  subscribe(listener: () => void): () => void;
  /** Re-read the time now and tell every subscriber. */
  refresh(): void;
}

export function createSharedClock(intervalMs: number): SharedClock {
  let current = Date.now();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  const refresh = () => {
    current = Date.now();
    for (const l of listeners) l();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") refresh();
  };

  return {
    now: () => current,
    refresh,
    subscribe(listener) {
      listeners.add(listener);
      if (timer === null) {
        timer = setInterval(refresh, intervalMs);
        if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
        // ★A clock nobody read for an hour is an hour old: catch up at once.
        refresh();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== null) {
          clearInterval(timer);
          timer = null;
          if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
        }
      };
    },
  };
}

/** The largest delay `setTimeout` honours; beyond it, it fires at once. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * How long until a deadline, for a `setTimeout` that refreshes the clock exactly
 * then; null when there is nothing to wait for (no deadline, already past, or
 * too far away for a timer, where the interval will get there first).
 */
export function deadlineDelay(endsAt: string | null | undefined, now: number): number | null {
  const end = endsAt ? Date.parse(endsAt) : NaN;
  if (!Number.isFinite(end)) return null;
  const ms = end - now;
  if (ms <= 0 || ms > MAX_TIMEOUT_MS) return null;
  return ms;
}
