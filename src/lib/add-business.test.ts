import { describe, it, expect, vi } from "vitest";
import {
  ADD_BUSINESS_NOT_NEEDED,
  CHECKOUT_IN_PROGRESS,
  PENDING_ADD_KEY,
  PENDING_ADD_TTL_MS,
  addBusinessAction,
  addBusinessErrorCopy,
  addBusinessOutcome,
  arrivalCopy,
  awaitAddedBusiness,
  cleanBusinessName,
  isBusinessLimit,
  offerLine,
  pickedPlan,
  planChoices,
  priceParts,
  readPendingAdd,
  rememberPendingAdd,
  safeNext,
  boughtForStore,
  rememberBoughtForStore,
  type AddBusinessPrice,
} from "./add-business";

/**
 * The add-business purchase's decisions and sentences (billing plan P3.2, on
 * the api's P3.1b routes), rendered by `AddBusinessDialog`, the billing page's
 * return and the four places that sell a business.
 */

const BIZ = "6650000000000000000000d4";
const fmt = (amount: number, currency: string) => `${currency} ${amount}`;

const DISCOUNTED: AddBusinessPrice = {
  amount: 24,
  currency: "GBP",
  interval: "month",
  listAmount: 49,
  discountPct: 50,
  discountDurationTerms: null,
  campaignLabel: "First workspace: half price",
};
const LIST: AddBusinessPrice = { amount: 49, currency: "GBP", interval: "month", discountPct: 0, discountDurationTerms: null, campaignLabel: null };

describe("the offer comes from the campaign, never from the page", () => {
  it("★the campaign's own label and percent, for the life of the plan when its duration is null", () => {
    expect(offerLine(DISCOUNTED)).toBe("First workspace: half price · 50% off, for as long as you keep this plan");
  });

  it("★no label: the percent alone, never a name the page invents", () => {
    expect(offerLine({ ...DISCOUNTED, campaignLabel: null })).toBe("50% off, for as long as you keep this plan");
  });

  it("a campaign that lasts some terms says how many, in the plan's own term", () => {
    expect(offerLine({ ...DISCOUNTED, discountDurationTerms: 3 })).toBe("First workspace: half price · 50% off, for your first 3 months");
    expect(offerLine({ ...DISCOUNTED, interval: "year", discountDurationTerms: 1 })).toBe("First workspace: half price · 50% off, for your first year");
    expect(offerLine({ ...DISCOUNTED, interval: "quarter", discountDurationTerms: 2 })).toMatch(/first 2 quarters$/);
  });

  it("PASS: no campaign, no offer line, even beside a stray label", () => {
    expect(offerLine(LIST)).toBeNull();
    expect(offerLine({ ...LIST, campaignLabel: "Founding price" })).toBeNull();
    expect(offerLine(undefined)).toBeNull();
  });

  it("★the struck list price only beside a discount that lowered it", () => {
    expect(priceParts(DISCOUNTED, fmt)).toEqual({ now: "GBP 24/mo", was: "GBP 49/mo" });
    expect(priceParts(LIST, fmt)).toEqual({ now: "GBP 49/mo", was: null });
    expect(priceParts({ ...DISCOUNTED, listAmount: 24 }, fmt).was).toBeNull();
    expect(priceParts({ ...LIST, interval: "year", amount: 490 }, fmt).now).toBe("GBP 490/yr");
  });
});

