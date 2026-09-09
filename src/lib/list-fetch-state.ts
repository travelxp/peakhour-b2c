/**
 * What a list query is actually doing — the four states a `isLoading` check
 * collapses into two.
 *
 * ★★★AN EMPTY STATE IS A CLAIM. "No leads yet", "No conversations yet", "No
 * reviews have reached us" are all statements about the merchant's business, and
 * only a query that COMPLETED AND RETURNED NOTHING has earned one. Three lanes
 * of the Inbox reached that copy through a query that had not completed at all,
 * because `isLoading` in react-query v5 is `isPending && isFetching` — so:
 *
 *   - a PAUSED query (offline) is pending and not fetching: not loading, not
 *     errored, and straight through to "you have none";
 *   - a DISABLED query (`enabled: false`, e.g. no business picked yet) is
 *     pending with `fetchStatus: "idle"`: not loading either, and gating a
 *     skeleton on `isPending` alone spins it for ever instead.
 *
 * ⚠️THOSE TWO PULL IN OPPOSITE DIRECTIONS, which is why naming them once beats
 * fixing them one lane at a time: the repair for the first (`isPending`) is what
 * breaks the second.
 *
 * @package peakhour-b2c
 */

/** Just enough of a react-query result to decide. */
export interface ListQueryLike {
  isPending: boolean;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
}

export type ListFetchState =
  /** In flight. Show placeholders. */
  | "loading"
  /** Offline: pending, and the fetch is parked. Say so — it never resolves. */
  | "paused"
  /** Disabled: nothing has been asked yet, so there is nothing to report. */
  | "waiting"
  /** It failed. NEVER the empty state — offer a retry. */
  | "error"
  /** It completed and returned nothing. The only state that has earned the
   *  empty copy. */
  | "empty"
  /** It completed and returned rows. */
  | "ready";

export function listFetchState(query: ListQueryLike, count: number): ListFetchState {
  // ★FAILURE FIRST. An errored query has no rows either, and falling through to
  // a count would report a failed request as an empty inbox — the single worst
  // reading, because it is indistinguishable from good news.
  if (query.isError) return "error";
  if (query.isPending) {
    if (query.fetchStatus === "paused") return "paused";
    // ⚠️IDLE MEANS NOBODY ASKED. `enabled: false` leaves a query pending for
    // ever; treating that as loading spins a skeleton with nothing behind it.
    if (query.fetchStatus === "idle") return "waiting";
    return "loading";
  }
  return count === 0 ? "empty" : "ready";
}

/** Whether placeholders belong on screen. */
export function showsSkeleton(state: ListFetchState): boolean {
  return state === "loading";
}
