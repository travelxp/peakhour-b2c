import { describe, expect, it } from "vitest";
import type { DraftOffer, GoalCampaignView, MandateGoalView, MandateView } from "@/lib/api/growth-v2";
import { FIXTURE_RULES } from "@/lib/growth-v2-fixtures";
import { activeGoals, addGoalPatch, assignPatch, editFormOf, editGoalPatch, endGoalPatch, goalUnit, preselected, rebalance, sharesAfterAdd } from "./growth-v2-goals";

/**
 * PL-3: the Goals page's actions, each one `PATCH /rules` body.
 *
 * ★WHAT ONLY THESE TESTS CAN GET WRONG: that editing one goal's target names that goal and nothing else (no split, no other goal,
 * so nothing else is left pending); that every action that moves a share sends a split adding up to 1; that ending the
 * second-to-last goal leaves the last at all of the ceiling; and that a campaign's suggested goal is sent only as the save's pick.
 */

const goal = (goalId: string, share: number, over: Partial<MandateGoalView> = {}): MandateGoalView => ({
  goalId,
  label: goalId[0]!.toUpperCase() + goalId.slice(1),
  lineId: goalId,
  outcome: { kind: "bookings", source: "orders", optimizeFor: "count" },
  share,
  monthlyBudget: share * 50000,
  target: { kind: "cost_per_outcome", value: 800 },
  targetSource: "playbook",
  status: "active",
  ...over,
});
const plan = (goals: MandateGoalView[]): MandateView => ({ ...FIXTURE_RULES.mandate!, goals, monthlyCeiling: 50000 });
const sum = (shares: Record<string, number> | undefined) => Object.values(shares ?? {}).reduce((a, b) => a + b, 0);

describe("Edit: a goal's target or share", () => {
  const flights = goal("flights", 0.6);
  const hotels = goal("hotels", 0.4);
  const m = plan([flights, hotels]);

  it("★editing one goal's target sends that goalId and target only: no other goal, no split", () => {
    expect(editGoalPatch(m, flights, { ...editFormOf(flights), target: "650" })).toEqual({ goalId: "flights", target: { kind: "cost_per_outcome", value: 650 } });
  });
  it("PASS: nothing changed is nothing to send", () => {
    expect(editGoalPatch(m, flights, editFormOf(flights))).toBeUndefined();
  });
  it("★a share moved sends the whole split of the active goals, the others rebalanced, adding up to 1", () => {
    const p = editGoalPatch(m, flights, { ...editFormOf(flights), share: "75" });
    expect(p).toEqual({ shares: { flights: 0.75, hotels: 0.25 } });
    expect(sum((p as { shares: Record<string, number> }).shares)).toBeCloseTo(1, 9);
  });
  it("FAIL: an unreadable target or share; moving the share of the only active goal", () => {
    expect(editGoalPatch(m, flights, { ...editFormOf(flights), target: "" })).toHaveProperty("error");
    expect(editGoalPatch(m, flights, { ...editFormOf(flights), share: "120" })).toHaveProperty("error");
    const solo = goal("main", 1);
    expect(editGoalPatch(plan([solo]), solo, { ...editFormOf(solo), share: "50" })).toHaveProperty("error");
  });
  it("a roas goal keeps its kind", () => {
    const value = goal("sales", 1, { outcome: { kind: "sales", source: "orders", optimizeFor: "value" }, target: { kind: "roas", value: 3 } });
    expect(editGoalPatch(plan([value]), value, { ...editFormOf(value), target: "4" })).toEqual({ goalId: "sales", target: { kind: "roas", value: 4 } });
  });
});

