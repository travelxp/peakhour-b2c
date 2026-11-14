import type { DraftOffer, Figure, GoalCampaignView, HomeGoal, MandateGoalView, MandatePatch, MandateTarget, MandateView, OutcomeKind } from "@/lib/api/growth-v2";
import { GOAL_MAX, offerKey, parseAmount, targetKindOf } from "@/lib/growth-v2-firstrun";
import { OUTCOME_UNIT, unitFor } from "@/lib/growth-v2-figure";

/**
 * The Goals page (PL-3): every goal of the plan, with Add, Edit and End, and which goal each campaign serves.
 *
 * ★PURE, SO IT CAN BE TESTED WITHOUT A BROWSER. Each action is one `PATCH /rules` `mandate` body built here; the api turns it
 * into a change the merchant confirms with the WhatsApp link and code, exactly as every plan change is confirmed.
 * ★A CHANGE NAMES ONLY WHAT CHANGED. Editing one goal's target sends that goal's id and target, nothing else, so no other goal
 * and no split is touched. A changed share, an added goal and an ended goal send the whole split of the active goals, because
 * the shares must add up to 100% and the merchant sees and confirms the rebalanced numbers in the form first.
 * ★A SUGGESTED GOAL FOR A CAMPAIGN IS ONLY PRE-SELECTED. It is sent only when the merchant saves, as any other pick is.
 */

/** A share as a whole-ish percentage (one decimal at most). */
export const pctOf = (share: number) => Math.round(share * 1000) / 10;

/** The goals that spend: active ones, in the plan's order. */
export const activeGoals = (m: Pick<MandateView, "goals">) => m.goals.filter((g) => g.status === "active");

/**
 * The split after some goals' percentages are fixed (`fixed`): every other goal in `goals` shares what is left in proportion to
 * its current share (evenly when they all hold none), in whole percentages, the remainder of rounding to the largest first.
 * The result always adds up to 100 when the fixed ones are at most 100.
 */
