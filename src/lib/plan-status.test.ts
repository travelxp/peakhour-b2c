import { describe, expect, it } from "vitest";

import {
  heldLines,
  isBilledLine,
  isNoPlanKey,
  lineKey,
  planButtonLabel,
  planDisplayName,
  planHeadline,
  planState,
  productRowAction,
  trialWarningDays,
  upgradeCta,
  type PlanSummaryish,
} from "./plan-status";

/**
 * One catalog (billing plan D19, P4.7): a business is on the Suite trial, holds
 * a paid plan, or holds none (padlocked). There is no free tier; a stored
 * `free` / `.free` value (until P4.5) reads as no plan.
 */

const ENDS = "2026-11-01T00:00:00.000Z";
const suite = { tier: "suite", productKey: "suite", state: "active", name: "Peakhour Suite" };
const agency = { tier: "agency", productKey: "agency", state: "active", name: "Agency" };
const suiteOnTrial = { tier: "suite", productKey: "suite", state: "trial", name: "Peakhour Suite" };
/** A stored leftover until P4.5: a `.free` line the api may still list. */
const freeLeftover = { tier: "commerce_assistant.free", state: "active", name: "Peakhour.ai Commerce: Free" };
/** A line whose `name` fell back to the raw tier key server-side. */
const unnamed = { tier: "suite", productKey: "suite", state: "active", name: "suite" };

/** The base Suite trial, live: `planName` carried because the server always
 *  sends it (`resolvePlanName` ends `return name || key`). */
const TRIAL = { plan: "suite", planName: "Peakhour Suite", trialActive: true, trialEndsAt: "2026-10-20T00:00:00.000Z" };
const TRIAL_ENDED = { ...TRIAL, trialActive: false };
const CONTRACT = { plan: "enterprise", planName: "Enterprise", trialActive: false, trialEndsAt: null };

function summary(over: PlanSummaryish = {}): PlanSummaryish {
  return { subscription: over.subscription ?? TRIAL, products: over.products ?? [] };
}

describe("planState: trial, paid or none (D19)", () => {
  it("a live base Suite trial is the trial", () => {
    expect(planState(summary())).toBe("trial");
  });

  it("a trial whose date has passed is no plan, not a contract", () => {
    expect(planState(summary({ subscription: TRIAL_ENDED }))).toBe("none");
  });

  it("a base row with no trial date is a contract, which is paid", () => {
    expect(planState(summary({ subscription: CONTRACT }))).toBe("paid");
  });

  it("a bought line is paid, whatever the base row says", () => {
    expect(planState(summary({ subscription: TRIAL_ENDED, products: [suite] }))).toBe("paid");
    expect(planState(summary({ subscription: { plan: "free", planName: "Free" }, products: [suite] }))).toBe("paid");
    expect(planState(summary({ products: [suiteOnTrial] }))).toBe("paid");
  });

  it("a stored free or none base (until P4.5) is no plan", () => {
    expect(planState(summary({ subscription: { plan: "free", planName: "Free" } }))).toBe("none");
    expect(planState(summary({ subscription: { plan: "commerce_assistant.free", planName: "Commerce: Free", trialActive: true } }))).toBe("none");
    expect(planState(summary({ subscription: { plan: "none" } }))).toBe("none");
    expect(planState(summary({ subscription: {} }))).toBe("none");
  });

  it("a held .free line is not a plan: the business is still on its trial or holds none", () => {
    expect(planState(summary({ products: [freeLeftover] }))).toBe("trial");
    expect(planState(summary({ subscription: TRIAL_ENDED, products: [freeLeftover] }))).toBe("none");
  });

  it("an unloaded summary has no state yet", () => {
    expect(planState(undefined)).toBeNull();
    expect(planState({})).toBeNull();
  });

  it("a malformed products entry does not throw in a top-bar component", () => {
    const bad = { subscription: TRIAL, products: [undefined, { state: "active" }] } as unknown as PlanSummaryish;
    expect(planState(bad)).toBe("trial");
  });
});