describe("Add goal: the others rebalance in the form, and the saved split adds up", () => {
  const LEADS: DraftOffer = { kind: "leads", source: "win_definition", optimizeFor: "count", label: "Leads", focusSuggestions: [], defaultTarget: { kind: "cost_per_outcome", value: 300, low: 100, high: 900, currency: "INR" }, targetSource: "playbook" };
  const m = plan([goal("flights", 0.6), goal("hotels", 0.4), goal("old", 0, { status: "done" })]);

  it("★the new goal's share plus the rebalanced others is 1; the form shows the same numbers", () => {
    const p = addGoalPatch(m, { lineId: "holidays", offer: "leads:win_definition", target: "", share: "20" }, [LEADS]);
    expect(p).toEqual({
      add: { lineId: "holidays", outcome: { kind: "leads", source: "win_definition", optimizeFor: "count" }, share: 0.2 },
      shares: { flights: 0.48, hotels: 0.32 },
    });
    const { add, shares } = p as { add: { share: number }; shares: Record<string, number> };
    expect(add.share + sum(shares)).toBeCloseTo(1, 9);
    expect(sharesAfterAdd(m, 20)).toEqual({ flights: 48, hotels: 32 });
  });
  it("a typed target is the merchant's; an empty one takes the playbook's", () => {
    const p = addGoalPatch(m, { lineId: "", offer: "leads:win_definition", target: "250", share: "10" }, [LEADS]) as unknown as { add: Record<string, unknown> };
    expect(p.add).toMatchObject({ target: { kind: "cost_per_outcome", value: 250 }, targetSource: "merchant" });
    expect(p.add).not.toHaveProperty("lineId");
  });
  it("FAIL: no outcome; a share of 0 or all of it beside other goals; an outcome with no playbook target left empty; a seventh goal", () => {
    expect(addGoalPatch(m, { lineId: "", offer: "", target: "", share: "20" }, [LEADS])).toHaveProperty("error");
    expect(addGoalPatch(m, { lineId: "", offer: "leads:win_definition", target: "", share: "0" }, [LEADS])).toHaveProperty("error");
    expect(addGoalPatch(m, { lineId: "", offer: "leads:win_definition", target: "", share: "100" }, [LEADS])).toHaveProperty("error");
    expect(addGoalPatch(m, { lineId: "", offer: "leads:win_definition", target: "", share: "20" }, [{ ...LEADS, defaultTarget: undefined }])).toHaveProperty("error");
    const six = plan(["a", "b", "c", "d", "e", "f"].map((id) => goal(id, 1 / 6)));
    expect(addGoalPatch(six, { lineId: "", offer: "leads:win_definition", target: "", share: "10" }, [LEADS])).toHaveProperty("error");
  });
});

describe("End", () => {
  it("★ending the second-to-last goal leaves the last one at share 1", () => {
    const flights = goal("flights", 0.6);
    expect(endGoalPatch(plan([flights, goal("hotels", 0.4)]), flights)).toEqual({ end: ["flights"], shares: { hotels: 1 } });
  });
  it("ending one of three rebalances the other two in proportion, adding up to 1", () => {
    const a = goal("a", 0.5);
    const p = endGoalPatch(plan([a, goal("b", 0.3), goal("c", 0.2)]), a) as { shares: Record<string, number> };
    expect(p.shares).toEqual({ b: 0.6, c: 0.4 });
  });
  it("FAIL: the only active goal cannot end; a scheduled goal ends without moving the split", () => {
    const solo = goal("main", 1);
    expect(endGoalPatch(plan([solo]), solo)).toHaveProperty("error");
    const later = goal("later", 0, { status: "scheduled" });
    expect(endGoalPatch(plan([goal("main", 1), later]), later)).toEqual({ end: ["later"] });
  });
});

