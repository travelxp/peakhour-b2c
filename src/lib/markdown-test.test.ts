import { describe, it, expect } from "vitest";
import {
  planFacts, headlineOf, headlineNote, waitingRows, ungroupedWaiting, showWaiting, proposalNotes, startOutcome, outcomeHeading,
  acceptTests, chainsOf, decisionWords, testLine, decisionLine, START_UNCERTAIN, type TestRow, type StartAnswer,
} from "./markdown-test";

const api = (over: Record<string, unknown> = {}) => ({
  cohortSize: 8,
  slowTotal: 412,
  waitingByRoute: { price: 40, too_new: 120, cooldown: 3, not_slow: 900, weird_new_route: 2, exposure: 0 },
  waitingCandidates: 40,
  waitingProducts: [
    { productId: "a", sourceProductId: "sa", title: "Blue tee", reason: "Not on the shelf long enough", route: "too_new" },
    { productId: "b", sourceProductId: "sb", title: "Red tee", reason: "Waiting its turn", route: "price" },
    { productId: "c", sourceProductId: "sc", title: "Old tee", reason: "No route sent" },
    { nonsense: true },
  ],
  tooFewToMeasure: false,
  ...over,
});

describe("planFacts", () => {
  it("reads the api's plan and drops rows it cannot read", () => {
    const f = planFacts(api());
    expect(f.cohortSize).toBe(8);
    expect(f.slowTotal).toBe(412);
    expect(f.waitingProducts.map((w) => w.title)).toEqual(["Blue tee", "Red tee", "Old tee"]);
    expect(f.waitingProducts[2]!.route).toBeNull();
    expect(f.waitingByRoute.exposure).toBeUndefined();
  });
  it("an api that predates every field reads as nothing, not as a throw", () => {
    for (const bad of [undefined, null, 7, "x", {}]) {
      expect(planFacts(bad)).toEqual({ cohortSize: null, slowTotal: null, waitingByRoute: {}, waitingCandidates: null, waitingProducts: [], tooFewToMeasure: null });
    }
  });
});

describe("headline", () => {
  it("names the whole slow shelf when it is known and at least as big as the cohort", () => {
    expect(headlineOf(8, planFacts(api()))).toBe("Ready to test 8 of your 412 slow products");
  });
  it("boundary: slowTotal equal to the cohort still names it; smaller does not", () => {
    expect(headlineOf(8, planFacts(api({ slowTotal: 8 })))).toBe("Ready to test 8 of your 8 slow products");
    expect(headlineOf(8, planFacts(api({ slowTotal: 7 })))).toBe("Ready to test 8 products");
    expect(headlineOf(1, planFacts({}))).toBe("Ready to test 1 product");
  });
  it("says a cohort under five is too few to measure; the api's word wins, 5 is enough", () => {
    expect(headlineNote(4, planFacts({}))).toContain("too few");
    expect(headlineNote(5, planFacts({}))).not.toContain("too few");
    expect(headlineNote(8, planFacts({ tooFewToMeasure: true }))).toContain("too few");
    expect(headlineNote(3, planFacts({ tooFewToMeasure: false }))).not.toContain("too few");
  });
});

describe("waitingRows", () => {
  it("is in the fixed order, drops not_slow, keeps an unknown route by its own key, and groups the named products", () => {
    const rows = waitingRows(planFacts(api()));
    expect(rows.map((r) => r.route)).toEqual(["price", "too_new", "cooldown", "weird_new_route"]);
    expect(rows[3]!.label).toBe("weird new route");
    expect(rows[0]!.count).toBe(40);
    expect(rows[0]!.products.map((p) => p.title)).toEqual(["Red tee"]);
    expect(rows[1]!.products).toHaveLength(1);
  });
  it("a row's count can exceed its listed products (the api names the first few)", () => {
    const r = waitingRows(planFacts(api()))[1]!;
    expect(r.count).toBe(120);
    expect(r.products.length).toBeLessThan(r.count);
  });
  it("products with no route are one ungrouped list", () => {
    expect(ungroupedWaiting(planFacts(api())).map((p) => p.title)).toEqual(["Old tee"]);
  });
});

describe("showWaiting", () => {
  it("is withheld when orders could not be read or markdowns are switched off", () => {
    expect(showWaiting({ guardrails: {} })).toBe(true);
    expect(showWaiting({ ordersConnected: false, guardrails: {} })).toBe(false);
    expect(showWaiting({ guardrails: { maxDiscountPct: 0 } })).toBe(false);
    expect(showWaiting({ guardrails: { maxDiscountPct: 1 } })).toBe(true);
  });
});