describe("Pay: never twice, never before the preview has spoken", () => {
  const ready = { name: "Table Story", preview: { kind: "new" as const, rail: "stripe", price: LIST }, previewWaiting: false, previewFailed: false, starting: false, paying: false };

  it("PASS: a named business with its preview in is payable", () => {
    expect(addBusinessAction(ready)).toEqual({ label: "Continue to payment", disabled: false, note: null, refused: false, notNeeded: false });
  });

  it("★shut while the purchase starts", () => {
    expect(addBusinessAction({ ...ready, starting: true })).toMatchObject({ disabled: true, label: "Starting…" });
  });

  it("★shut while its payment window is open", () => {
    expect(addBusinessAction({ ...ready, paying: true })).toMatchObject({ disabled: true });
  });

  it("★shut while the preview is pending (or paused offline)", () => {
    expect(addBusinessAction({ ...ready, previewWaiting: true }).disabled).toBe(true);
  });

  it("★shut with the refusal said when the preview refuses", () => {
    const a = addBusinessAction({ ...ready, preview: { kind: "refused", code: "SLUG_EXISTS", message: "A business with this name already exists in your organization" } });
    expect(a).toMatchObject({ disabled: true, refused: true, notNeeded: false, note: "A business with this name already exists in your organization" });
  });

  it("a plan that already covers another business points to the free path", () => {
    const a = addBusinessAction({ ...ready, preview: { kind: "refused", code: ADD_BUSINESS_NOT_NEEDED, message: "Your plan already covers every workspace, so this one needs no purchase." } });
    expect(a).toMatchObject({ disabled: true, refused: true, notNeeded: true });
  });

  it("shut where the catalog says payments are not available", () => {
    expect(addBusinessAction({ ...ready, purchasable: false })).toMatchObject({ disabled: true, note: "Payments aren't available in your country yet." });
    expect(addBusinessAction({ ...ready, purchasable: true }).disabled).toBe(false);
  });

  it("★a plan that covers another business still reaches the free path where payments are not available (review R2)", () => {
    const a = addBusinessAction({
      ...ready,
      purchasable: false,
      preview: { kind: "refused", code: ADD_BUSINESS_NOT_NEEDED, message: "Your plan already covers every workspace, so this one needs no purchase." },
    });
    expect(a).toMatchObject({ notNeeded: true, refused: true, note: "Your plan already covers every workspace, so this one needs no purchase." });
  });

  it("★shut without a name", () => {
    expect(addBusinessAction({ ...ready, name: null })).toMatchObject({ disabled: true, note: "Name the business to continue." });
  });

  it("PASS: a failed preview does not hold Pay shut, and says the payment step shows the price", () => {
    const a = addBusinessAction({ ...ready, preview: null, previewFailed: true });
    expect(a.disabled).toBe(false);
    expect(a.note).toMatch(/payment step shows it/);
  });

  it("names are the api's: trimmed, 1 to 120 characters", () => {
    expect(cleanBusinessName("  Table Story ")).toBe("Table Story");
    expect(cleanBusinessName("   ")).toBeNull();
    expect(cleanBusinessName("x".repeat(120))).toHaveLength(120);
    expect(cleanBusinessName("x".repeat(121))).toBeNull();
  });
});

describe("POST /add-business's answer", () => {
  it("★a gateway answer is mounted, with the business it will create", () => {
    const res = { gateway: "stripe", embed: { kind: "stripe", clientSecret: "cs_x", publishableKey: "pk" }, businessId: BIZ, businessName: "Table Story" };
    expect(addBusinessOutcome(res, "Table Story")).toEqual({ kind: "pay", checkout: res, businessId: BIZ, businessName: "Table Story" });
  });

  it("a Razorpay answer is mounted the same way", () => {
    const res = { gateway: "razorpay", embed: { kind: "razorpay", subscriptionId: "sub_x", keyId: "k" }, businessId: BIZ };
    expect(addBusinessOutcome(res, "Table Story")).toMatchObject({ kind: "pay", businessId: BIZ, businessName: null });
  });

  it("a malformed business id is no id: the payment still mounts, the switch never names it", () => {
    const res = { gateway: "stripe", embed: { kind: "stripe", clientSecret: "cs_x", publishableKey: "pk" }, businessId: "../x" };
    expect(addBusinessOutcome(res, "T")).toMatchObject({ kind: "pay", businessId: null });
  });

  it("★an invoice creates no business, and the page never says one is coming", () => {
    const out = addBusinessOutcome({ mode: "invoice_required", tierLabel: "Agency" }, "Table Story");
    expect(out.kind).toBe("invoice");
    const message = (out as { message: string }).message;
    expect(message).toMatch(/^Agency for Table Story is above the limit banks allow/);
    expect(message).toContain("Nothing was charged and Table Story was not created");
  });

  it("anything else is unknown, never a payment", () => {
    expect(addBusinessOutcome({ mode: "added" }, "T").kind).toBe("unknown");
    expect(addBusinessOutcome(null, "T").kind).toBe("unknown");
    expect(addBusinessOutcome({ gateway: "stripe" }, "T").kind).toBe("unknown");
  });

  it("★CHECKOUT_IN_PROGRESS says to wait and look, not to press again", () => {
    expect(addBusinessErrorCopy(CHECKOUT_IN_PROGRESS, "Checkout for this plan is already starting. Please wait a moment.")).toBe(
      "A payment for this plan is already starting. Wait a moment, then check Billing before you try again, so you aren't charged twice.",
    );
  });

  it("PASS: any other refusal is the api's own words, with a fallback", () => {
    expect(addBusinessErrorCopy("NO_GATEWAY_FOR_PURCHASE", "Online checkout can't take a purchase for a new business yet.")).toBe(
      "Online checkout can't take a purchase for a new business yet.",
    );
    expect(addBusinessErrorCopy(undefined, "  ")).toBe("We couldn't start the payment. Please try again.");
  });

  it("the free add paths' 402 is the way into the purchase; nothing else is", () => {
    expect(isBusinessLimit({ code: "BUSINESS_LIMIT_REACHED", status: 402 })).toBe(true);
    expect(isBusinessLimit({ code: "CLAIM_BUSINESS_LIMIT" })).toBe(true);
    expect(isBusinessLimit({ code: "BUSINESS_LIMIT_REACHED", status: 409 })).toBe(false);
    expect(isBusinessLimit({ code: "SLUG_EXISTS", status: 402 })).toBe(false);
    expect(isBusinessLimit(null)).toBe(false);
  });
});