describe("isNoPlanKey: the leftovers that name no plan", () => {
  it("free, a dotted .free, none and nothing name no plan; a catalog plan does", () => {
    expect(isNoPlanKey("free")).toBe(true);
    expect(isNoPlanKey("support_inbox.free")).toBe(true);
    expect(isNoPlanKey("none")).toBe(true);
    expect(isNoPlanKey("")).toBe(true);
    expect(isNoPlanKey(undefined)).toBe(true);
    expect(isNoPlanKey("suite")).toBe(false);
    expect(isNoPlanKey("agency")).toBe(false);
    expect(isNoPlanKey("internal_platform")).toBe(false);
  });

  it("heldLines leaves a .free line out and keeps the rest in order", () => {
    expect(heldLines([freeLeftover, suite, undefined, agency])).toEqual([suite, agency]);
    expect(heldLines(undefined)).toEqual([]);
  });
});

describe("upgradeCta: the top bar's call to action", () => {
  it("a paid business is not told to upgrade", () => {
    expect(upgradeCta(summary({ products: [suite] }))).toBeNull();
    expect(upgradeCta(summary({ subscription: CONTRACT }))).toBeNull();
  });

  it("the trial is asked to buy before it ends", () => {
    expect(upgradeCta(summary())).toEqual({ label: "Upgrade", title: "Buy a plan before your trial ends" });
  });

  it("no plan is told it has none and how to continue", () => {
    expect(upgradeCta(summary({ subscription: TRIAL_ENDED }))?.label).toBe("Buy a plan");
    expect(upgradeCta(summary({ subscription: { plan: "free", planName: "Free" } }))?.label).toBe("Buy a plan");
  });

  it("an unloaded summary shows nothing (no flash)", () => {
    expect(upgradeCta(undefined)).toBeNull();
  });

  it("the billing page changes a paid plan and buys otherwise", () => {
    expect(planButtonLabel("paid")).toBe("Change plan");
    expect(planButtonLabel("trial")).toBe("Buy a plan");
    expect(planButtonLabel("none")).toBe("Buy a plan");
    expect(planButtonLabel(null)).toBe("See plans");
  });
});

describe("planDisplayName", () => {
  it("the trial is named by the base plan's name", () => {
    expect(planDisplayName(summary())).toBe("Peakhour Suite");
  });

  it("no plan reads No plan, never Free or a product", () => {
    expect(planDisplayName(summary({ subscription: TRIAL_ENDED }))).toBe("No plan");
    expect(planDisplayName(summary({ subscription: { plan: "free", planName: "Free" } }))).toBe("No plan");
    expect(planDisplayName(summary({ subscription: { plan: "free", planName: "Free" }, products: [freeLeftover] }))).toBe("No plan");
  });

  it("a bought line names itself over the base row", () => {
    expect(planDisplayName(summary({ subscription: { plan: "free", planName: "Free" }, products: [suite] }))).toBe("Peakhour Suite");
  });

  it("a contract is named by planName", () => {
    expect(planDisplayName(summary({ subscription: CONTRACT }))).toBe("Enterprise");
  });

  it("a planName that is only the key falls back to the capitalised key", () => {
    expect(planDisplayName(summary({ subscription: { plan: "internal_platform", planName: "internal_platform" } }))).toBe("Internal_platform");
  });

  it("two distinct plans are counted, not listed", () => {
    expect(planDisplayName(summary({ products: [suite, agency] }))).toBe("2 plans");
  });

  it("a line named by its tier key falls back to a count", () => {
    expect(planDisplayName(summary({ products: [unnamed] }))).toBe("1 plan");
  });

  it("a plan change names the ending line, the one already charging (D21)", () => {
    const ending = { ...suite, endsAt: ENDS };
    const replacement = { tier: "agency", productKey: "suite", state: "active", name: "Agency" };
    expect(planDisplayName(summary({ products: [replacement, ending] }))).toBe("Peakhour Suite");
  });

  it("a term change on one plan is one plan, not two", () => {
    const ending = { ...suite, endsAt: ENDS };
    expect(planDisplayName(summary({ products: [ending, suite] }))).toBe("Peakhour Suite");
  });

  it("an unloaded summary names nothing", () => {
    expect(planDisplayName(undefined)).toBeNull();
  });
});

