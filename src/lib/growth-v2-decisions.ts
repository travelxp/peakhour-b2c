import { ApiError } from "@/lib/api";
import type { DecisionAction, DecisionKind, DecisionQueue, DecisionStatus, DecisionView, EngineOpView } from "@/lib/api/growth-v2";
import { PLATFORM_LABEL, formatCount, formatMoney } from "@/lib/growth-v2-figure";

/**
 * Presentation rules for the Decisions screen: which tab a decision sits in,
 * what its operations say, what it impacts, how an answer the api refused reads
 * as something the merchant can act on, and how its WhatsApp message reads.
 */

// -- Queue tabs ------------------------------------------------------------------

export type QueueTab = "needs_you" | "done" | "blocked";

/** The api's queue behind each tab. */
export const TAB_QUEUE: Record<QueueTab, DecisionQueue> = { needs_you: "open", done: "done", blocked: "blocked" };

/**
 * The server's split (plan 2.10), which the preview sample follows:
 * - Needs you: proposed, or held (parked, or sent back by a refusal the person can clear).
 * - Done: everything with an end state, including what failed, what you rejected and what ran out.
 * - Blocked: not a status at all. It is the guardrail blocks, read from their own collection.
 */
export function queueTab(status: DecisionStatus): QueueTab {
  return status === "proposed" || status === "held" ? "needs_you" : "done";
}

export const QUEUE_TABS: Array<{ id: QueueTab; label: string }> = [
  { id: "needs_you", label: "Needs you" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" },
];

/** The decisions in each tab. `blocked` counts no decision: the api counts its blocks. */
export function tabCounts(decisions: DecisionView[]): Record<QueueTab, number> {
  const counts: Record<QueueTab, number> = { needs_you: 0, done: 0, blocked: 0 };
  for (const d of decisions) counts[queueTab(d.status)] += 1;
  return counts;
}

// -- Labels ------------------------------------------------------------------------

export const KIND_LABEL: Record<DecisionKind, string> = {
  budget_move: "Budget",
  budget_raise: "Budget",
  bid_strategy: "Bidding",
  creative_approval: "Creative",
  campaign_launch: "Launch",
  campaign_pause: "Pause",
  playbook_upgrade: "Playbook",
  autonomy_change: "Autonomy",
  mandate_change: "Mandate",
  channel_add: "New channel",
  content_adjustment: "Content",
};

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  proposed: "Waiting for you",
  approved: "Approved",
  applied: "Done",
  held: "On hold",
  rejected: "Rejected",
  expired: "Expired",
  superseded: "Replaced",
  reverted: "Undone",
  failed: "Blocked",
};

/** Kinds whose approval spends or changes spend, so a WhatsApp approval needs CONFIRM, and so does the in-app one. */
const SPEND_KINDS = new Set<DecisionKind>(["budget_move", "budget_raise", "bid_strategy", "campaign_launch", "channel_add"]);
export const isSpendDecision = (kind: DecisionKind) => SPEND_KINDS.has(kind);

// -- What a person may do ---------------------------------------------------------------

/** Whether the decision's expiry has passed on this clock. A decision with no expiry never has. */
export function isExpired(d: Pick<DecisionView, "expiresAt">, now: number): boolean {
  return d.expiresAt !== undefined && new Date(d.expiresAt).getTime() <= now;
}

/** Waiting on an answer: proposed, or held (sent back to waiting, so it can be answered again). */
export const isAnswerable = (d: Pick<DecisionView, "status" | "needsPerson">) => (d.status === "proposed" || d.status === "held") && d.needsPerson;

/** Approve is on only while the decision is answerable and has not expired. */
export const canApprove = (d: DecisionView, now: number) => isAnswerable(d) && !isExpired(d, now);

/** Hold parks a proposal; a held one is already parked. */
export const canHold = (d: DecisionView, now: number) => canApprove(d, now) && d.status === "proposed";