describe("proposalNotes", () => {
  it("strike-through only when the api says struck, and the note only when it is not", () => {
    expect(proposalNotes({ struck: true, referenceNote: "ignored" })).toMatchObject({ struck: true, referenceNote: null });
    expect(proposalNotes({ struck: false, referenceNote: "Not crossed out yet." })).toMatchObject({ struck: false, referenceNote: "Not crossed out yet." });
    expect(proposalNotes({})).toMatchObject({ struck: false, referenceNote: null, needsCost: false, route: null });
  });
  it("costKnown false asks for cost per item; undefined (older api) does not", () => {
    expect(proposalNotes({ costKnown: false }).needsCost).toBe(true);
    expect(proposalNotes({ costKnown: true }).needsCost).toBe(false);
    expect(proposalNotes({}).needsCost).toBe(false);
  });
  it("WooCommerce never shows the Shopify hold sentence or a strike-through claim", () => {
    const n = proposalNotes({ struck: false, referenceNote: "These prices have not been charged for 28 days yet, so the old price is not shown crossed out." }, "woocommerce");
    expect(n.referenceNote).toBeNull();
    expect(n.struck).toBe(false);
    expect(proposalNotes({ struck: true }, "woocommerce").struck).toBe(false);
    expect(proposalNotes({ struck: false, referenceNote: "x" }, "shopify").referenceNote).toBe("x");
  });
  it("names a route in plain words, and an unknown one by its key", () => {
    expect(proposalNotes({ route: "broken_run" }).route).toBe("Sizes are running out");
    expect(proposalNotes({ route: "new_thing" }).route).toBe("new thing");
  });
});

const ok = (data: unknown): StartAnswer => ({ ok: true, status: 200, data });
const no = (status: number, data: unknown = {}): StartAnswer => ({ ok: false, status, data });
const started = (cohort: number, holdout: number, results: unknown[] = [], extra = {}) => ok({ test: { campaignId: "c", cohort, holdout, tooFewToMeasure: false, ...extra }, results });

describe("startOutcome", () => {
  it("started: says how many, the holdout, and that it is reviewed weekly", () => {
    const o = startOutcome(started(8, 8));
    expect(o.kind).toBe("started");
    expect(o.message).toContain("8 products are on markdown");
    expect(o.message).toContain("8 similar products are left at full price");
    expect(o.message).toContain("every week");
    expect(outcomeHeading(o)).toBe("Test started");
  });
  it("singular wording, and no holdout clause when there is none", () => {
    const o = startOutcome(started(1, 0));
    expect(o.message).toContain("1 product is on markdown");
    expect(o.message).not.toContain("left at full price");
  });
  it("too few to measure is said when the api says so", () => {
    expect(startOutcome(started(3, 2, [], { tooFewToMeasure: true })).message).toContain("too few to measure");
  });
  it("refused and unknown are told apart: a refusal is left out, an unknown may be live", () => {
    const o = startOutcome(started(5, 5, [{ status: "refused" }, { status: "refused" }, { status: "unknown" }]));
    expect(o.kind).toBe("started");
    expect(o.message).toContain("2 products were left out because Shopify or a safety check refused");
    expect(o.message).toContain("couldn't confirm 1 product");
  });
  it("none on markdown but one unknown: uncertain, never 'nothing was changed'", () => {
    const o = startOutcome(started(0, 4, [{ status: "unknown" }]));
    expect(o.kind).toBe("uncertain");
    expect(o.message).not.toContain("Nothing was changed");
    expect(outcomeHeading(o)).not.toMatch(/not started/i);
  });
  it("none on markdown and none unknown: stopped, nothing was changed", () => {
    const o = startOutcome(started(0, 4, [{ status: "refused" }]));
    expect(o.kind).toBe("stopped");
    expect(o.message).toContain("Nothing was changed");
  });
  it("an ok answer with no count is uncertain", () => {
    expect(startOutcome(ok({})).kind).toBe("uncertain");
    expect(startOutcome(ok(null)).kind).toBe("uncertain");
  });
  it("a request that never answered is uncertain", () => {
    expect(startOutcome(null)).toEqual({ kind: "uncertain", tone: "warning", message: START_UNCERTAIN });
  });
  it("409 MOVED reloads the plan, says nothing was changed, and uses the api's sentence", () => {
    expect(startOutcome(no(409, { code: "MOVED", error: "The list moved." }))).toMatchObject({ kind: "moved", message: "The list moved." });
    expect(startOutcome(no(409, { code: "MOVED" })).message).toContain("nothing was changed");
  });
  it("409 NOT_STARTED and SWITCHED_OFF are clear refusals", () => {
    expect(startOutcome(no(409, { code: "NOT_STARTED", error: "Nope." }))).toMatchObject({ kind: "stopped", message: "Nope." });
    expect(startOutcome(no(409, { code: "SWITCHED_OFF", error: "Off." }))).toMatchObject({ kind: "stopped", tone: "info", message: "Off." });
  });
  it("gateway-ish statuses are NOT clear refusals: 0, 408, 429, 500, 502, 504 are uncertain", () => {
    for (const s of [0, 408, 429, 500, 502, 504]) expect(startOutcome(no(s)).kind).toBe("uncertain");
  });
  it("400/401/403/404/422 are clear refusals", () => {
    for (const s of [400, 401, 403, 404, 422]) expect(startOutcome(no(s)).kind).toBe("stopped");
  });
  it("WooCommerce reads the store's own words and its own date sentence, once", () => {
    const date = "This price has been on for fewer than 28 days, so a sale price would show a 'was' price that is not genuine yet. We will offer it again after 3 December 2026.";
    const o = startOutcome(started(4, 4, [{ status: "refused", message: date }, { status: "refused", message: date }, { status: "applied" }]), "woocommerce");
    expect(o.message).toContain("WooCommerce or a safety check refused");
    expect(o.message).not.toContain("Shopify");
    expect(o.message.split(date)).toHaveLength(2);
    const none = startOutcome(started(0, 0, [{ status: "refused", message: date }]), "woocommerce");
    expect(none.kind).toBe("stopped");
    expect(none.message).toContain(date);
  });
});

