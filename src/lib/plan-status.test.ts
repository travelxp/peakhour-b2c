import { describe, expect, it } from "vitest";

import {
  activeBusiness,
  planRowLabel,
  businessLines,
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
 * a paid plan, or holds none (padlocked). There is no free tier (D19; its
 * per-product rows went with migration 394, P4.5): no plan is `none`, no base
 * row, or a bare `free` a stored row may still carry.
 */

const ENDS = "2026-11-01T00:00:00.000Z";
const suite = { tier: "suite", productKey: "suite", state: "active", name: "Peakhour Suite" };
const agency = { tier: "agency", productKey: "agency", state: "active", name: "Agency" };
const suiteOnTrial = { tier: "suite", productKey: "suite", state: "trial", name: "Peakhour Suite" };
/** A line naming no plan (a bare `free`, the one free-tier key still read as
 *  none; review R1): not listed, not counted, offers nothing. */
const noPlanLine = { tier: "free", state: "active", name: "Free" };
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
    expect(planState(summary({ subscription: { plan: "none" }, products: [suite] }))).toBe("paid");
    expect(planState(summary({ products: [suiteOnTrial] }))).toBe("paid");
  });

  it("a none base, or an empty one, is no plan", () => {
    expect(planState(summary({ subscription: { plan: "none" } }))).toBe("none");
    expect(planState(summary({ subscription: {} }))).toBe("none");
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

describe("isNoPlanKey: the keys that name no plan", () => {
  it("none, a bare free and nothing name no plan; a catalog plan does", () => {
    expect(isNoPlanKey("none")).toBe(true);
    expect(isNoPlanKey("free")).toBe(true);
    expect(isNoPlanKey("")).toBe(true);
    expect(isNoPlanKey(undefined)).toBe(true);
    expect(isNoPlanKey(null)).toBe(true);
    expect(isNoPlanKey("suite")).toBe(false);
    expect(isNoPlanKey("agency")).toBe(false);
    expect(isNoPlanKey("internal_platform")).toBe(false);
    expect(isNoPlanKey("freebie")).toBe(false);
  });

  it("★a held bare free line is not a plan, on every surface (review R1: the old R3 path)", () => {
    // Not listed under "Your plans", no Cancel, not counted, not a paid state.
    expect(heldLines([noPlanLine, suite])).toEqual([suite]);
    expect(productRowAction(noPlanLine)).toBeNull();
    expect(isBilledLine(noPlanLine)).toBe(false);
    expect(planState(summary({ subscription: TRIAL_ENDED, products: [noPlanLine] }))).toBe("none");
    expect(planHeadline(summary({ subscription: TRIAL_ENDED, products: [noPlanLine] })).label).toBe("No plan");
    expect(planHeadline(summary({ subscription: TRIAL_ENDED, products: [noPlanLine] })).button).toBe("Buy a plan");
  });

  it("★a bare free BASE row is no plan, and is never named (review R2)", () => {
    expect(planState(summary({ subscription: { plan: "free", planName: "Free" } }))).toBe("none");
    expect(planDisplayName(summary({ subscription: { plan: "free", planName: "Free" } }))).toBe("No plan");
  });

  it("★a bare free line beside a live trial leaves the business on its trial (review R2)", () => {
    expect(planState(summary({ products: [noPlanLine] }))).toBe("trial");
    expect(planDisplayName(summary({ products: [noPlanLine] }))).toBe("Peakhour Suite");
  });

  it("★a DOTTED free-tier key is a key like any other now: 394 deleted them (P4.5)", () => {
    // Migration 394 deleted every per-product plan and every row naming one,
    // and api#1532 deletes the api's own free-tier predicate, so none reaches
    // here. The reading that hid them is gone rather than kept for nothing.
    for (const key of ["support_inbox.free", "commerce_assistant.free", "content_studio.lens"]) expect(isNoPlanKey(key), key).toBe(false);
  });

  it("heldLines leaves a line naming no plan out and keeps the rest in order", () => {
    expect(heldLines([noPlanLine, suite, undefined, agency])).toEqual([suite, agency]);
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
    expect(upgradeCta(summary({ subscription: { plan: "none" } }))?.label).toBe("Buy a plan");
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
    expect(planDisplayName(summary({ subscription: { plan: "none" } }))).toBe("No plan");
    expect(planDisplayName(summary({ subscription: { plan: null, planName: null } }))).toBe("No plan");
  });

  it("a bought line names itself over the base row", () => {
    expect(planDisplayName(summary({ subscription: { plan: "none" }, products: [suite] }))).toBe("Peakhour Suite");
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

  it("a line naming no plan offers nothing", () => {
    expect(productRowAction(noPlanLine)).toBeNull();
  });

  it("the ending line and its replacement on one tier are two lines; the same line from either source is one", () => {
    expect(lineKey({ tier: "suite", endsAt: ENDS })).not.toBe(lineKey({ tier: "suite", endsAt: null }));
    expect(lineKey({ tier: "suite", endsAt: null })).toBe(lineKey({ tier: "suite" }));
    expect(lineKey({ tier: "suite", endsAt: ENDS })).toBe(lineKey({ tier: "suite", endsAt: ENDS }));
    expect(lineKey({ tier: "suite" })).not.toBe(lineKey({ tier: "agency" }));
  });
});

describe("a billed line (D21, review R3 on b2c#589)", () => {
  it("a held line still running is billed; an ending one, or one naming no plan, is not", () => {
    expect(isBilledLine({ tier: "suite", state: "active" })).toBe(true);
    expect(isBilledLine({ tier: "suite", state: "active", endsAt: null })).toBe(true);
    expect(isBilledLine({ tier: "suite", state: "active", endsAt: ENDS })).toBe(false);
    expect(isBilledLine(noPlanLine)).toBe(false);
  });
});

/**
 * The state is the ACTIVE business's (independent review on b2c#591), and the
 * lines are its own (P4.3b, api#1510). `/me` `entitlements.coverage` decides
 * the state whenever it is served; every line carries its `businessId`, and
 * the base row is still the org's (the first business's trial, or a contract).
 */
const A = "biz_a";
const B = "biz_b";
const own = <T extends object>(line: T, businessId: string | null = A) => ({ ...line, businessId });

describe("the active business's own state (review on b2c#591)", () => {
  const PAID = { coverage: "paid", businessId: A };
  const NONE = { coverage: "none", businessId: A };
  const ON_TRIAL = { coverage: "trial", businessId: A };

  it("a padlocked business is no plan", () => {
    const s = summary({ subscription: TRIAL_ENDED, products: [] });
    expect(planState(s, NONE)).toBe("none");
    expect(planDisplayName(s, NONE)).toBe("No plan");
    expect(upgradeCta(s, NONE)?.label).toBe("Buy a plan");
  });

  it("a business with no plan is not on the first business's trial", () => {
    expect(planState(summary(), NONE)).toBe("none");
    expect(upgradeCta(summary(), NONE)?.label).toBe("Buy a plan");
  });

  it("the trial business is on its trial and is named by the base row", () => {
    expect(planState(summary(), ON_TRIAL)).toBe("trial");
    expect(planDisplayName(summary(), ON_TRIAL)).toBe("Peakhour Suite");
    expect(upgradeCta(summary(), ON_TRIAL)?.label).toBe("Upgrade");
  });

  it("a paid business is paid though the org's base trial ended, and gets no CTA", () => {
    const s = summary({ subscription: TRIAL_ENDED, products: [] });
    expect(planState(s, PAID)).toBe("paid");
    expect(upgradeCta(s, PAID)).toBeNull();
  });

  it("★a paid business is named by its own lines, never a line stamped with another business (P4.3b)", () => {
    expect(planDisplayName(summary({ products: [own(suite, B), own(agency)] }), PAID)).toBe("Agency");
    expect(planDisplayName(summary({ subscription: TRIAL_ENDED, products: [own(suite, B)] }), PAID)).toBe("Paid plan");
  });

  it("★a trial business that bought Agency is named Agency, though the trial's key is suite (P4.3b; R1 read Paid plan)", () => {
    expect(planDisplayName(summary({ products: [own(agency)] }), PAID)).toBe("Agency");
  });

  it("★a business that bought Suite is named Suite, whatever the base trial's date (official review R3)", () => {
    expect(planDisplayName(summary({ subscription: TRIAL_ENDED, products: [own(suite)] }), PAID)).toBe("Peakhour Suite");
    expect(planDisplayName(summary({ products: [own(suite)] }), PAID)).toBe("Peakhour Suite");
    expect(planHeadline(summary({ subscription: TRIAL_ENDED, products: [own(suite)] }), PAID).label).toBe("Peakhour Suite");
  });

  it("★an unstamped legacy line is every business's, as the api lists it (rowsForBusiness)", () => {
    const s = summary({ subscription: TRIAL_ENDED, products: [own(suite, null)] });
    expect(planDisplayName(s, { coverage: "paid", businessId: B })).toBe("Peakhour Suite");
    expect(planDisplayName(summary({ subscription: TRIAL_ENDED, products: [suite] }), PAID)).toBe("Peakhour Suite");
  });

  it("a paid business keeps both halves of its own plan change", () => {
    const ending = own({ ...suite, endsAt: ENDS });
    const replacement = own({ tier: "agency", productKey: "suite", state: "active", name: "Agency" });
    expect(planDisplayName(summary({ products: [replacement, ending] }), PAID)).toBe("Peakhour Suite");
  });

  it("two plans of its own are counted", () => {
    expect(planDisplayName(summary({ products: [own(suite), own(agency), own(suite, B)] }), PAID)).toBe("2 plans");
  });

  it("a contract business with no line of its own is named by its base row", () => {
    expect(planDisplayName(summary({ subscription: CONTRACT, products: [own(suite, B)] }), PAID)).toBe("Enterprise");
    expect(planDisplayName(summary({ subscription: CONTRACT, products: [] }), PAID)).toBe("Enterprise");
  });

  it("★a base key that means no plan, or none at all (api#1510), never names a paid business", () => {
    for (const subscription of [{ plan: "none" }, {}, { plan: null, planName: null, trialActive: false, trialEndsAt: null }]) {
      expect(planDisplayName(summary({ subscription, products: [] }), PAID)).toBe("Paid plan");
    }
    // A line of its own still names itself over a no-plan base.
    expect(planDisplayName(summary({ subscription: { plan: null, planName: null }, products: [own(agency)] }), PAID)).toBe("Agency");
  });

  it("★a trial base row never names a paid business with no line of its own (official review R1)", () => {
    expect(planDisplayName(summary({ products: [] }), PAID)).toBe("Paid plan");
    expect(planDisplayName(summary({ subscription: { plan: "internal_platform", planName: "internal_platform" } }), PAID)).toBe("Internal_platform");
    // A trial over a no-plan base (a stale summary beside a fresh /me) is
    // still not named by it.
    expect(planDisplayName(summary({ subscription: { plan: "none" } }), ON_TRIAL)).toBe("Trial");
  });

  it("★no live base row (api#1510: plan and planName null) is no plan without coverage", () => {
    const s = summary({ subscription: { plan: null, planName: null, trialActive: false, trialEndsAt: null } });
    expect(planState(s)).toBe("none");
    expect(planDisplayName(s)).toBe("No plan");
  });

  it("★without coverage the state reads the business's own lines, not a sibling's", () => {
    const sibling = summary({ subscription: TRIAL_ENDED, products: [own(suite, B)] });
    expect(planState(sibling, { businessId: A })).toBe("none");
    expect(planDisplayName(sibling, { businessId: A })).toBe("No plan");
    const mine = summary({ subscription: TRIAL_ENDED, products: [own(suite), own(agency, B)] });
    expect(planState(mine, { businessId: A })).toBe("paid");
    expect(planDisplayName(mine, { businessId: A })).toBe("Peakhour Suite");
  });

  it("a coverage the three states do not include is no coverage", () => {
    for (const coverage of ["free", null, undefined]) {
      const b = { coverage, businessId: A };
      expect(planState(summary({ products: [own(suite)] }), b)).toBe("paid");
      expect(planState(summary({ subscription: TRIAL_ENDED }), b)).toBe("none");
      expect(planState(summary(), b)).toBe("trial");
      expect(planDisplayName(summary({ products: [own(suite), own(agency)] }), b)).toBe("2 plans");
    }
  });

  it("coverage does not answer before the summary loads", () => {
    expect(planState(undefined, PAID)).toBeNull();
    expect(planDisplayName(undefined, NONE)).toBeNull();
  });
});

describe("businessLines: the lines that are the business's own (P4.3b)", () => {
  it("keeps its stamped lines and the unstamped ones, in order, and drops another business's", () => {
    const mine = own(suite);
    const legacy = own(agency, null);
    const theirs = own(suite, B);
    expect(businessLines([theirs, mine, legacy], A)).toEqual([mine, legacy]);
    // An absent businessId is unstamped, as the api's `rowsForBusiness` reads it.
    expect(businessLines([suite], A)).toEqual([suite]);
  });

  it("a line naming no plan is not a plan, even its own", () => {
    expect(businessLines([own(noPlanLine)], A)).toEqual([]);
  });

  it("with no business known only the unstamped lines are anybody's", () => {
    const legacy = own(agency, null);
    expect(businessLines([own(suite), legacy], null)).toEqual([legacy]);
    expect(businessLines([own(suite), legacy], undefined)).toEqual([legacy]);
    expect(businessLines(undefined, A)).toEqual([]);
  });
});

describe("activeBusiness: the business plan-status reads, from useAuth()", () => {
  it("takes the coverage from /me's entitlements and the id from its business", () => {
    expect(activeBusiness({ coverage: "paid" }, { _id: A })).toEqual({ coverage: "paid", businessId: A });
  });

  it("an absent entitlements or business is null, never a guess", () => {
    expect(activeBusiness(null, null)).toEqual({ coverage: null, businessId: null });
    expect(activeBusiness(undefined, { _id: B })).toEqual({ coverage: null, businessId: B });
    expect(activeBusiness({}, undefined)).toEqual({ coverage: null, businessId: null });
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

  it("★with no business picked the header says so, not that the plan failed to load (review R1)", () => {
    expect(planHeadline(undefined, { coverage: null, businessId: null })).toEqual({ state: null, label: "No business picked", padlocked: false, button: "See plans" });
    expect(planHeadline(undefined, { coverage: null, businessId: A }).label).toBe("Plan not loaded");
  });

  it("the header reads the active business's coverage", () => {
    expect(planHeadline(summary({ subscription: TRIAL_ENDED, products: [suite] }), { coverage: "none" }).padlocked).toBe(true);
  });

  it("★a paid business's header names its own plan, not a count of the org's (P4.3b)", () => {
    const s = summary({ subscription: TRIAL_ENDED, products: [own(agency), own(suite, B)] });
    expect(planHeadline(s, { coverage: "paid", businessId: A })).toEqual({ state: "paid", label: "Agency", padlocked: false, button: "Change plan" });
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
    expect(trialWarningDays(summary({ subscription: twoLeft }), { coverage: "paid", businessId: B }, 3)).toBeNull();
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

describe("planRowLabel: the settings page's Plan row (review R2 on b2c#592)", () => {
  it("★with no business picked it names nothing, though the api answered for the first business", () => {
    const firstBusiness = summary({ subscription: TRIAL_ENDED, products: [own(suite)] });
    expect(planRowLabel(firstBusiness, { coverage: null, businessId: null })).toBe("No business picked");
  });

  it("with a business it is the plan's name, and a dash before the summary loads", () => {
    expect(planRowLabel(summary({ subscription: TRIAL_ENDED, products: [own(suite)] }), { coverage: "paid", businessId: A })).toBe("Peakhour Suite");
    expect(planRowLabel(undefined, { coverage: "paid", businessId: A })).toBe("—");
  });
});
