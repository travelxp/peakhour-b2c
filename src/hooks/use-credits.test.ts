import { describe, it, expect } from "vitest";
import {
  getCapStatus,
  spendableCap,
  capRecoveryCta,
  type MeteredBalance,
} from "./use-credits";

/**
 * The cap decision is the ONE place this client is allowed to say "AI features
 * are paused". What is pinned here is the real incident: org `quests.travel` on
 * Peakhour Suite (hardCap 5,000) with a 2,000-Peak pack bought the day before
 * and 5,100 Peaks used — shown "Monthly Peaks limit reached. AI features are
 * paused until Sep 12. Upgrade to resume immediately." while the same response
 * carried `remaining: 1900` and the api's fair-use gate refused nothing.
 *
 * Two independent mistakes produced it, and both are guarded below:
 *   • the comparison had no top-up term (and the TYPE had no top-up fields);
 *   • it was made against `used`, which leads the gate by the un-charged tail,
 *     rather than against the gate's own verdict.
 */

/** Suite: 5,000 included, warning band 500, paid → top-up spendable. */
function suite(over: Partial<MeteredBalance> = {}): MeteredBalance {
  return {
    unlimited: false,
    plan: "suite",
    metric: "ai.credits.consumed",
    hardCap: 5000,
    softCap: 4500,
    used: 0,
    chargedUsed: 0,
    blocked: false,
    remaining: 5000,
    windowStartAt: "2026-08-04T07:59:38.252Z",
    resetAt: "2026-09-12T06:19:00.179Z",
    boostAddonKey: "addon.peaks.value",
    topUpBalance: 0,
    topUpDrawn: 0,
    topUpUsable: true,
    ...over,
  };
}

describe("spendableCap — the denominator for what this client DISPLAYS", () => {
  it("adds purchased Peaks when the plan can spend them", () => {
    expect(spendableCap(suite({ topUpBalance: 2000 }))).toBe(7000);
  });

  it("★holds still while a pack is spent — it does not walk down", () => {
    // The api debits the pack as over-cap spend is charged, so `topUpBalance`
    // has already fallen by `topUpDrawn`. Counting only the balance made the
    // denominator sag with the customer's own spending: "0 of 6,000" with 1,000
    // purchased Peaks still to go, and the soft band narrowing to match.
    expect(spendableCap(suite({ topUpBalance: 2000, topUpDrawn: 0 }))).toBe(7000);
    expect(spendableCap(suite({ topUpBalance: 1000, topUpDrawn: 1000 }))).toBe(7000);
    expect(spendableCap(suite({ topUpBalance: 0, topUpDrawn: 2000 }))).toBe(7000);
  });

  it("★ignores a held balance the plan may NOT spend", () => {
    // A free tier can hold top-up Peaks and not draw on them — the api gates on
    // `topUpUsable`, not on the balance being non-zero, so counting them here
    // would promise headroom the gate then refuses.
    expect(spendableCap(suite({ topUpBalance: 2000, topUpUsable: false }))).toBe(5000);
    // …nor draws such a wallet could not have made.
    expect(spendableCap(suite({ topUpDrawn: 2000, topUpUsable: false }))).toBe(5000);
  });
});

describe("getCapStatus", () => {
  it("★never announces a pause the api is not enforcing (the reported bug)", () => {
    // The exact response quests.travel was served: 5,100 used against a 5,000
    // plan cap, 2,000 purchased Peaks, and the gate — which reads the charging
    // ledger, empty here because no rollup had ever run — refusing nothing.
    expect(
      getCapStatus(
        suite({ used: 5100, chargedUsed: 0, blocked: false, topUpBalance: 2000, remaining: 1900 }),
      ),
    ).not.toBe("hard");
  });

  it("★takes 'hard' from the server, NOT from used >= hardCap", () => {
    // Same numbers, opposite verdicts. If this client ever re-derives the pause
    // from the figures beside it, one of these two flips and the customer is
    // either stopped for nothing or told nothing when they are stopped.
    expect(getCapStatus(suite({ used: 9999, blocked: false }))).not.toBe("hard");
    expect(getCapStatus(suite({ used: 0, chargedUsed: 5000, blocked: true }))).toBe("hard");
  });

  it("warns inside the plan's own band, measured against the REAL wall", () => {
    // Band is hardCap − softCap = 500, so with 2,000 bought the nudge starts at
    // 6,500 — NOT at the bare softCap of 4,500, which would warn that "AI will
    // pause" with 2,500 spendable Peaks untouched.
    expect(getCapStatus(suite({ used: 6500, topUpBalance: 2000 }))).toBe("soft");
    expect(getCapStatus(suite({ used: 6499, topUpBalance: 2000 }))).toBe("none");
    expect(getCapStatus(suite({ used: 4500, topUpBalance: 2000 }))).toBe("none");
  });

  it("is unchanged for an org with no top-up", () => {
    expect(getCapStatus(suite({ used: 5000, chargedUsed: 5000, blocked: true }))).toBe("hard");
    expect(getCapStatus(suite({ used: 4500 }))).toBe("soft");
    expect(getCapStatus(suite({ used: 4499 }))).toBe("none");
  });

  it("never caps an unlimited plan, and tolerates a pending fetch", () => {
    expect(getCapStatus({ unlimited: true, plan: "internal_platform" })).toBe("none");
    expect(getCapStatus(undefined)).toBe("none");
  });
});

describe("capRecoveryCta — the action that actually resumes AI", () => {
  it("★sends a paid plan to buy Peaks, not to upgrade", () => {
    // Suite is the top self-serve tier; "Upgrade to resume immediately" is a
    // dead end there and the plan's own escalation is `boost_or_wait`.
    const cta = capRecoveryCta(suite({ blocked: true, topUpBalance: 2000 }));
    expect(cta.href).toBe("/dashboard/peaks");
    expect(cta.label).toBe("Buy Peaks");
  });

  it("sends a free tier to billing, where an upgrade does exist", () => {
    const cta = capRecoveryCta(suite({ plan: "free", topUpUsable: false }));
    expect(cta.href).toBe("/dashboard/settings/billing");
    expect(cta.label).toBe("Upgrade plan");
  });

  it("★sends a CONTRACT-PRICED tier to buy Peaks too", () => {
    // Enterprise lists at $0 "Contact sales". The api used to read that as a
    // free plan, so an Enterprise org at its 100,000 cap was refused both the
    // top-up spend and the purchase and landed on "Upgrade plan" — with nothing
    // above them to upgrade to. `topUpUsable` now comes from `isPaidPlanRow`.
    const cta = capRecoveryCta(suite({ plan: "enterprise", blocked: true, topUpUsable: true }));
    expect(cta.label).toBe("Buy Peaks");
  });
});