export function rebalance(goals: ReadonlyArray<Pick<MandateGoalView, "goalId" | "share">>, fixed: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  let left = 100;
  for (const [id, pct] of Object.entries(fixed)) {
    out[id] = pct;
    left -= pct;
  }
  const rest = goals.filter((g) => !(g.goalId in fixed));
  if (rest.length === 0) return out;
  left = Math.max(0, left);
  // Whole percentages share the whole part of what is left; a typed decimal's fraction (33.3% leaves 66.7) goes to the first of the
  // largest, so the split still adds up to exactly 100 (the api allows 0.001 of slack).
  const wholeLeft = Math.floor(left + 1e-9);
  const total = rest.reduce((t, g) => t + g.share, 0);
  const raw = rest.map((g) => (total > 0 ? (g.share / total) * wholeLeft : wholeLeft / rest.length));
  const whole = raw.map((r) => Math.floor(r + 1e-9));
  const order = raw.map((r, i) => ({ i, rest: r - Math.floor(r + 1e-9) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  let spare = wholeLeft - whole.reduce((a, b) => a + b, 0);
  for (let k = 0; spare > 0; k++, spare--) whole[order[k % order.length]!.i]! += 1;
  const largest = whole.indexOf(Math.max(...whole));
  whole[largest] = Math.round((whole[largest]! + left - wholeLeft) * 10) / 10;
  rest.forEach((g, i) => (out[g.goalId] = whole[i]!));
  return out;
}

/** Percentages to the api's fractions. */
const fractions = (pcts: Record<string, number>) => Object.fromEntries(Object.entries(pcts).map(([id, p]) => [id, Math.round(p * 10) / 1000]));

/** A typed percentage, 0 to 100 with at most one decimal (what the api's 0.001 of slack can carry), or undefined. */
export function parsePct(text: string): number | undefined {
  const t = text.trim();
  if (!/^\d+(\.\d)?$/.test(t)) return undefined;
  const n = Number(t);
  return n <= 100 ? n : undefined;
}

export interface GoalEditForm {
  target: string;
  share: string;
}

export const editFormOf = (g: MandateGoalView): GoalEditForm => ({ target: String(g.target.value), share: String(pctOf(g.share)) });

/**
 * Edit: a goal's target or share. Only what changed is sent: a target alone is `{ goalId, target }`, and a share sends the new
 * split of every active goal (the others rebalanced, as the form shows). Undefined when nothing changed.
 */
export function editGoalPatch(m: Pick<MandateView, "goals">, goal: MandateGoalView, form: GoalEditForm): MandatePatch | { error: string } | undefined {
  const typed = parseAmount(form.target);
  if (typed === undefined) return { error: goal.target.kind === "roas" ? "Enter the return you need, above zero." : "Enter a target cost above zero." };
  const pct = parsePct(form.share);
  if (pct === undefined) return { error: "Enter the goal's share as a percentage from 0 to 100." };
  const patch: MandatePatch = {};
  if (typed !== goal.target.value) {
    patch.goalId = goal.goalId;
    patch.target = { kind: goal.target.kind, value: typed };
  }
  const active = activeGoals(m);
  if (goal.status === "active" && pct !== pctOf(goal.share)) {
    if (active.length === 1) return { error: "This is your only active goal, so it has all of the ceiling." };
    // an active goal with no share spends nothing, and one with all of it leaves the others none: end a goal instead
    if (pct <= 0 || pct >= 100) return { error: "Give this goal a share between 0% and 100%. To stop a goal spending, end it." };
    patch.shares = fractions(rebalance(active, { [goal.goalId]: pct }));
  }
  return Object.keys(patch).length === 0 ? undefined : patch;
}

export interface GoalAddForm {
  /** The line it serves; "" for none (a playbook with no lines). */
  lineId: string;
  /** `offerKey` of the outcome. */
  offer: string;
  /** Empty = the playbook's default for that outcome. */
  target: string;
  share: string;
}

/** Add goal: the new goal with its share, and the other active goals rebalanced (`rebalance`) so the split adds up. */
export function addGoalPatch(m: Pick<MandateView, "goals">, form: GoalAddForm, offers: readonly DraftOffer[]): MandatePatch | { error: string } {
  if (m.goals.length >= GOAL_MAX) return { error: `A plan holds at most ${GOAL_MAX} goals, including ended ones.` };
  const offer = offers.find((o) => offerKey(o) === form.offer);
  if (!offer) return { error: "Choose what this goal should get you more of." };
  const pct = parsePct(form.share);
  if (pct === undefined || pct === 0) return { error: "Enter the new goal's share as a percentage above 0." };
  const active = activeGoals(m);
  if (pct > 100 || (pct === 100 && active.length > 0)) return { error: "Leave some of the ceiling for your other goals, or end them first." };
  if (active.length === 0 && pct !== 100) return { error: "With no other active goal, the new goal holds all of the ceiling: enter 100%." };
  let target: MandateTarget | undefined;
  if (form.target.trim() !== "") {
    const typed = parseAmount(form.target);
    if (typed === undefined) return { error: "Enter a target above zero, or leave it empty for the playbook's." };
    target = { kind: targetKindOf(offer), value: typed };
  } else if (!offer.defaultTarget) return { error: "This outcome has no playbook target. Enter one." };
  const shares = active.length > 0 ? fractions(rebalance(active, { [NEW]: pct })) : {};
  delete shares[NEW];
  return {
    add: {
      ...(form.lineId ? { lineId: form.lineId } : {}),
      outcome: { kind: offer.kind, source: offer.source, optimizeFor: offer.optimizeFor },
      share: Math.round(pct * 10) / 1000,
      ...(target ? { target, targetSource: "merchant" as const } : {}),
    },
    ...(Object.keys(shares).length > 0 ? { shares } : {}),
  };
}
/** The key the goal being added holds in a rebalance; never a goal id (ids are lower case and digits). */
const NEW = "\u0000new";

/** The split the Add form shows for the other goals when the new one takes `pct`. */
export function sharesAfterAdd(m: Pick<MandateView, "goals">, pct: number | undefined): Record<string, number> {
  const active = activeGoals(m);
  if (pct === undefined || active.length === 0) return Object.fromEntries(active.map((g) => [g.goalId, pctOf(g.share)]));
  const out = rebalance(active, { [NEW]: pct });
  delete out[NEW];
  return out;
}

/** End: the goal becomes done, and the active goals left share the ceiling in proportion (one left holds all of it). */
export function endGoalPatch(m: Pick<MandateView, "goals">, goal: MandateGoalView): MandatePatch | { error: string } {
  const rest = activeGoals(m).filter((g) => g.goalId !== goal.goalId);
  if (goal.status === "active" && rest.length === 0) return { error: "This is your only active goal. Add another before ending it." };
  return { end: [goal.goalId], ...(goal.status === "active" ? { shares: fractions(rebalance(rest, {})) } : {}) };
}

/** The goal a campaign is pre-selected for: its goal (named, the trail's or the only one), else its suggestion, else none. */
export function preselected(c: GoalCampaignView): string {
  return c.goalId ?? c.suggested?.goalId ?? "";
}

/** The goal that names the campaign among its `campaignIds` (the merchant's own answer), or "". */
export function namedGoal(m: Pick<MandateView, "goals">, campaignId: string): string {
  return m.goals.find((g) => g.campaignIds?.includes(campaignId))?.goalId ?? "";
}

/**
 * Save the campaigns: every campaign whose chosen goal differs from the goal that names it now. A pre-selected goal (the trail's,
 * or a suggestion) that the merchant saves becomes the campaign's named goal; "" gives it to none. Undefined when nothing differs.
 */
export function assignPatch(m: Pick<MandateView, "goals">, campaigns: readonly GoalCampaignView[], picks: Record<string, string>): MandatePatch | undefined {
  const assign: NonNullable<MandatePatch["assign"]> = [];
  for (const c of campaigns) {
    const chosen = picks[c.campaignId] ?? preselected(c);
    if (chosen === namedGoal(m, c.campaignId)) continue;
    // the plan's one active goal owns it already: nothing to save, and naming it would pin it there when a goal is added
    if (c.how === "only" && chosen === c.goalId) continue;
    assign.push(chosen === "" ? { campaignId: c.campaignId } : { campaignId: c.campaignId, goalId: chosen });
  }
  return assign.length > 0 ? { assign } : undefined;
}

/** The unit a figure for `goalId` is counted in: that goal's outcome, else the plan's primary goal's (PL-3). */
export function goalUnit(m: Pick<MandateView, "goals" | "outcome"> | undefined, goalId: string | undefined): { one: string; many: string } {
  const g = goalId === undefined ? undefined : m?.goals.find((x) => x.goalId === goalId);
  return unitFor((g?.outcome.kind ?? m?.outcome.kind) as OutcomeKind | undefined);
}

/** A goal's results this month, from Home (absent for a done goal, which Home does not list). */
export function resultOf(items: readonly HomeGoal[] | undefined, goalId: string): Figure | undefined {
  return items?.find((i) => i.goalId === goalId)?.soFar;
}

export const STATUS_WORD: Record<MandateGoalView["status"], string> = { active: "Active", scheduled: "Scheduled", done: "Ended" };

/** What a goal counts, in the merchant's words. */
export const countsWhat = (g: Pick<MandateGoalView, "outcome">) => g.outcome.focus?.label ?? OUTCOME_UNIT[g.outcome.kind].many;
