import { describe, expect, it } from "vitest";
import {
  announcementBar,
  hasTrial,
  pillarTrialCopy,
  startPanel,
  trialCtaLabel,
  trialFaq,
  trialNote,
} from "./trial-copy";
import { signupCta } from "./catalog";
import { heroTrustPoints } from "./pillar-console";

/**
 * Owner rule (2026-10-06, official review R2 on b2c#591): offers come from
 * campaigns and the Suite trial's length from the plan's `trialDays`, so no
 * marketing sentence promises a trial (or "no credit card", which is the
 * trial's) unless `suiteTrialDays` served one.
 */

const TRIAL_WORDS = /free|trial|credit card|no card|on us|% off|founding/i;

describe("hasTrial: the one rule", () => {
  it("a positive length is a trial; null, 0, a negative or nothing is none", () => {
    expect(hasTrial(14)).toBe(true);
    expect(hasTrial(1)).toBe(true);
    for (const d of [null, undefined, 0, -3]) expect(hasTrial(d)).toBe(false);
  });
});

describe("signup buttons (official review R2)", () => {
  it("★an open door starts the trial only when the catalog gives one", () => {
    expect(trialCtaLabel(14)).toBe("Start free trial");
    expect(trialCtaLabel(null)).toBe("Get started");
    expect(trialCtaLabel(0)).toBe("Get started");
    expect(signupCta("open", 14)).toEqual({ label: "Start free trial", href: "/auth" });
    expect(signupCta("open", null)).toEqual({ label: "Get started", href: "/auth" });
  });

  it("a gated door is the same with or without a trial", () => {
    for (const d of [14, null]) {
      expect(signupCta("waitlist_only", d).label).toBe("Join the waitlist");
      expect(signupCta("invite_only", d).label).toBe("Request an invite");
      expect(signupCta("closed", d).disabled).toBe(true);
    }
  });
});

describe("trial notes and the announcement bar (official review R2)", () => {
  it("★state the catalog's length, and are absent without a trial", () => {
    expect(trialNote(7)).toBe("7-day free trial · No credit card");
    expect(trialNote(null)).toBeNull();
    expect(trialNote(0)).toBeNull();
    expect(announcementBar(7)?.lead).toBe("Try every module free for 7 days — no credit card required.");
    expect(announcementBar(null)).toBeNull();
    expect(announcementBar(0)).toBeNull();
  });
});

describe("the landing hero and start panel (official review R2)", () => {
  it("★the trust points carry the trial's two only with a trial", () => {
    expect(heroTrustPoints(14)).toEqual(["No credit card", "Free trial of every module", "All five modules, one platform"]);
    expect(heroTrustPoints(null)).toEqual(["All five modules, one platform", "One Peaks wallet"]);
    expect(JSON.stringify(heroTrustPoints(0))).not.toMatch(TRIAL_WORDS);
  });

  it("★the start panel names the catalog's length, and no trial without one", () => {
    const withTrial = startPanel(10);
    expect(withTrial.lede).toContain("10-day free trial");
    expect(withTrial.points[0]!.detail).toContain("10-day Peakhour Suite trial");
    expect(withTrial.eyebrow).toContain("free");
    for (const d of [null, 0]) expect(JSON.stringify(startPanel(d))).not.toMatch(TRIAL_WORDS);
    expect(startPanel(null).points).toHaveLength(3);
  });
});

describe("module pages and the pricing FAQ (official review R2)", () => {
  it("★a module page promises the trial only with one, at the catalog's length", () => {
    expect(pillarTrialCopy("In Peakhour Suite", "Commerce", 14)).toEqual({
      note: "In Peakhour Suite · 14-day free trial, no credit card",
      closingLead: "Try Commerce",
      closingAccent: "free.",
      closing: "In Peakhour Suite — start with a 14-day free trial, no credit card.",
    });
    for (const d of [null, 0]) {
      const c = pillarTrialCopy("In Peakhour Suite", "Commerce", d);
      expect(c.note).toBe("In Peakhour Suite");
      expect(JSON.stringify(c)).not.toMatch(TRIAL_WORDS);
    }
  });

  it("★the FAQ explains the trial with one, and how to start without", () => {
    expect(trialFaq(14).q).toBe("How does the free trial work?");
    expect(trialFaq(14).a).toContain("14-day Peakhour Suite trial");
    for (const d of [null, 0]) expect(JSON.stringify(trialFaq(d))).not.toMatch(TRIAL_WORDS);
  });
});
