/**
 * The four states an `isLoading` check collapses into two.
 *
 * ★★★AN EMPTY STATE IS A CLAIM about the merchant's business, and only a query
 * that completed and returned nothing has earned one. Three Inbox lanes reached
 * that copy through a query that had not completed at all.
 *
 * Killer titles are load-bearing — `scripts/mutate-list-fetch-state.mjs` matches
 * them for EQUALITY against vitest's JSON reporter.
 */
import { describe, it, expect } from "vitest";
import { listFetchState, showsSkeleton, showsRows, type ListQueryLike } from "./list-fetch-state";

const q = (over: Partial<ListQueryLike> = {}): ListQueryLike => ({
  isPending: false,
  isError: false,
  fetchStatus: "idle",
  ...over,
});

describe("listFetchState — what the query is actually doing", () => {
  it("★★★never reports a paused query as an empty list", () => {
    // ⚠️THE OFFLINE CASE. `isLoading` is `isPending && isFetching`, so a parked
    // fetch is neither loading nor errored — and every lane fell through to
    // "you have none", which is a statement about the merchant's business.
    expect(listFetchState(q({ isPending: true, fetchStatus: "paused" }), 0)).toBe("paused");
  });

  it("★★★never reports a DISABLED query as loading", () => {
    // ⚠️AND THIS IS THE ONE THE OBVIOUS FIX BREAKS. `enabled: false` — no
    // business picked yet — leaves a query pending with an idle fetch for ever,
    // so gating a skeleton on `isPending` alone spins it with nothing behind it.
    expect(listFetchState(q({ isPending: true, fetchStatus: "idle" }), 0)).toBe("waiting");
  });

  it("★★★never reports a failed query as an empty list", () => {
    // The worst reading of all: indistinguishable from good news.
    expect(listFetchState(q({ isError: true }), 0)).toBe("error");
  });

  it("★★★prefers the failure even when the query also looks pending", () => {
    expect(listFetchState(q({ isError: true, isPending: true, fetchStatus: "paused" }), 0)).toBe(
      "error",
    );
  });

  it("★★says loading only while something is actually in flight", () => {
    expect(listFetchState(q({ isPending: true, fetchStatus: "fetching" }), 0)).toBe("loading");
  });

  it("★★★calls it empty only once a query has completed with nothing", () => {
    expect(listFetchState(q(), 0)).toBe("empty");
  });

  it("★★says ready when rows came back", () => {
    expect(listFetchState(q(), 3)).toBe("ready");
  });

  it("★a refetch over rows we already have is not a loading state", () => {
    // A background refresh must not blank a list the merchant is reading.
    expect(listFetchState(q({ fetchStatus: "fetching" }), 3)).toBe("ready");
  });
});

describe("showsSkeleton — placeholders belong to one state only", () => {
  it("★★★shows placeholders while loading and in no other state", () => {
    expect(showsSkeleton("loading")).toBe(true);
    for (const state of ["paused", "waiting", "error", "stale", "empty", "ready"] as const) {
      expect(showsSkeleton(state)).toBe(false);
    }
  });
});

/**
 * ★★★`stale` — A FAILED REFRESH IS NOT A REASON TO HIDE DATA WE HAVE.
 *
 * query-core keeps `data` and sets `status: "error"` on a failed BACKGROUND
 * refetch, and the conversations lane polls every thirty seconds — so
 * collapsing that into `error` painted "couldn't load your conversations, this
 * is not an empty inbox" directly above the conversations it had just listed.
 */
describe("★★★listFetchState — a failed REFRESH is not a failed load", () => {
  it("★★★an error WITH rows behind it is `stale`, not `error`", () => {
    expect(listFetchState(q({ isError: true }), 3)).toBe("stale");
  });

  it("★★★and an error with NOTHING behind it is still `error`", () => {
    // The original rule, and the one that must not regress: a failed FIRST load
    // has no rows either, and reporting it as empty is indistinguishable from
    // good news — the single worst reading this module exists to prevent.
    expect(listFetchState(q({ isError: true }), 0)).toBe("error");
  });

  it("⚠️★★failure still outranks everything, including a pending refetch", () => {
    // ★A background refetch leaves `isPending` false and `fetchStatus`
    //  "fetching"; an errored one can arrive in odd combinations. Whatever else
    //  the query says, an error with rows is `stale` and an error without them
    //  is `error` — the count is the only thing that decides between them.
    expect(listFetchState(q({ isError: true, fetchStatus: "fetching" }), 2)).toBe("stale");
    expect(listFetchState(q({ isError: true, fetchStatus: "paused" }), 0)).toBe("error");
    expect(listFetchState(q({ isError: true, isPending: true }), 5)).toBe("stale");
  });
});

describe("★★showsRows — what the list may render", () => {
  it("★★★`stale` COUNTS — that is the whole point of the state", () => {
    // If this is false, a failed refresh blanks a list we could still show, and
    // `stale` has bought nothing over `error`.
    expect(showsRows("stale")).toBe(true);
    expect(showsRows("ready")).toBe(true);
  });

  it("★and no state that has not earned them", () => {
    // ⚠️`empty` is excluded deliberately: it means the fetch COMPLETED and
    //  returned nothing, so there are no rows to render — and `error` must not
    //  render a stale list it has already told the user it could not load.
    for (const state of ["loading", "paused", "waiting", "error", "empty"] as const) {
      expect(showsRows(state), state).toBe(false);
    }
  });

  it("⚠️★★★`showsSkeleton` and `showsRows` never both answer true", () => {
    // A lane that showed placeholders AND rows at once would be the flicker both
    // helpers exist to remove.
    for (const state of ["loading", "paused", "waiting", "error", "stale", "empty", "ready"] as const) {
      expect(showsSkeleton(state) && showsRows(state), state).toBe(false);
    }
  });
});
