import { ApiError } from "@/lib/api";
import type { ConfirmGoal, ConfirmPlanBody, DraftLine, DraftOffer, FirstRunDraftResponse, MandateOutcome, MandateTarget } from "@/lib/api/growth-v2";

/**
 * First run (plan 1, row H5): turning the merchant's three answers and the drafted plan into the plan that is sent to
 * WhatsApp, and saying why it cannot be sent yet.
 *
 * ★PURE, SO IT CAN BE TESTED WITHOUT A BROWSER. The screen renders what these return; whether "Send to WhatsApp to confirm"
 * is on is decided here from the api's own draft (`planBlockedReason`), never inside JSX.
 * ★ONLY OFFERED OUTCOMES ARE EVER CHOSEN FROM: `selectedOffer` reads the draft's `offers`, which the api builds from the
 * business's own evidence. There is no fixed list of five kinds here.
 * ★A TYPED NUMBER IS TEXT UNTIL IT IS PARSED. An empty or unreadable box is "no answer", never 0.
 * ★PL-3: "WHAT DO YOU SELL?" COMES FIRST when the playbook has lines (`draft.lines`): one goal per ticked line, each with its own
 * outcome and target, and the ceiling split between them (`suggestedShares`). A playbook with no lines asks for one goal, as
 * before, and sends it as a plan of one goal with all of the ceiling.
 */

/** The most goals a plan holds (the api's GOAL_MAX). */
export const GOAL_MAX = 6;

/** One goal's answers, per ticked line: the same three as a one-goal plan's. */
export interface GoalAnswers {
  offer?: string;
  focus?: string;
  target?: string;
}

export interface FirstRunAnswers {
  /** `offerKey` of the chosen outcome; the first offer when absent or no longer offered. */
  offer?: string;
  /** The label of the chosen focus suggestion; absent or empty = every outcome of the kind counts. */
  focus?: string;
  /** The monthly ceiling as typed. */
  ceiling: string;
  /**
   * The target as typed. ABSENT = the merchant has not touched the box, so the playbook's default stands. An empty or unreadable
   * box is NOT absent: it is a cleared answer, and the plan is not sent until a target is entered.
   */
  target?: string;
  /** PL-3: the ticked lines' ids. ABSENT = the draft's own pre-ticks (`matched`). */
  lines?: string[];
  /** PL-3: each ticked line's goal. */
  goals?: Record<string, GoalAnswers>;
  /** PL-3: each ticked line's share of the ceiling, as a typed percentage. ABSENT = the suggested split. */
  shares?: Record<string, string>;
  /** PL-3: which line's goal each campaign serves ("" for none). A campaign not named takes its suggested line, when ticked. */
  campaigns?: Record<string, string>;
}

export const EMPTY_ANSWERS: FirstRunAnswers = { ceiling: "" };

/** The lines the plan has a goal for: the ones ticked, else the ones the draft pre-ticked. [] for a playbook with no lines. */
export function chosenLines(draft: FirstRunDraftResponse, answers: Pick<FirstRunAnswers, "lines">): DraftLine[] {
  const lines = draft.lines ?? [];
  const ticked = answers.lines ?? lines.filter((l) => l.matched).map((l) => l.id);
  return lines.filter((l) => ticked.includes(l.id));
}

/**
 * The suggested split of the ceiling between the chosen lines, as whole percentages that add up to 100: in proportion to each
 * line's minimum budget when every chosen line has one, else even. The remainder of rounding goes to the largest shares first.
 */