/**
 * Undo is offered until the api's window ends. The window is the decision's live actions' own (`undoUntil`); a decision
 * without one has nothing left to undo (a protective act, already undone, or the window closed and the api dropped it).
 */
export function undoOpenUntil(d: DecisionView, now: number): number | undefined {
  if (d.status !== "applied" || d.undoUntil === undefined) return undefined;
  const t = new Date(d.undoUntil).getTime();
  return Number.isNaN(t) || t <= now ? undefined : t;
}

// -- Operations -----------------------------------------------------------------------

const OP_VERB: Record<EngineOpView["op"], string> = {
  set_daily_budget: "daily budget",
  set_status: "status",
  set_bid_strategy: "bid strategy",
  set_target: "target",
  attach_creative: "attach creative",
  detach_creative: "detach creative",
  set_geo_exclusions: "excluded areas",
  set_geo_inclusions: "targeted areas",
};

const showMoney = (n: number, currency: string) => (currency ? formatMoney(n, currency) : formatCount(n));

const show = (v: unknown, currency: string, isMoney: boolean): string => {
  if (typeof v === "number") return isMoney ? showMoney(v, currency) : formatCount(v);
  if (typeof v === "string") return v.replace(/_/g, " ");
  if (v === undefined || v === null) return "";
  return JSON.stringify(v);
};

/**
 * One line per operation: "Meta Ads, trip videos: daily budget 590 to 653". The api writes its own sentence for a live
 * decision (`description`, with the campaign by name); this is the fallback for an op that has none.
 */
export function describeOp(op: EngineOpView, currency: string): string {
  const where = `${PLATFORM_LABEL[op.platform]}, ${op.campaignRef}`;
  // Only a budget is an amount of money. A target may be a cost or a multiplier and its unit is not in the op.
  const money = op.op === "set_daily_budget";
  const to = show(op.to, currency, money);
  if (op.op === "attach_creative" || op.op === "detach_creative") return `${where}: ${OP_VERB[op.op]} ${to}`;
  const from = op.from === undefined ? "" : `${show(op.from, currency, money)} to `;
  return `${where}: ${OP_VERB[op.op]} ${from}${to}`;
}

// -- Impact ------------------------------------------------------------------------------

/**
 * The impact range in words. `outcomes` is a count of outcomes over the horizon;
 * `cost_per_outcome` is the change in what one outcome costs, in the mandate's
 * currency, so a negative range is an improvement. `value` is a change in money,
 * `roas` a change in a multiplier.
 */
export function describeImpact(
  impact: NonNullable<DecisionView["impact"]>,
  currency: string,
  unit: { one: string; many: string },
): { range: string; caption: string } {
  const sign = (n: number) => (n > 0 ? `+${formatCount(n)}` : n < 0 ? `−${formatCount(Math.abs(n))}` : "0");
  const confidence = `${Math.round(impact.confidence * 100)}% range`;
  if (impact.metric === "outcomes") {
    return { range: `${sign(impact.low)} to ${sign(impact.high)}`, caption: `extra ${unit.many} over ${impact.horizonDays} days (${confidence})` };
  }
  if (impact.metric === "roas") {
    return { range: `${impact.low} to ${impact.high}`, caption: `return on ad spend after ${impact.horizonDays} days (${confidence})` };
  }
  const money = (n: number) => (n === 0 ? formatMoney(0, currency) : `${n < 0 ? "−" : "+"}${formatMoney(Math.abs(n), currency)}`);
  if (impact.metric === "value") {
    return { range: `${money(impact.low)} to ${money(impact.high)}`, caption: `extra ${unit.one} value over ${impact.horizonDays} days (${confidence})` };
  }
  return { range: `${money(impact.low)} to ${money(impact.high)}`, caption: `cost per ${unit.one} after ${impact.horizonDays} days (${confidence})` };
}

