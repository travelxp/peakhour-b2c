import type { Query, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { getMe, type MeResponse } from "./auth";

/**
 * The session query. Its data is the /me payload, or `null` once the api has
 * answered "you are not signed in" -- a signed-out visitor is an ANSWER, not an
 * error. A query that errors means we could not find out (see classifyMeFailure).
 */
export const ME_KEY = ["me"] as const;

/** How long a /me answer is trusted before a remount or focus may refetch it. */
export const ME_STALE_MS = 5 * 60 * 1000;

export type MeFailure = "signed-out" | "unreachable";

/**
 * Only a real 401/403 from the api means "not signed in". The api client has
 * already tried /auth/refresh before a 401 reaches here. Everything else -- a
 * 5xx, a gateway timeout, a non-JSON error page, a CORS blip, going offline (a
 * bare TypeError from fetch), a missing base URL (status 0) -- says nothing
 * about the session, so it must not look like a logout.
 */
export function classifyMeFailure(err: unknown): MeFailure {
  if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
    return "signed-out";
  }
  return "unreachable";
}

/** In-query retries, before the query settles into its error state. */
export const ME_QUICK_RETRIES = 2;

/** 1s, 2s (capped at 4s): short, so the first screen is not "Loading..." for long. */
export function meRetryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 4000);
}

export function meShouldRetry(failureCount: number, err: unknown): boolean {
  return classifyMeFailure(err) === "unreachable" && failureCount < ME_QUICK_RETRIES;
}

/**
 * Delay before the Nth automatic reconnect attempt once the query is in its
 * error state: 5s, 10s, 20s, 40s, then 60s for as long as the api stays away.
 * `errorCount` is the number of consecutive failed settlements (1 = first).
 */
export function reconnectDelay(errorCount: number): number {
  const n = Math.max(1, errorCount);
  return Math.min(5000 * 2 ** (n - 1), 60_000);
}

/** react-query `refetchInterval` for the me query: only ticks while it is erroring. */
export function meRefetchInterval(query: Query<MeResponse | null>): number | false {
  return query.state.status === "error" ? reconnectDelay(query.state.errorUpdateCount) : false;
}

// ── Early start ────────────────────────────────────────────────────────────
// The QueryClient does not exist until React has rendered, so a /me request
// started at module evaluation cannot go through it. It is parked here and the
// query function consumes it once (a retry must really re-fetch).

const EARLY_MAX_AGE_MS = 10_000;
let early: { at: number; promise: Promise<MeResponse> } | null = null;

/** Start /me now. Browser only; idempotent; never throws or leaves an unhandled rejection. */
export function primeMe(): void {
  if (typeof window === "undefined" || early) return;
  const promise = getMe();
  promise.catch(() => {}); // the consumer reports the failure; this branch only silences it
  early = { at: Date.now(), promise };
}

function takeEarlyMe(): Promise<MeResponse> | null {
  const taken = early;
  early = null;
  if (!taken || Date.now() - taken.at > EARLY_MAX_AGE_MS) return null;
  return taken.promise;
}

/** Test seam. */
export function resetEarlyMe(): void {
  early = null;
}

/**
 * The me query function: the payload, `null` for a real signed-out answer,
 * and a throw for "could not find out".
 */
export async function fetchMe(): Promise<MeResponse | null> {
  try {
    return await (takeEarlyMe() ?? getMe());
  } catch (err) {
    if (classifyMeFailure(err) === "signed-out") return null;
    throw err;
  }
}

// ── Scope changes ──────────────────────────────────────────────────────────
// Switching org/business or logging out must drop every scoped cache, but NOT
// the me query: its observer is mounted in the provider and a removed query is
// not re-created until something re-renders it.

const notMe = (q: Query): boolean => q.queryKey[0] !== ME_KEY[0];

export function cancelScopedQueries(qc: QueryClient): Promise<void> {
  return qc.cancelQueries({ predicate: notMe });
}

export function removeScopedQueries(qc: QueryClient): void {
  qc.removeQueries({ predicate: notMe });
}
