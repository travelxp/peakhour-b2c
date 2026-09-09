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
import { listFetchState, showsSkeleton, type ListQueryLike } from "./list-fetch-state";

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
    for (const state of ["paused", "waiting", "error", "empty", "ready"] as const) {
      expect(showsSkeleton(state)).toBe(false);
    }
  });
});
