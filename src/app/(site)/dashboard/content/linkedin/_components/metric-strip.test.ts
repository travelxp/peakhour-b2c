/**
 * The two decisions the metric strip makes that are worth pinning.
 *
 * Both are about NOT doing something: not turning a zero into a door
 * nobody wants opened (and which costs a LinkedIn request against a
 * ~500/day app-wide budget to discover is empty), and not rendering a
 * rate for a post that has no denominator.
 */

import { describe, it, expect } from "vitest";
import { engagementRate, opensDialog, formatCount } from "./metric-strip";

describe("which counts are clickable", () => {
  it("★a zero count never opens a dialog", () => {
    // An empty dialog is a wasted click, and on reactions and comments it
    // is a wasted LinkedIn request from a budget shared by every customer.
    expect(opensDialog(0, true)).toBe(false);
  });

  it("a real count opens one", () => {
    expect(opensDialog(1, true)).toBe(true);
  });

  it("★nothing opens without a real post URN", () => {
    // A post with no `urn:li:` id cannot be read from LinkedIn at all, so
    // the count still renders — it just is not a control whose only
    // possible outcome is an error.
    expect(opensDialog(24, false)).toBe(false);
  });
});

describe("the engagement rate", () => {
  it("★is null, not zero, when nobody saw the post", () => {
    // "0.0%" reads as failure. A post with no impressions has no rate —
    // that is absence, and the strip omits it rather than asserting it.
    expect(
      engagementRate({ impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0 }),
    ).toBeNull();
  });

  it("counts every interaction over reach", () => {
    // 400 impressions, 20 interactions → 5%.
    expect(
      engagementRate({ impressions: 400, clicks: 5, likes: 10, comments: 3, shares: 2 }),
    ).toBeCloseTo(5);
  });

  it("★a small post can out-rate a big one", () => {
    // The reason the rate leads: the old two-line strip showed raw
    // impressions first and made the second of these look like the winner.
    const small = engagementRate({ impressions: 400, clicks: 0, likes: 0, comments: 20, shares: 0 });
    const big = engagementRate({ impressions: 12_000, clicks: 0, likes: 0, comments: 3, shares: 0 });
    expect(small!).toBeGreaterThan(big!);
  });
});

describe("count formatting", () => {
  it("abbreviates thousands and millions", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1_200)).toBe("1.2k");
    expect(formatCount(2_500_000)).toBe("2.5M");
  });
});
