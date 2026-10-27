import { ApiError } from "@/lib/api";
import type { ConfirmPlanBody, DraftOffer, FirstRunDraftResponse, MandateOutcome, MandateTarget } from "@/lib/api/growth-v2";

/**
 * First run (plan 1, row H5): turning the merchant's three answers and the drafted plan into the plan that is sent to
 * WhatsApp, and saying why it cannot be sent yet.
 *
 * ★PURE, SO IT CAN BE TESTED WITHOUT A BROWSER. The screen renders what these return; whether "Send to WhatsApp to confirm"
 * is on is decided here from the api's own draft (`planBlockedReason`), never inside JSX.
 * ★ONLY OFFERED OUTCOMES ARE EVER CHOSEN FROM: `selectedOffer` reads the draft's `offers`, which the api builds from the
 * business's own evidence. There is no fixed list of five kinds here.
 * ★A TYPED NUMBER IS TEXT UNTIL IT IS PARSED. An empty or unreadable box is "no answer", never 0.
 */

export interface FirstRunAnswers {
  /** `offerKey` of the chosen outcome; the first offer when absent or no longer offered. */
  offer?: string;
  /** The label of the chosen focus suggestion; absent or empty = every outcome of the kind counts. */
  focus?: string;
  /** The monthly ceiling as typed. */
  ceiling: string;
  /** The target as typed; empty = take the playbook's. */
  target: string;
}

export const EMPTY_ANSWERS: FirstRunAnswers = { ceiling: "", target: "" };

export const offerKey = (o: { kind: string; source: string }) => `${o.kind}:${o.source}`;

export function selectedOffer(draft: FirstRunDraftResponse, answers: FirstRunAnswers): DraftOffer | undefined {
  return draft.offers.find((o) => offerKey(o) === answers.offer) ?? draft.offers[0];
}

export function selectedFocus(offer: DraftOffer | undefined, answers: FirstRunAnswers): DraftOffer["focusSuggestions"][number] | undefined {
  // A focus is taken from orders only (plan 2.1); a win-definition or ads-conversion outcome has none to pick.
  if (!offer || offer.source !== "orders" || !answers.focus) return undefined;
  return offer.focusSuggestions.find((f) => f.label === answers.focus);
}

/** A positive number from what was typed (commas allowed), or undefined. Never 0 for "nothing typed". */
export function parseAmount(text: string): number | undefined {
  const t = text.replace(/,/g, "").trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** The kind of target an outcome is measured by: a return for value, a cost for a count (plan 2.1). */
export const targetKindOf = (offer: Pick<DraftOffer, "optimizeFor">): MandateTarget["kind"] => (offer.optimizeFor === "value" ? "roas" : "cost_per_outcome");

export interface ResolvedTarget {
  target: MandateTarget;
  source: "playbook" | "merchant";
}

/** The merchant's own number wins; else the playbook's default of the right kind; else none (the merchant must name one). */
export function resolveTarget(offer: DraftOffer | undefined, answers: FirstRunAnswers): ResolvedTarget | undefined {
  if (!offer) return undefined;
  const kind = targetKindOf(offer);
  const typed = parseAmount(answers.target);
  if (typed !== undefined) return { target: { kind, value: typed }, source: "merchant" };
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

/** Why the plan cannot be sent yet, in the merchant's words, or undefined when it can. Signal is the api's own `complete`. */
export function planBlockedReason(draft: FirstRunDraftResponse | undefined, answers: FirstRunAnswers, signalDone: boolean): string | undefined {
  if (!draft) return "Your plan is still loading.";
  if (draft.alreadyActive) return "The engine is already on for this business. Change the plan from Rules.";
  if (draft.tie) return "Tell us which description fits you best first.";
  if (!draft.playbook) return "There is no playbook for this business yet, so there is no plan to send.";
  const offer = selectedOffer(draft, answers);
  if (!offer) return "Nothing can be measured for this business yet. Connect your shop, your inbox or your analytics first.";
  if (!draft.currency) return "We could not tell which currency your plan is in. Connect an ad account first.";
  if ("absent" in draft.timeZone) return "Set your time zone first: your ceiling is counted by the month on that clock.";
  if (parseAmount(answers.ceiling) === undefined) return "Enter your monthly ceiling.";
  if (!resolveTarget(offer, answers)) return `Enter what you can pay per ${offer.optimizeFor === "value" ? "return" : "outcome"}: this outcome has no playbook default.`;
  if (!signalDone) return "Finish step 4 first: switch on your signal, or accept running without one.";
  return undefined;
}

/** The plan `POST /onboarding/confirm` takes, or undefined while any answer is missing (the signal is the api's to check). */
export function buildPlanBody(draft: FirstRunDraftResponse, answers: FirstRunAnswers): ConfirmPlanBody | undefined {
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
    outcome,
    currency: draft.currency,
    monthlyCeiling: ceiling,
    target: resolved.target,
    targetSource: resolved.source,
    // The pin is stored even for a merchant's own target: it is what the allocator's priors and the weekly upgrade read.
    playbook: { id: draft.playbook.id, version: draft.playbook.version },
  };
}

/** What a failed send says. Codes the api writes for the merchant show their sentence; anything else is generic. */
const SEND_SENTENCE: Record<string, string> = {
  SIGNAL_NOT_READY: "Finish setting up the conversion signal (or accept running without one) before the plan can be confirmed.",
  NO_TIME_ZONE: "Set your time zone first: ceilings, batching and quiet hours all read it.",
  ALREADY_ACTIVE: "This business already has a plan running. Change it from Rules.",
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