export function suggestedShares(lines: ReadonlyArray<Pick<DraftLine, "id" | "minMonthlyBudget">>): Record<string, number> {
  if (lines.length === 0) return {};
  const weights = lines.every((l) => (l.minMonthlyBudget ?? 0) > 0) ? lines.map((l) => l.minMonthlyBudget!) : lines.map(() => 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / total) * 100);
  const out = raw.map(Math.floor);
  const order = raw.map((r, i) => ({ i, rest: r - Math.floor(r) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (let k = 0, left = 100 - out.reduce((a, b) => a + b, 0); left > 0; k++, left--) out[order[k % order.length]!.i]! += 1;
  return Object.fromEntries(lines.map((l, i) => [l.id, out[i]!]));
}

/** Each chosen line's share as a whole percentage: what was typed, else the suggestion. A box that cannot be read is undefined. */
export function lineShares(draft: FirstRunDraftResponse, answers: FirstRunAnswers): Record<string, number | undefined> {
  const lines = chosenLines(draft, answers);
  const suggested = suggestedShares(lines);
  return Object.fromEntries(
    lines.map((l) => {
      const typed = answers.shares?.[l.id];
      if (typed === undefined) return [l.id, suggested[l.id]];
      const t = typed.trim();
      return [l.id, /^\d+(\.\d+)?$/.test(t) && Number(t) <= 100 ? Number(t) : undefined];
    }),
  );
}

/** The goal answers of one line, as the one-goal helpers read them. */
const asAnswers = (answers: FirstRunAnswers, lineId: string): FirstRunAnswers => ({ ceiling: answers.ceiling, ...(answers.goals?.[lineId] ?? {}) });

/** The outcome a line's goal counts: the one chosen, else the line's first offer. */
export function lineOffer(line: DraftLine, answers: FirstRunAnswers): DraftOffer | undefined {
  const a = answers.goals?.[line.id];
  return line.offers.find((o) => offerKey(o) === a?.offer) ?? line.offers[0];
}

/** A line goal's target: what was typed, else the line's own playbook default. */
export function lineTarget(line: DraftLine, answers: FirstRunAnswers): ResolvedTarget | undefined {
  return resolveTarget(lineOffer(line, answers), asAnswers(answers, line.id));
}

/** The line a campaign is given at the end of First run: the merchant's pick, else its suggestion when that line is chosen, else none. */
export function campaignLine(draft: FirstRunDraftResponse, answers: FirstRunAnswers, campaignId: string): string {
  const picked = answers.campaigns?.[campaignId];
  const chosen = new Set(chosenLines(draft, answers).map((l) => l.id));
  if (picked !== undefined) return chosen.has(picked) ? picked : "";
  const c = (draft.campaigns ?? []).find((x) => x.campaignId === campaignId);
  return c?.suggestedLineId !== undefined && chosen.has(c.suggestedLineId) ? c.suggestedLineId : "";
}

/** Whether First run ends by giving campaigns to goals: only a plan of several goals with campaigns to give. */
export function asksForCampaigns(draft: FirstRunDraftResponse, answers: FirstRunAnswers): boolean {
  return chosenLines(draft, answers).length > 1 && (draft.campaigns ?? []).length > 0;
}

export const offerKey = (o: { kind: string; source: string }) => `${o.kind}:${o.source}`;

export function selectedOffer(draft: FirstRunDraftResponse, answers: FirstRunAnswers): DraftOffer | undefined {
  return draft.offers.find((o) => offerKey(o) === answers.offer) ?? draft.offers[0];
}

export function selectedFocus(offer: DraftOffer | undefined, answers: FirstRunAnswers): DraftOffer["focusSuggestions"][number] | undefined {
  // A focus is taken from orders only (plan 2.1); a win-definition or ads-conversion outcome has none to pick.
  if (!offer || offer.source !== "orders" || !answers.focus) return undefined;
  return offer.focusSuggestions.find((f) => f.label === answers.focus);
}

/**
 * A positive number from what was typed (commas allowed), or undefined. Never 0 for "nothing typed".
 * ★DECIMAL DIGITS ONLY: `Number()` would read "1e6" as a million and "0x1F" as 31, in a box the merchant types a budget into.
 */
export function parseAmount(text: string): number | undefined {
  const t = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** The kind of target an outcome is measured by: a return for value, a cost for a count (plan 2.1). */
export const targetKindOf = (offer: Pick<DraftOffer, "optimizeFor">): MandateTarget["kind"] => (offer.optimizeFor === "value" ? "roas" : "cost_per_outcome");

export interface ResolvedTarget {
  target: MandateTarget;
  source: "playbook" | "merchant";
}

/**
 * The merchant's own number wins; an untouched box takes the playbook's default of the right kind; else none (the merchant
 * must name one). ★A CLEARED OR UNREADABLE BOX IS NOT AN UNTOUCHED ONE: it resolves to nothing, so the plan is never sent with
 * a target the merchant cannot see.
 */
export function resolveTarget(offer: DraftOffer | undefined, answers: FirstRunAnswers): ResolvedTarget | undefined {
  if (!offer) return undefined;
  const kind = targetKindOf(offer);
  if (answers.target !== undefined) {
    const typed = parseAmount(answers.target);
    return typed === undefined ? undefined : { target: { kind, value: typed }, source: "merchant" };
  }
  const d = offer.defaultTarget;
  if (d && d.kind === kind) return { target: { kind, value: d.value }, source: "playbook" };
  return undefined;
}

/** The three ceiling suggestions, with the words the screen puts on them. */
export function ceilingChips(draft: FirstRunDraftResponse): Array<{ key: "starter" | "steady" | "growth"; label: string; amount: number }> {
  if ("absent" in draft.ceilingBands) return [];
  const label = { starter: "Starter", steady: "Steady", growth: "Growth" } as const;
  return draft.ceilingBands.bands.map((b) => ({ key: b.key, label: label[b.key], amount: b.amount }));
}

/**
 * The third question, in the merchant's words. The answer is the TARGET the engine steers bids to (the cost cap of a campaign is
 * the mandate's cost per outcome), so it is asked as money spent on ads. It is not a Peakhour charge: Growth is charged AI
 * credits per task the merchant asks for, never per result (owner, 2026-11-04), and the sentence under the box says so.
 */
export function targetQuestion(kind: MandateTarget["kind"], unitOne: string): string {
  return kind === "roas" ? "What return do you need on your ad spend?" : `What is the most you want to spend on ads to get one ${unitOne}?`;
}

/** The line beside the target box: what the number does, and that it is not a fee. */
export const TARGET_NOT_A_FEE = "The engine aims to spend no more than this on ads for each one. It is not a Peakhour charge.";

const SPEND_PER_OUTCOME = "the most you want to spend on ads per outcome";

/** Why the plan cannot be sent yet, in the merchant's words, or undefined when it can. Signal is the api's own `complete`. */
export function planBlockedReason(draft: FirstRunDraftResponse | undefined, answers: FirstRunAnswers, signalDone: boolean): string | undefined {
  if (!draft) return "Your plan is still loading.";
  if (draft.alreadyActive) return "The engine is already on for this business. Change the plan from Goals.";
  if (draft.tie) return "Tell us which description fits you best first.";
  if (!draft.playbook) return "There is no playbook for this business yet, so there is no plan to send.";
  if ((draft.lines ?? []).length > 0) return linesBlockedReason(draft, answers, signalDone);
  const offer = selectedOffer(draft, answers);
  if (!offer) return "Nothing can be measured for this business yet. Connect your shop, your inbox or your analytics first.";
  if (!draft.currency) return "We could not tell which currency your plan is in. Connect an ad account first.";
  if ("absent" in draft.timeZone) return "Set your time zone first: your ceiling is counted by the month on that clock.";
  if (parseAmount(answers.ceiling) === undefined) return "Enter your monthly ceiling.";
  if (!resolveTarget(offer, answers)) {
    return answers.target !== undefined
      ? `Enter ${offer.optimizeFor === "value" ? "the return you need" : SPEND_PER_OUTCOME}: the target box is empty.`
      : `Enter ${offer.optimizeFor === "value" ? "the return you need" : SPEND_PER_OUTCOME}: this outcome has no playbook default.`;
  }
  if (!signalDone) return "Finish step 4 first: switch on your signal, or accept running without one.";
  return undefined;
}

/** Why a plan of one goal per line cannot be sent yet (PL-3). */
function linesBlockedReason(draft: FirstRunDraftResponse, answers: FirstRunAnswers, signalDone: boolean): string | undefined {
  const lines = chosenLines(draft, answers);
  if (lines.length === 0) return "Tick at least one thing you sell.";
  if (lines.length > GOAL_MAX) return `A plan holds at most ${GOAL_MAX} goals. Untick ${lines.length - GOAL_MAX}.`;
  const noOffer = lines.find((l) => !lineOffer(l, answers));
  if (noOffer) return `Nothing can be measured for ${noOffer.label} yet. Untick it, or connect your shop, your inbox or your analytics.`;
  if (!draft.currency) return "We could not tell which currency your plan is in. Connect an ad account first.";
  if ("absent" in draft.timeZone) return "Set your time zone first: your ceiling is counted by the month on that clock.";
  if (parseAmount(answers.ceiling) === undefined) return "Enter your monthly ceiling.";
  const shares = lineShares(draft, answers);
  if (lines.some((l) => shares[l.id] === undefined)) return "Enter each goal's share of the ceiling as a percentage.";
  const none = lines.find((l) => shares[l.id] === 0);
  if (none) return `${none.label} has no share of the ceiling. Give it one, or untick it.`;
  const sum = lines.reduce((t, l) => t + shares[l.id]!, 0);
  if (Math.abs(sum - 100) > 0.1) return `The goals' shares add up to ${Math.round(sum * 10) / 10}%. Make them add up to 100%.`;
  const noTarget = lines.find((l) => !lineTarget(l, answers));
  if (noTarget) return `Enter ${lineOffer(noTarget, answers)!.optimizeFor === "value" ? "the return you need" : SPEND_PER_OUTCOME} for ${noTarget.label}.`;
  if (!signalDone) return "Finish the signal step first: switch on your signal, or accept running without one.";
  return undefined;
}

/** The goals of a plan of one goal per chosen line, or undefined while any answer is missing. */
function lineGoals(draft: FirstRunDraftResponse, answers: FirstRunAnswers): ConfirmGoal[] | undefined {
  if (linesBlockedReason(draft, answers, true) !== undefined) return undefined;
  const lines = chosenLines(draft, answers);
  const shares = lineShares(draft, answers);
  const several = lines.length > 1;
  return lines.map((l) => {
    const offer = lineOffer(l, answers)!;
    const resolved = lineTarget(l, answers)!;
    const focus = selectedFocus(offer, asAnswers(answers, l.id));
    const campaignIds = several ? (draft.campaigns ?? []).filter((c) => campaignLine(draft, answers, c.campaignId) === l.id).map((c) => c.campaignId) : [];
    return {
      lineId: l.id,
      outcome: { kind: offer.kind, source: offer.source, optimizeFor: offer.optimizeFor, ...(focus ? { focus: { by: focus.by, values: focus.values, label: focus.label } } : {}) },
      share: shares[l.id]! / 100,
      target: resolved.target,
      targetSource: resolved.source,
      ...(campaignIds.length > 0 ? { campaignIds } : {}),
    };
  });
}

/** The plan `POST /onboarding/confirm` takes, or undefined while any answer is missing (the signal is the api's to check). */
export function buildPlanBody(draft: FirstRunDraftResponse, answers: FirstRunAnswers): ConfirmPlanBody | undefined {
  if (!draft.alreadyActive && !draft.tie && draft.playbook && draft.currency && (draft.lines ?? []).length > 0) {
    const goals = lineGoals(draft, answers);
    const ceiling = parseAmount(answers.ceiling);
    if (!goals || ceiling === undefined) return undefined;
    return { goals, currency: draft.currency, monthlyCeiling: ceiling, playbook: { id: draft.playbook.id, version: draft.playbook.version } };
  }
  const offer = selectedOffer(draft, answers);
  const ceiling = parseAmount(answers.ceiling);
  const resolved = resolveTarget(offer, answers);
  if (draft.alreadyActive || draft.tie || !draft.playbook || !offer || !draft.currency || "absent" in draft.timeZone || ceiling === undefined || !resolved) return undefined;
  const focus = selectedFocus(offer, answers);
  const outcome: MandateOutcome = {
    kind: offer.kind,
    source: offer.source,
    optimizeFor: offer.optimizeFor,
    ...(focus ? { focus: { by: focus.by, values: focus.values, label: focus.label } } : {}),
  };
  return {
    // A playbook with no lines: a plan of one goal with all of the ceiling.
    goals: [{ outcome, share: 1, target: resolved.target, targetSource: resolved.source }],
    currency: draft.currency,
    monthlyCeiling: ceiling,
    // The pin is stored even for a merchant's own target: it is what the allocator's priors and the weekly upgrade read.
    playbook: { id: draft.playbook.id, version: draft.playbook.version },
  };
}

/** What a failed send says. Codes the api writes for the merchant show their sentence; anything else is generic. */
const SEND_SENTENCE: Record<string, string> = {
  SIGNAL_NOT_READY: "Finish setting up the conversion signal (or accept running without one) before the plan can be confirmed.",
  NO_TIME_ZONE: "Set your time zone first: ceilings, batching and quiet hours all read it.",
  ALREADY_ACTIVE: "This business already has a plan running. Change it from Goals.",
  NO_VERIFIED_CONTACT: "Verify your WhatsApp number in Settings first; the confirmation link and code go to it.",
  UNKNOWN_APPROVER: "Every approver must be a verified contact of this business.",
  LINK_BUSY: "Another confirmation request for this business is in progress. Use the link it sent, or try again in a moment.",
  SEND_FAILED: "The confirmation message could not be sent on WhatsApp. Try again shortly.",
};

export function sendErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.code && SEND_SENTENCE[err.code]) return SEND_SENTENCE[err.code]!;
  if (err instanceof ApiError && err.code === "VALIDATION_ERROR") return "That plan is not one we can start. Check the ceiling and the target.";
  return "We could not send the plan. Try again in a moment.";
}