describe("a held line's row (D21, review R2 on b2c#589)", () => {
  it("an ending line offers no cancel; its replacement does", () => {
    expect(productRowAction({ tier: "suite", state: "active", endsAt: ENDS })).toBeNull();
    expect(productRowAction({ tier: "suite", state: "active", endsAt: null })).toBe("cancel");
    expect(productRowAction({ tier: "suite", state: "active" })).toBe("cancel");
  });

  it("a leftover .free line offers nothing", () => {
    expect(productRowAction(freeLeftover)).toBeNull();
  });

  it("the ending line and its replacement on one tier are two lines; the same line from either source is one", () => {
    expect(lineKey({ tier: "suite", endsAt: ENDS })).not.toBe(lineKey({ tier: "suite", endsAt: null }));
    expect(lineKey({ tier: "suite", endsAt: null })).toBe(lineKey({ tier: "suite" }));
    expect(lineKey({ tier: "suite", endsAt: ENDS })).toBe(lineKey({ tier: "suite", endsAt: ENDS }));
    expect(lineKey({ tier: "suite" })).not.toBe(lineKey({ tier: "agency" }));
  });
});

describe("a billed line (D21, review R3 on b2c#589)", () => {
  it("a held line still running is billed; an ending one, or a .free leftover, is not", () => {
    expect(isBilledLine({ tier: "suite", state: "active" })).toBe(true);
    expect(isBilledLine({ tier: "suite", state: "active", endsAt: null })).toBe(true);
    expect(isBilledLine({ tier: "suite", state: "active", endsAt: ENDS })).toBe(false);
    expect(isBilledLine(freeLeftover)).toBe(false);
  });
});

/**
 * The state is the ACTIVE business's (independent review on b2c#591). The
 * summary is org-wide: every business's lines and the one base row, which is
 * the first business's trial. `/me` `entitlements.coverage` is the business's
 * own answer and decides whenever it is served.
 */
describe("the active business's own state (review on b2c#591)", () => {
  const PAID = { coverage: "paid", plan: "suite" };
  const NONE = { coverage: "none", plan: "none" };
  const ON_TRIAL = { coverage: "trial", plan: "suite" };

  it("a padlocked business is no plan though a sibling bought Suite", () => {
    const s = summary({ subscription: TRIAL_ENDED, products: [suite] });
    expect(planState(s, NONE)).toBe("none");
    expect(planDisplayName(s, NONE)).toBe("No plan");
    expect(upgradeCta(s, NONE)?.label).toBe("Buy a plan");
  });

  it("a business with no plan is not on the first business's trial", () => {
    expect(planState(summary(), NONE)).toBe("none");
    expect(upgradeCta(summary(), NONE)?.label).toBe("Buy a plan");
  });

  it("the trial business is on its trial though a sibling bought, and is named by the base row", () => {
    const s = summary({ products: [agency] });
    expect(planState(s, ON_TRIAL)).toBe("trial");
    expect(planDisplayName(s, ON_TRIAL)).toBe("Peakhour Suite");
    expect(upgradeCta(s, ON_TRIAL)?.label).toBe("Upgrade");
  });

  it("a paid business is paid though the org's base trial ended, and gets no CTA", () => {
    const s = summary({ subscription: TRIAL_ENDED, products: [] });
    expect(planState(s, PAID)).toBe("paid");
    expect(upgradeCta(s, PAID)).toBeNull();
  });

  it("a paid business is named by its own lines, not a sibling's", () => {
    expect(planDisplayName(summary({ products: [suite, agency] }), { coverage: "paid", plan: "agency" })).toBe("Agency");
  });

  it("a paid business keeps both halves of its own plan change", () => {
    const ending = { ...suite, endsAt: ENDS };
    const replacement = { tier: "agency", productKey: "suite", state: "active", name: "Agency" };
    expect(planDisplayName(summary({ products: [replacement, ending] }), { coverage: "paid", plan: "agency" })).toBe("Peakhour Suite");
  });

  it("a contract business is named by its base row though a sibling bought", () => {
    expect(planDisplayName(summary({ subscription: CONTRACT, products: [suite] }), { coverage: "paid", plan: "enterprise" })).toBe("Enterprise");
  });

  it("a coverage the three states do not include falls back to the org-wide summary", () => {
    for (const b of [{ coverage: "free", plan: "free" }, {}, null, undefined]) {
      expect(planState(summary({ products: [suite] }), b)).toBe("paid");
      expect(planState(summary({ subscription: TRIAL_ENDED }), b)).toBe("none");
      expect(planState(summary(), b)).toBe("trial");
      expect(planDisplayName(summary({ products: [suite, agency] }), b)).toBe("2 plans");
    }
  });

  it("coverage does not answer before the summary loads", () => {
    expect(planState(undefined, PAID)).toBeNull();
    expect(planDisplayName(undefined, NONE)).toBeNull();
  });
});

