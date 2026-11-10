/**
 * What a list or detail screen should draw for a react-query result.
 *
 * `isLoading` is `isFetching && isPending`, so it is false for a query that is
 * pending but paused (offline): a screen that keys on it renders its empty
 * branch ("No tickets yet") for a merchant who is simply offline. Key on
 * `isPending` and read `fetchStatus` to tell loading from offline.
 *
 * "error" is reported only when there is no data to show. A background refetch
 * that fails while data is on screen keeps the data (`isError` stays true, but
 * stale data beats an error panel). On a manual retry with no data, react-query
 * resets `error` to null and `status` to "pending", so this goes back to
 * "loading" until the retry settles.
 */
export type QueryViewState = "loading" | "offline" | "error" | "ready";

export interface QueryLike {
  isPending: boolean;
  isError: boolean;
  data: unknown;
  fetchStatus: "fetching" | "paused" | "idle";
}

export function queryViewState(q: QueryLike): QueryViewState {
  if (q.isError && q.data === undefined) return "error";
  if (q.isPending) return q.fetchStatus === "paused" ? "offline" : "loading";
  return "ready";
}