const row = (over: Partial<TestRow> = {}): TestRow => ({ campaignId: "c1", rootCampaignId: "c1", parentCampaignId: null, step: 1, depthPct: 10, status: "active", daysRunning: 3, cohortSize: 8, holdoutSize: 8, decision: "running", decisionReason: null, ...over });

describe("acceptTests", () => {
  it("null when the answer is not a list (an older api or a failed read), a defensive list otherwise", () => {
    expect(acceptTests(undefined)).toBeNull();
    expect(acceptTests({ tests: "x" })).toBeNull();
    const l = acceptTests({ tests: [{ campaignId: "a", step: 2, decision: "extend", decisionReason: "Sold twice as fast.", daysRunning: 9, cohortSize: 8 }, { nope: 1 }, { campaignId: "b", rootCampaignId: "a", parentCampaignId: "a" }] })!;
    expect(l.map((t) => t.campaignId)).toEqual(["a", "b"]);
    expect(l[0]).toMatchObject({ rootCampaignId: "a", step: 2, holdoutSize: 0, status: "unknown" });
    expect(l[1]).toMatchObject({ parentCampaignId: "a", step: 1, decision: "running" });
  });
});

describe("chainsOf", () => {
  it("groups by root, oldest step first, running chains before ended ones", () => {
    const chains = chainsOf([
      row({ campaignId: "e2", rootCampaignId: "e1", step: 2, status: "ended" }),
      row({ campaignId: "e1", rootCampaignId: "e1", step: 1, status: "ended" }),
      row({ campaignId: "r1", rootCampaignId: "r1", step: 1, status: "active" }),
    ]);
    expect(chains.map((c) => c.rootId)).toEqual(["r1", "e1"]);
    expect(chains[1]!.tests.map((t) => t.step)).toEqual([1, 2]);
    expect(chains[0]!.running).toBe(true);
    expect(chains[1]!.running).toBe(false);
  });
  it("a chain with an ended step and a running one is running", () => {
    const c = chainsOf([row({ campaignId: "a", rootCampaignId: "a", step: 1, status: "ended" }), row({ campaignId: "b", rootCampaignId: "a", step: 2 })]);
    expect(c).toHaveLength(1);
    expect(c[0]!.running).toBe(true);
  });
});

describe("decisions", () => {
  it("every verdict has plain words; an unknown one is shown by its key", () => {
    expect(decisionWords(row({ decision: "extend" })).label).toBe("Worked: widening");
    expect(decisionWords(row({ decision: "step" })).tone).toBe("caution");
    expect(decisionWords(row({ decision: "stop", status: "ended" })).label).toBe("Stopped");
    expect(decisionWords(row({ decision: "brand_new" })).label).toBe("brand new");
  });
  it("an ended step that still says running is Ended, not Running; unknown status stays Running", () => {
    expect(decisionWords(row({ decision: "running", status: "completed" })).label).toBe("Ended");
    expect(decisionWords(row({ decision: "running", status: "active" })).label).toBe("Running");
    expect(decisionWords(row({ decision: "running", status: "unknown" })).label).toBe("Running");
  });
  it("testLine counts days from one while running, and says what ran when ended", () => {
    expect(testLine(row({ daysRunning: 0 }))).toBe("day 1, 8 products on markdown, 8 similar products left at full price to compare");
    expect(testLine(row({ status: "ended", daysRunning: 1, cohortSize: 1, holdoutSize: 0 }))).toBe("ran 1 day, 1 product on markdown, no similar products left at full price to compare");
    expect(testLine(row({ daysRunning: null }))).toMatch(/^8 products/);
  });
  it("decisionLine is the api's reason, or the waiting sentence only while running", () => {
    expect(decisionLine(row({ decisionReason: "Sold 2x." }))).toBe("Sold 2x.");
    expect(decisionLine(row())).toContain("after the first week");
    expect(decisionLine(row({ status: "ended" }))).toBe("");
  });
});