describe("planHeadline: the billing page's plan header (review on b2c#591)", () => {
  it("an unloaded or failed summary is its own neutral state, not padlocked", () => {
    for (const b of [undefined, { coverage: "none" }]) {
      expect(planHeadline(undefined, b)).toEqual({ state: null, label: "Plan not loaded", padlocked: false, button: "See plans" });
    }
  });

  it("a business with no plan is padlocked and buys one", () => {
    expect(planHeadline(summary({ subscription: TRIAL_ENDED }))).toEqual({ state: "none", label: "No plan", padlocked: true, button: "Buy a plan" });
  });

  it("a paid business changes plan, and the trial buys", () => {
    expect(planHeadline(summary({ products: [suite] }))).toEqual({ state: "paid", label: "Peakhour Suite", padlocked: false, button: "Change plan" });
    expect(planHeadline(summary())).toEqual({ state: "trial", label: "Peakhour Suite", padlocked: false, button: "Buy a plan" });
  });

  it("the header reads the active business's coverage", () => {
    expect(planHeadline(summary({ subscription: TRIAL_ENDED, products: [suite] }), { coverage: "none" }).padlocked).toBe(true);
  });
});

describe("trialWarningDays: the trial-expiry banner (review on b2c#591)", () => {
  const twoLeft = { ...TRIAL, trialDaysRemaining: 2 };
  const threeLeft = { ...TRIAL, trialDaysRemaining: 3 };
  const fourLeft = { ...TRIAL, trialDaysRemaining: 4 };
  const endedZero = { ...TRIAL_ENDED, trialDaysRemaining: 0 };

  it("warns the business on its own trial", () => {
    expect(trialWarningDays(summary({ subscription: twoLeft }), { coverage: "trial" }, 3)).toBe(2);
  });

  it("does not warn a sibling, paid or padlocked, about the first business's trial", () => {
    expect(trialWarningDays(summary({ subscription: twoLeft }), { coverage: "paid", plan: "suite" }, 3)).toBeNull();
    expect(trialWarningDays(summary({ subscription: twoLeft }), { coverage: "none" }, 3)).toBeNull();
  });

  it("warns inside the window, the last day of it included, and not before", () => {
    expect(trialWarningDays(summary({ subscription: threeLeft }), { coverage: "trial" }, 3)).toBe(3);
    expect(trialWarningDays(summary({ subscription: fourLeft }), { coverage: "trial" }, 3)).toBeNull();
  });

  it("without coverage it reads the org-wide trial, and nothing before the summary loads", () => {
    expect(trialWarningDays(summary({ subscription: twoLeft }), null, 3)).toBe(2);
    expect(trialWarningDays(summary({ subscription: endedZero }), null, 3)).toBeNull();
    expect(trialWarningDays(undefined, { coverage: "trial" }, 3)).toBeNull();
  });
});