describe("the plans offered are the catalog's", () => {
  const catalog = [
    { tier: "suite", name: "Peakhour Suite", termPrices: [{ term: "yearly" as const }, { term: "monthly" as const }] },
    { tier: "agency", name: "Agency", bundle: true, termPrices: [{ term: "quarterly" as const }, { term: "yearly" as const }] },
    { tier: "enterprise", name: "Enterprise", bundle: true, contactSales: true, termPrices: [] },
    { tier: "dormant", name: "Dormant", termPrices: [] },
  ];

  it("sellable plans with their terms in order; talk-to-sales apart; a plan selling no term left out", () => {
    const { buy, contact } = planChoices(catalog);
    expect(buy.map((p) => [p.tier, p.terms])).toEqual([
      ["suite", ["monthly", "yearly"]],
      ["agency", ["quarterly", "yearly"]],
    ]);
    expect(contact.map((p) => p.tier)).toEqual(["enterprise"]);
  });

  it("PASS: a catalog with other names is offered as it is (nothing is hard-coded)", () => {
    const { buy } = planChoices([{ tier: "x1", name: "Renamed", termPrices: [{ term: "monthly" }] }]);
    expect(buy).toEqual([{ tier: "x1", name: "Renamed", tagline: undefined, bundle: false, terms: ["monthly"] }]);
  });

  it("★the default is the first plan for one business, monthly when sold", () => {
    const { buy } = planChoices(catalog);
    expect(pickedPlan(buy, { tier: null, term: null })).toEqual({ tier: "suite", term: "monthly" });
    // A bundle listed first is still not the default for one business.
    const bundleFirst = planChoices([catalog[1]!, catalog[0]!]).buy;
    expect(pickedPlan(bundleFirst, { tier: null, term: null })).toEqual({ tier: "suite", term: "monthly" });
  });

  it("a plan with no monthly term opens on its first", () => {
    const { buy } = planChoices(catalog);
    expect(pickedPlan(buy, { tier: "agency", term: null })).toEqual({ tier: "agency", term: "quarterly" });
    expect(pickedPlan(buy, { tier: "agency", term: "monthly" })).toEqual({ tier: "agency", term: "quarterly" });
  });

  it("PASS: the buyer's pick stands while the catalog sells it", () => {
    const { buy } = planChoices(catalog);
    expect(pickedPlan(buy, { tier: "suite", term: "yearly" })).toEqual({ tier: "suite", term: "yearly" });
    expect(pickedPlan(buy, { tier: "gone", term: "yearly" })).toEqual({ tier: "suite", term: "yearly" });
    expect(pickedPlan([], { tier: null, term: null })).toBeNull();
  });
});

function memoryStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("the pending purchase across Stripe's return", () => {
  it("★remembered for its business, with where to go next", () => {
    const s = memoryStorage();
    rememberPendingAdd(s, { businessId: BIZ, name: "Table Story", next: "/dashboard/integrations", at: 1000 });
    expect(readPendingAdd(s, BIZ, 2000)).toEqual({ businessId: BIZ, name: "Table Story", next: "/dashboard/integrations", at: 1000 });
  });

  it("another business's, an expired one, or one from the future is not this one", () => {
    const s = memoryStorage();
    rememberPendingAdd(s, { businessId: BIZ, name: "T", at: 1000 });
    expect(readPendingAdd(s, "6650000000000000000000ff", 2000)).toBeNull();
    expect(readPendingAdd(s, BIZ, 1000 + PENDING_ADD_TTL_MS + 1)).toBeNull();
    expect(readPendingAdd(s, BIZ, 999)).toBeNull();
  });

  it("★a stored `next` that leaves the site is dropped", () => {
    for (const next of ["//evil.example", "https://evil.example", "/\\evil.example", "javascript:alert(1)"]) {
      const s = memoryStorage({ [PENDING_ADD_KEY]: JSON.stringify({ businessId: BIZ, name: "T", next, at: 1000 }) });
      expect(readPendingAdd(s, BIZ, 2000), next).not.toHaveProperty("next");
    }
    expect(safeNext("/claim/shopify?store=a&t=b&into=c")).toBe("/claim/shopify?store=a&t=b&into=c");
  });

  it("blocked or corrupt storage is no pending purchase, and never throws", () => {
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => undefined };
    expect(() => rememberPendingAdd(throwing, { businessId: BIZ, name: "T", at: 1 })).not.toThrow();
    expect(readPendingAdd(throwing, BIZ, 2)).toBeNull();
    expect(readPendingAdd(memoryStorage({ [PENDING_ADD_KEY]: "{" }), BIZ, 2)).toBeNull();
    expect(readPendingAdd(null, BIZ, 2)).toBeNull();
  });
});

