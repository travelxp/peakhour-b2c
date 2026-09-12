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
  /** It failed and we have nothing to show. NEVER the empty state — retry. */
  | "error"
  /**
   * It failed, but rows from a previous fetch are still on screen.
   *
   * ★★★A FAILED REFRESH IS NOT A REASON TO HIDE DATA WE HAVE. query-core keeps
   * `data` and sets `status: "error"` on a failed BACKGROUND refetch, and the
   * conversations lane polls every thirty seconds — so collapsing this into
   * `error` painted "couldn't load your conversations, this is not an empty
   * inbox" directly above the conversations it had just listed.
   */
  | "stale"
  /** It completed and returned nothing. The only state that has earned the
   *  empty copy. */
  | "empty"
  /** It completed and returned rows. */
  | "ready";

export function listFetchState(query: ListQueryLike, count: number): ListFetchState {
  // ★A FAILED FIRST LOAD IS NEVER THE EMPTY STATE — indistinguishable from
  // good news, which is the single worst reading.
  // ★FAILURE FIRST, BUT NOT AT THE COST OF ROWS WE ALREADY HAVE. An errored
  // query with data behind it is a failed REFRESH; the rows are still the last
  // true answer and hiding them is a bigger lie than showing them.
  if (query.isError) return count > 0 ? "stale" : "error";
  if (query.isPending) {
    if (query.fetchStatus === "paused") return "paused";
    // ⚠️IDLE MEANS NOBODY ASKED. `enabled: false` leaves a query pending for
    // ever; treating that as loading spins a skeleton with nothing behind it.
    if (query.fetchStatus === "idle") return "waiting";
    return "loading";
  }
  return count === 0 ? "empty" : "ready";
}

/**
 * Whether placeholders belong on screen.
 *
 * ⚠️★★★CALL THIS RATHER THAN RE-DERIVING IT. A first version of the Inbox
 * exported this, unit-tested it, mutation-tested it — and then hand-rolled
 * `state === "loading" || state === "waiting"` at every call site, which is the
 * infinite skeleton this module exists to prevent, re-introduced beneath a
 * comment describing it. A helper nothing calls is a comment.
 */
export function showsSkeleton(state: ListFetchState): boolean {
  return state === "loading";
}

/** Whether the rows we hold should be rendered. ★`stale` COUNTS: a failed
 *  refresh leaves the last true answer on screen. */
export function showsRows(state: ListFetchState): boolean {
  return state === "ready" || state === "stale";
}
