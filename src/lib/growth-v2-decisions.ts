import type { DecisionKind, DecisionStatus, DecisionView, EngineOpView } from "@/lib/api/growth-v2";
import { PLATFORM_LABEL, formatCount, formatMoney } from "@/lib/growth-v2-figure";

/**
 * Presentation rules for the Decisions screen: which tab a decision sits in,
 * what its operations say, what it impacts, and how its WhatsApp message reads.
 */

// -- Queue tabs ------------------------------------------------------------------

export type QueueTab = "needs_you" | "done" | "blocked";

/**
 * - Needs you: proposed, waiting on a person.
 * - Blocked: the engine could not do it (`failed`) or you parked it (`held`).
 * - Done: everything else, including what you rejected and what ran out.
 */
export function queueTab(status: DecisionStatus): QueueTab {
  if (status === "proposed") return "needs_you";
  if (status === "failed" || status === "held") return "blocked";
  return "done";
}

export const QUEUE_TABS: Array<{ id: QueueTab; label: string }> = [
  { id: "needs_you", label: "Needs you" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" },
];

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

/** Kinds whose approval spends or changes spend, so a WhatsApp approval needs CONFIRM. */
const SPEND_KINDS = new Set<DecisionKind>(["budget_move", "budget_raise", "bid_strategy", "campaign_launch", "channel_add"]);
export const isSpendDecision = (kind: DecisionKind) => SPEND_KINDS.has(kind);

// -- Operations -----------------------------------------------------------------------

const OP_VERB: Record<EngineOpView["op"], string> = {
  set_daily_budget: "daily budget",
  set_status: "status",
  set_bid_strategy: "bid strategy",
  set_target: "target",
  attach_creative: "attach creative",
  detach_creative: "detach creative",
  set_geo_exclusions: "excluded areas",
};

const showMoney = (n: number, currency: string) => (currency ? formatMoney(n, currency) : formatCount(n));

const show = (v: unknown, currency: string, isMoney: boolean): string => {
  if (typeof v === "number") return isMoney ? showMoney(v, currency) : formatCount(v);
  if (typeof v === "string") return v.replace(/_/g, " ");
  if (v === undefined || v === null) return "";
  return JSON.stringify(v);
};

/** One line per operation: "Meta Ads, trip videos: daily budget 590 to 653". */
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
 * currency, so a negative range is an improvement.
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
  const money = (n: number) => (n === 0 ? formatMoney(0, currency) : `${n < 0 ? "−" : "+"}${formatMoney(Math.abs(n), currency)}`);
  return { range: `${money(impact.low)} to ${money(impact.high)}`, caption: `cost per ${unit.one} after ${impact.horizonDays} days (${confidence})` };
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