describe("rebalance", () => {
  it("in proportion to the current shares, whole percentages adding up to 100", () => {
    expect(rebalance([goal("a", 0.5), goal("b", 0.25), goal("c", 0.25)], { a: 40 })).toEqual({ a: 40, b: 30, c: 30 });
    expect(rebalance([goal("a", 1 / 3), goal("b", 1 / 3), goal("c", 1 / 3)], {})).toEqual({ a: 34, b: 33, c: 33 });
    expect(rebalance([goal("a", 0), goal("b", 0)], {})).toEqual({ a: 50, b: 50 });
  });
  it("★a typed decimal still adds up to exactly 100 (the api allows 0.001 of slack)", () => {
    const three = [goal("a", 1 / 3), goal("b", 1 / 3), goal("c", 1 / 3)];
    for (const pct of [33.3, 66.4, 12.5, 0.1]) {
      const r = rebalance(three, { a: pct });
      expect(Object.values(r).reduce((x, y) => x + y, 0), String(pct)).toBeCloseTo(100, 9);
    }
    expect(rebalance(three, { a: 33.3 })).toEqual({ a: 33.3, b: 33.7, c: 33 });
    const p = editGoalPatch(plan(three), three[0]!, { ...editFormOf(three[0]!), share: "30.5" }) as { shares: Record<string, number> };
    expect(Math.abs(sum(p.shares) - 1)).toBeLessThanOrEqual(1e-9);
  });
  it("with no other active goal, a new goal must hold all of the ceiling", () => {
    const LEADS: DraftOffer = { kind: "leads", source: "win_definition", optimizeFor: "count", label: "Leads", focusSuggestions: [], defaultTarget: { kind: "cost_per_outcome", value: 300, low: 100, high: 900, currency: "INR" }, targetSource: "playbook" };
    const later = plan([goal("later", 0, { status: "scheduled" })]);
    expect(addGoalPatch(later, { lineId: "", offer: "leads:win_definition", target: "", share: "40" }, [LEADS])).toHaveProperty("error");
    expect(addGoalPatch(later, { lineId: "", offer: "leads:win_definition", target: "", share: "100" }, [LEADS])).toMatchObject({ add: { share: 1 } });
  });
});

describe("campaigns: which goal each serves", () => {
  const m = plan([goal("flights", 0.6, { campaignIds: ["meta:1"] }), goal("hotels", 0.4)]);
  const c = (campaignId: string, over: Partial<GoalCampaignView> = {}): GoalCampaignView => ({ campaignId, platform: "meta", name: campaignId, status: "active", how: "unknown", ...over });
  const campaigns = [c("meta:1", { goalId: "flights", how: "assigned" }), c("meta:2", { suggested: { goalId: "hotels", why: "" } }), c("meta:3"), c("meta:4", { goalId: "hotels", how: "trail" })];

  it("pre-selects the campaign's goal, else its suggestion, else none", () => {
    expect(campaigns.map(preselected)).toEqual(["flights", "hotels", "", "hotels"]);
    // a campaign the trail gives a goal keeps that goal even when its words suggest another
    expect(preselected(c("meta:5", { goalId: "flights", how: "trail", suggested: { goalId: "hotels", why: "" } }))).toBe("flights");
  });
  it("★saving sends only what differs from the goal that names it now: a kept suggestion or trail goal becomes named, a named one moved, none for none", () => {
    expect(assignPatch(m, campaigns, {})).toEqual({ assign: [{ campaignId: "meta:2", goalId: "hotels" }, { campaignId: "meta:4", goalId: "hotels" }] });
    expect(assignPatch(m, campaigns, { "meta:1": "hotels", "meta:2": "", "meta:4": "" })).toEqual({ assign: [{ campaignId: "meta:1", goalId: "hotels" }] });
    expect(assignPatch(m, campaigns, { "meta:1": "" , "meta:2": "", "meta:4": "" })).toEqual({ assign: [{ campaignId: "meta:1" }] });
    expect(assignPatch(m, [campaigns[0]!, campaigns[2]!], {})).toBeUndefined();
  });
});

describe("per-goal units", () => {
  it("a decision's own goal, else the plan's primary goal", () => {
    const m = plan([goal("flights", 0.6), goal("leads", 0.4, { outcome: { kind: "leads", source: "win_definition", optimizeFor: "count" } })]);
    expect(goalUnit({ ...m, outcome: m.goals[0]!.outcome }, "leads")).toEqual({ one: "lead", many: "leads" });
    expect(goalUnit({ ...m, outcome: m.goals[0]!.outcome }, undefined).one).toBe("booking");
    expect(goalUnit({ ...m, outcome: m.goals[0]!.outcome }, "gone").one).toBe("booking");
    expect(activeGoals(m)).toHaveLength(2);
  });
});
