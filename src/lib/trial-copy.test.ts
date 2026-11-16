import { describe, expect, it } from "vitest";
import {
  announcementBar,
  hasTrial,
  pillarTrialCopy,
  startPanel,
  trialCtaLabel,
  trialFaq,
  trialNote,
  trialStart,
  pricingHeroTrial,
  EVERY_BUSINESS_TRIAL_PROMISE,
} from "./trial-copy";
import { signupCta } from "./catalog";

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

describe("the start panel (official review R2)", () => {
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

  // ★ONE TRIAL PER PERSON (billing plan P3.1d; D19): the trial is a new
  //  account's FIRST business's, once per person. No sentence may promise
  //  it to "every business" or "every new business".
  it("★P3.1d: the FAQ says the trial is the first business's, once per person, and an added business pays first", () => {
    const a = trialFaq(14).a;
    expect(a).toContain("Your first business starts on a 14-day Peakhour Suite trial");
    expect(a).toContain("one trial per person");
    expect(a).toContain("a business you add, or one in another account you open, pays from the start");
    expect(a).not.toMatch(EVERY_BUSINESS_TRIAL_PROMISE);
  });

  it("★P3.1d: the pricing hero says the first business, once per person; nothing without a trial", () => {
    expect(pricingHeroTrial(14)).toBe("Your first business starts with a free 14-day trial of all of it, one trial per person.");
    expect(pricingHeroTrial(14)).not.toMatch(EVERY_BUSINESS_TRIAL_PROMISE);
    for (const d of [null, 0]) expect(pricingHeroTrial(d)).toBeNull();
  });
});

describe("DL-3: the trial wording follows the signup door, per mode (owner 2026-11-16)", () => {
  // Read from the database on 2026-11-16: Suite grants 14 days in every country, and signupMode is waitlist_only, so the
  // trial begins when a person is approved. The wording comes from signupMode + trialDays, never a typed claim.
  const DAYS = 14;

  it("waitlist_only (today): the trial starts on approval, beside Join the waitlist", () => {
    expect(trialStart("waitlist_only", DAYS)).toBe("on_approval");
    expect(signupCta("waitlist_only", DAYS).label).toBe("Join the waitlist");
    const lines = [
      announcementBar(DAYS, "waitlist_only")?.lead,
      pricingHeroTrial(DAYS, "waitlist_only"),
      trialNote(DAYS, "waitlist_only"),
      trialFaq(DAYS, "waitlist_only").a,
      startPanel(DAYS, "waitlist_only").lede,
    ].join("\n");
    expect(lines).toContain("When you’re approved, your first business starts with a 14-day free trial");
    expect(lines).not.toMatch(/Start (your|a) (14-day )?free trial|Try every module free|Try it free/i);
    expect(EVERY_BUSINESS_TRIAL_PROMISE.test(lines)).toBe(false);
  });

  it("invite_only is gated the same way", () => {
    expect(trialStart("invite_only", DAYS)).toBe("on_approval");
    expect(trialNote(DAYS, "invite_only")).toMatch(/once approved/);
  });

  it("open: the trial starts now, in today's words", () => {
    expect(trialStart("open", DAYS)).toBe("now");
    expect(announcementBar(DAYS, "open")?.lead).toBe("Try every module free for 14 days — no credit card required.");
    expect(trialNote(DAYS, "open")).toBe("14-day free trial · No credit card");
    expect(pricingHeroTrial(DAYS, "open")).toMatch(/^Your first business starts with a free 14-day trial/);
    expect(trialFaq(DAYS, "open").a).toMatch(/^Your first business starts on a 14-day/);
  });

  it("no trial in the catalog, or a closed door: no trial line at all, in any mode", () => {
    for (const mode of ["open", "waitlist_only", "invite_only", "closed"] as const) {
      expect(trialStart(mode, null), mode).toBe("none");
      expect(announcementBar(null, mode), mode).toBeNull();
      expect(trialNote(null, mode), mode).toBeNull();
      expect(pricingHeroTrial(null, mode), mode).toBeNull();
      expect(startPanel(null, mode).lede, mode).not.toMatch(TRIAL_WORDS);
    }
    expect(trialStart("closed", DAYS)).toBe("none");
    expect(announcementBar(DAYS, "closed")).toBeNull();
  });
});
