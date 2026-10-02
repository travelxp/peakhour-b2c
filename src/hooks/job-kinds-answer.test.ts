import { describe, it, expect } from "vitest";
import { kindsRefetchInterval, mergeKindsAnswer, normalizeKindsAnswer } from "./job-kinds-answer";

describe("normalizeKindsAnswer", () => {
  it("★an absent flag (an api before api#1442) is complete; false stays false", () => {
    expect(normalizeKindsAnswer({ kinds: ["a"] })).toEqual({ kinds: ["a"], complete: true });
    expect(normalizeKindsAnswer({ kinds: ["a"], complete: false })).toEqual({ kinds: ["a"], complete: false });
  });
});

describe("mergeKindsAnswer", () => {
  const held = { kinds: ["ad_boost_launch", "onboarding_discovery"], complete: true };
  it("★★an incomplete answer never drops a kind already held (cms#175)", () => {
    // "a_new_kind" sorts first, so an unsorted union would show.
    expect(mergeKindsAnswer(held, { kinds: ["ad_boost_launch", "a_new_kind"], complete: false })).toEqual({
      kinds: ["a_new_kind", "ad_boost_launch", "onboarding_discovery"],
      complete: false,
    });
  });
  it("★a complete answer replaces the list outright: a kind can leave it", () => {
    const next = { kinds: ["ad_boost_launch"], complete: true };
    expect(mergeKindsAnswer(held, next)).toBe(next);
  });
  it("★with nothing held, an incomplete answer is kept as is", () => {
    const next = { kinds: ["ad_boost_launch"], complete: false };
    expect(mergeKindsAnswer(undefined, next)).toBe(next);
  });
});

describe("kindsRefetchInterval", () => {
  it("★★polls every minute while the answer is incomplete, every five once complete", () => {
    expect(kindsRefetchInterval({ kinds: [], complete: false }, false)).toBe(60_000);
    expect(kindsRefetchInterval({ kinds: [], complete: true }, false)).toBe(300_000);
    expect(kindsRefetchInterval(undefined, false)).toBe(false);
  });
  it("★★and while the query failed with nothing held (round 2)", () => {
    expect(kindsRefetchInterval(undefined, true)).toBe(60_000);
    // A failed refetch over a complete answer keeps the complete cadence.
    expect(kindsRefetchInterval({ kinds: [], complete: true }, true)).toBe(300_000);
  });
});