describe("the arrival: only the api's word moves the buyer", () => {
  function clock() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => void (t += ms) };
  }

  it("★/confirm says activated: arrived at once", async () => {
    const c = clock();
    const listBusinessIds = vi.fn(async () => [] as string[]);
    const out = await awaitAddedBusiness({ businessId: BIZ, sessionId: "cs_1", confirm: async () => ({ activated: true }), listBusinessIds, ...c });
    expect(out).toBe("arrived");
    expect(listBusinessIds).not.toHaveBeenCalled();
  });

  it("★/confirm pending: wait until the business list names it", async () => {
    const c = clock();
    let rounds = 0;
    const out = await awaitAddedBusiness({
      businessId: BIZ,
      sessionId: "cs_1",
      confirm: async () => ({ activated: false }),
      listBusinessIds: async () => (++rounds >= 3 ? ["other", BIZ] : ["other"]),
      ...c,
    });
    expect([out, rounds]).toEqual(["arrived", 3]);
  });

  it("★never seen: timeout, never arrived", async () => {
    const c = clock();
    const out = await awaitAddedBusiness({
      businessId: BIZ,
      sessionId: "cs_1",
      confirm: async () => ({ activated: false }),
      listBusinessIds: async () => ["other"],
      maxWaitMs: 10_000,
      intervalMs: 2_500,
      ...c,
    });
    expect(out).toBe("timeout");
    expect(c.now()).toBe(10_000);
  });

  it("a thrown /confirm or a failed list is a wait, not an arrival", async () => {
    const c = clock();
    const out = await awaitAddedBusiness({
      businessId: BIZ,
      sessionId: "cs_1",
      confirm: async () => {
        throw new Error("502");
      },
      listBusinessIds: async () => {
        throw new Error("offline");
      },
      maxWaitMs: 5_000,
      ...c,
    });
    expect(out).toBe("timeout");
  });

  it("PASS: Razorpay has no session: /confirm is never asked, the list decides", async () => {
    const c = clock();
    const confirm = vi.fn<(sessionId: string) => Promise<{ activated: boolean }>>(async () => ({ activated: true }));
    const out = await awaitAddedBusiness({ businessId: BIZ, sessionId: null, confirm, listBusinessIds: async () => [BIZ], ...c });
    expect(out).toBe("arrived");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("a page that went away stops waiting", async () => {
    const c = clock();
    const out = await awaitAddedBusiness({ businessId: BIZ, confirm: async () => null, listBusinessIds: async () => [], cancelled: () => true, ...c });
    expect(out).toBe("cancelled");
  });

  it("what the page says: ready, or received and still being set up", () => {
    expect(arrivalCopy("arrived", "Table Story")).toEqual({
      title: "Table Story is ready",
      description: "You're now working in Table Story. Switch back any time from the workspace menu.",
    });
    expect(arrivalCopy("timeout", "Table Story")).toEqual({
      title: "Payment received",
      description: "Table Story is still being set up. It will appear in the workspace menu in a moment.",
    });
  });
});

describe("a workspace bought for a Shopify store (review R1)", () => {
  it("★only the business this tab bought for this store is honoured", () => {
    const s = memoryStorage();
    rememberBoughtForStore(s, BIZ, "conn_1", 1000);
    expect(boughtForStore(s, BIZ, "conn_1", 2000)).toBe(true);
    expect(boughtForStore(s, "6650000000000000000000ff", "conn_1", 2000)).toBe(false);
    expect(boughtForStore(s, BIZ, "conn_2", 2000)).toBe(false);
  });

  it("an old record, one from the future, none, or blocked storage is not proof", () => {
    const s = memoryStorage();
    rememberBoughtForStore(s, BIZ, "conn_1", 1000);
    expect(boughtForStore(s, BIZ, "conn_1", 1000 + PENDING_ADD_TTL_MS + 1)).toBe(false);
    expect(boughtForStore(s, BIZ, "conn_1", 999)).toBe(false);
    expect(boughtForStore(memoryStorage(), BIZ, "conn_1", 2000)).toBe(false);
    expect(boughtForStore(null, BIZ, "conn_1", 2000)).toBe(false);
    expect(boughtForStore(s, "", "conn_1", 2000)).toBe(false);
  });
});
