import { describe, it, expect } from "vitest";
import { reachLine, audienceClaim } from "./audience-card-rules";

/**
 * The two sentences the audience card is allowed to say about a campaign.
 * Both have a way of being confidently wrong, and both were unrenderable
 * before A3 — so what is pinned here is what the card must NEVER claim.
 */

describe("reachLine — the number a customer divides their budget by", () => {
  it("★never renders LinkedIn's masked 0 as a number", () => {
    // `total: 0` means "fewer than 300", not zero. "0 people" would be a false
    // statement about the customer's market — and the honest sentence predicts
    // non-delivery, which is worth more than the number would have been.
    const line = reachLine({ supported: true, belowFloor: true });
    expect(line).toContain("300");
    expect(line).not.toMatch(/\b0\b/);
  });

  it("says the size is unavailable rather than inventing one", () => {
    expect(reachLine({ supported: false })).toContain("didn't give us");
    // supported, but no number came back — same honest absence.
    expect(reachLine({ supported: true })).toContain("didn't give us");
  });

  it("renders a real number when the platform gave one", () => {
    expect(reachLine({ supported: true, value: 2_400_000 })).toContain("2,400,000");
  });

  it("says nothing at all when reach was never fetched", () => {
    expect(reachLine(undefined)).toBeNull();
  });

  it("★a literal 0 is the floor, never 'About 0 people'", () => {
    // The api maps LinkedIn's masked total:0 to belowFloor with no number, so
    // a zero arriving here means something upstream changed — and the sentence
    // it would have produced is the one this function exists to forbid.
    // Guarded here rather than trusted from two repos away.
    const line = reachLine({ supported: true, value: 0 });
    expect(line).toContain("300");
    expect(line).not.toContain("About 0");
  });
});

describe("audienceClaim — who chose this", () => {
  it("★claims nobody when the provenance no longer matches the audience", () => {
    // "We cannot tell" rendering as "we chose this" is the same class of lie
    // as a row claiming an audience the platform does not have.
    expect(
      audienceClaim({ source: "auto_proposed", confirmed: false, verified: false, autoSelectedUnconfirmed: false }),
    ).toBe("unverified");
  });

  it("labels an unlooked-at proposal as ours", () => {
    expect(
      audienceClaim({ source: "auto_proposed", confirmed: false, verified: true, autoSelectedUnconfirmed: true }),
    ).toBe("auto_unconfirmed");
  });

  it("★never calls a person's own choice auto-selected", () => {
    expect(
      audienceClaim({ source: "user_set", confirmed: true, verified: true, autoSelectedUnconfirmed: false }),
    ).toBe("user_set");
    expect(
      audienceClaim({ source: "auto_proposed", confirmed: true, verified: true, autoSelectedUnconfirmed: false }),
    ).toBe("approved");
  });

  it("claims nothing when the api sent no reading", () => {
    expect(audienceClaim(undefined)).toBe("unverified");
  });

  it("★never puts 'You approved this' on something nobody approved", () => {
    // `platform_set` — an audience targeted in Campaign Manager, which the
    // schema allows — is confirmed by nobody. A fallback that ignored
    // `confirmed` would give it a green check reading "You approved this".
    expect(
      audienceClaim({
        source: "platform_set",
        confirmed: false,
        verified: true,
        autoSelectedUnconfirmed: false,
      }),
    ).toBe("unverified");
  });
});