// -- A refusal, as something to do --------------------------------------------------------------

export interface DecisionNotice {
  tone: "warn" | "bad";
  text: string;
  /** What the merchant can do about it, when there is somewhere to go. */
  link?: { label: string; href: string };
}

const INTEGRATIONS = "/dashboard/integrations";
const RULES = "/dashboard/growth/rules";
const NOTHING_CHANGED = "That didn't go through. Nothing changed.";

/**
 * The api's refusal of an answer, as a sentence and, where there is one, the place to fix it. The codes a refused apply
 * sends the decision back to `held` with (the person can clear them) each get their own words; the rest say what the
 * api said.
 */
export function decisionNotice(err: unknown, action: DecisionAction): DecisionNotice {
  if (!(err instanceof ApiError)) return { tone: "bad", text: NOTHING_CHANGED };
  switch (err.code) {
    case "NEEDS_REAUTH":
      return { tone: "warn", text: "Your ad account needs to be reconnected before this can run. Reconnect it, then approve again.", link: { label: "Reconnect", href: INTEGRATIONS } };
    case "NOT_CONNECTED":
      return { tone: "warn", text: "That ad account isn't connected. Reconnect it, then approve again.", link: { label: "Reconnect", href: INTEGRATIONS } };
    case "AD_ACCOUNT_NOT_AUTHORIZED":
    case "AD_ACCOUNT_FORBIDDEN":
      return { tone: "warn", text: "The ad account didn't allow this change. Check the access you gave Peakhour, then approve again.", link: { label: "Check the connection", href: INTEGRATIONS } };
    case "ADS_HALTED":
      return { tone: "warn", text: "Ads are paused for this business.", link: { label: "Review your rules", href: RULES } };
    case "QUIET_HOURS":
      return { tone: "warn", text: "Will apply after quiet hours. Approve it again once they end." };
    case "BLACKOUT":
      return { tone: "warn", text: "A blackout date you set is in effect. Approve it again after it ends.", link: { label: "Review your rules", href: RULES } };
    case "CHANNEL_DENIED":
      return { tone: "warn", text: "Your guardrails keep this channel off.", link: { label: "Review your rules", href: RULES } };
    case "GOVERNOR_HOLD":
      return { tone: "warn", text: "Waiting for the platform to finish learning. Approve it again in a few days." };
    case "EXPIRED":
      return { tone: "bad", text: "This expired before it was answered, and nothing changed." };
    case "ALREADY_DECIDED":
      return { tone: "warn", text: "This was already answered. The list has been refreshed." };
    case "APPLY_INCOMPLETE":
      return { tone: "warn", text: "Part of the change was applied. Approve again to finish it." };
    case "NOT_UNDOABLE":
      return { tone: "warn", text: "Only a change that was applied can be undone." };
    case "UNDO_WINDOW_CLOSED":
      return { tone: "warn", text: "The 24-hour undo window has passed." };
    default:
      return { tone: "bad", text: err.message || (action === "undo" ? "That couldn't be undone. Check your campaigns." : NOTHING_CHANGED) };
  }
}

// -- WhatsApp ----------------------------------------------------------------------------------

export interface WhatsAppPreview {
  header: string;
  body: string;
  buttons: string[];
  /** Spend decisions ask for a CONFIRM reply from a verified number before they run. */
  confirmNote?: string;
}

/**
 * How a decision reads as a WhatsApp utility message (plan 2.9). A preview built
 * from the decision's own words, not the sent message.
 */
export function whatsappPreview(d: DecisionView, businessName: string): WhatsAppPreview {
  return {
    header: `Decision for ${businessName}`,
    body: `${d.title}.\n${d.summary}`,
    buttons: d.kind === "creative_approval" ? ["Review", "Hold"] : ["Approve", "Hold", "Details"],
    confirmNote: isSpendDecision(d.kind) ? "To confirm, reply CONFIRM." : undefined,
  };
}
