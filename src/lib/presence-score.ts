/**
 * The listing score's words and rules (PE-10): how complete and healthy a listing is, and the next few fixes.
 *
 * MARKUP LIVES IN THE COMPONENT; EVERY DECISION AND SENTENCE LIVES HERE, because this repo runs vitest without JSDOM.
 *
 * NO NETWORK NAME IS HELD IN THIS FILE. The api writes the sentences that name a network from the adapter's own label, and this file
 * shows them as they come.
 *
 * AN UNKNOWN IS NEVER SHOWN AS A PROBLEM. A part we could not read says so and is left out of the score; the score says how much it
 * could see, and shows no number at all when it saw too little.
 *
 * A FIX WITHOUT AN EDIT SHOWS NO EDIT CONTROL. The api decides (control, writable field, writes released); this file only reads `action`.
 */

import type { ListingChangeView } from "@/lib/api/presence-changes";

export type CheckState = "ok" | "gap" | "unknown" | "not_applicable";

export interface ScoreCheck {
  id: string;
  field: string;
  label: string;
  state: CheckState;
  note?: string;
  /** What the check is worth. */
  points: number;
  /** `points` when ok, 0 when a gap, `null` when it was not counted. */
  earned: number | null;
}

export type FixAction =
  | { kind: "card"; network: string; listingId: string; field: string; value: unknown; risky: boolean }
  | { kind: "form"; network: string; listingId: string; field: string; risky: boolean }
  | { kind: "none"; reason: string; message: string };

export interface ScoreFix {
  id: string;
  field: string;
  title: string;
  why: string;
  rank: { position: number; effect: "high" | "medium" | "low"; reason: string };
  note?: string;
  /** The points the score gains when this is fixed. */
  points: number;
  action: FixAction;
}

export type ScoreOrdering =
  | { by: "your_figures"; days: number; measuredDays: number; calls: number; directions: number }
  | { by: "kind_of_business"; reason: "figures_not_read" | "figures_incomplete" | "too_few_days" | "too_few_actions"; callShare: number; group: string };

export interface HealthItem {
  id: string;
  state: "ok" | "attention" | "unknown";
  headline: string;
  detail?: string;
}

export interface ListingScoreBody {
  score: number | null;
  seen: { scored: number; unknown: number; notApplicable: number; total: number; pointsEarned: number; pointsCounted: number; sentence: string };
  market: { code: string | null; name: string };
  business: { group: string; noun: string };
  checks: ScoreCheck[];
  fixes: ScoreFix[];
  ordering: ScoreOrdering;
}

export type ListingScoreResponse =
  | { state: "not_connected" | "needs_reconnect" | "needs_location" | "sync_failing" | "importing" | "no_listing" }
  | { state: "ready"; listingId: string; network: { key: string; label: string }; score: ListingScoreBody; health: HealthItem[] };

export const presenceScoreQueryKey = (location: string | undefined, network?: string) => ["presence", "score", location ?? "default", network ?? "default"] as const;

/** What the card says while there is no score to show, in plain words with the next step. */
export function scoreEmptyState(r: ListingScoreResponse | undefined): { headline: string; description: string } | null {
  if (!r || r.state === "ready") return null;
  if (r.state === "not_connected") {
    return { headline: "Connect your listing to see how complete it is", description: "Once it is connected, your score and the next few things to fix appear here." };
  }
  if (r.state === "needs_reconnect") {
    return { headline: "Reconnect your listing to see your score", description: "The connection has expired. Reconnect it above, and your score appears here." };
  }
  if (r.state === "sync_failing") {
    return { headline: "We could not reach your listing", description: "The last checks failed, so we are not scoring it. Nothing is wrong with your listing; try reconnecting above." };
  }
  if (r.state === "needs_location") {
    return { headline: "Choose which listing is yours", description: "Pick your listing in the connection above, and your score appears here." };
  }
  if (r.state === "no_listing") {
    return { headline: "This network gives no listing to score", description: "It sends reviews only, so there is nothing here to check." };
  }
  return { headline: "We are still bringing in your listing", description: "It usually arrives within the hour. Nothing is wrong with your listing." };
}

/** The big line. A number only when the api gave one: `null` is "we saw too little", which is not a low score. */
export function scoreHeadline(score: number | null): string {
  return score === null ? "Not enough to score yet" : `${score} out of 100`;
}

export type Tone = "good" | "fair" | "poor" | "none";

/**
 * A colour band for the number. No number, no band.
 * THE "GOOD" BAND IS NEVER SHOWN WHILE A CHECK WAS NOT DONE: green reads as "all healthy", and a part nobody looked at is not known to be.
 */
export function scoreTone(score: number | null, unknown: number): Tone {
  if (score === null) return "none";
  if (score >= 85) return unknown > 0 ? "fair" : "good";
  return score >= 60 ? "fair" : "poor";
}

/** Why the number is not shown as healthy when it would have been. Null when nothing needs saying. */
export function scoreToneNote(score: number | null, seen: ListingScoreBody["seen"]): string | null {
  if (score === null || score < 85 || seen.unknown === 0) return null;
  return `Not shown as fully healthy: ${seen.unknown === 1 ? "1 check was" : `${seen.unknown} checks were`} not done, so the score may change once ${seen.unknown === 1 ? "it is" : "they are"}.`;
}

const pointWord = (n: number) => (n === 1 ? "1 point" : `${n} points`);

/** "16 of 18 points, from 6 of 7 checks." Null when no number is shown (too few checks judged), so a sum is never shown beside "not enough". */
export function pointsSentence(seen: ListingScoreBody["seen"], score: number | null): string | null {
  if (score === null || seen.scored === 0) return null;
  const from = seen.unknown === 0 ? `all ${seen.total} checks` : `${seen.scored} of ${seen.total} checks`;
  return `${seen.pointsEarned} of ${seen.pointsCounted} points, from ${from}.`;
}

/** What one check row says about its points, in words that do not lean on colour. */
export function checkPoints(c: Pick<ScoreCheck, "state" | "points" | "earned">): string {
  if (c.state === "not_applicable") return "Does not apply";
  if (c.state === "unknown") return "Not checked, not counted";
  // The state decides: a gap earned nothing, whatever `earned` says.
  return c.state === "ok" ? `+${c.earned ?? c.points} of ${c.points}` : `0 of ${c.points} — missing`;
}

/** "Add photos (+2 points)". */
export function fixTitleWithPoints(f: Pick<ScoreFix, "title" | "points">): string {
  return `${f.title} (+${pointWord(f.points)})`;
}

/** Checks in the order a person reads them: what to do, what we could not check, what is done, what does not apply. */
export function sortedChecks(checks: readonly ScoreCheck[]): ScoreCheck[] {
  const rank: Record<CheckState, number> = { gap: 0, unknown: 1, ok: 2, not_applicable: 3 };
  return checks.map((c, i) => ({ c, i })).sort((a, b) => rank[a.c.state] - rank[b.c.state] || a.i - b.i).map((x) => x.c);
}

/** How many fixes the card shows before "Show more". The list is short on purpose. */
export const FIXES_SHOWN = 4;

export function visibleFixes<T>(fixes: readonly T[], showAll: boolean): T[] {
  return showAll ? [...fixes] : fixes.slice(0, FIXES_SHOWN);
}

/** One line above the fix list that says which order it is in, truthfully. */
export function orderingSentence(o: ScoreOrdering): string {
  if (o.by === "your_figures") return `Ordered by what your customers did in the last ${o.days} days: ${countOf(o.calls, "call")} and ${countOf(o.directions, "request")} for directions.`;
  if (o.reason === "figures_not_read") return "Ordered by what usually matters for a business like yours. We have not read your figures yet.";
  if (o.reason === "figures_incomplete") return "Ordered by what usually matters for a business like yours. Your call and direction figures are not all in yet.";
  if (o.reason === "too_few_days") return "Ordered by what usually matters for a business like yours. We have too few days of your figures to go by.";
  return "Ordered by what usually matters for a business like yours. Too few customers have acted on your listing to go by yet.";
}

/** "no calls", "1 call", "5 calls". */
function countOf(n: number, noun: string): string {
  return n === 0 ? `no ${noun}s` : n === 1 ? `1 ${noun}` : `${n} ${noun}s`;
}

const EFFECT_WORD = { high: "Matters most", medium: "Matters", low: "Smaller" } as const;

export function effectWord(e: "high" | "medium" | "low"): string {
  return EFFECT_WORD[e];
}

export type FixControl =
  | { kind: "propose"; label: string }
  | { kind: "form"; label: string; risky: boolean }
  | { kind: "note"; message: string };

/**
 * What a fix shows as its control. `none` is a note and never a button: the api only sends it when the edit could not go live.
 * `form` is offered only when the page can open the edit form (`canOpenForm`); without it the fix shows its reason alone.
 */
export function fixControl(action: FixAction, canOpenForm: boolean): FixControl | null {
  if (action.kind === "none") return { kind: "note", message: action.message };
  if (action.kind === "card") return { kind: "propose", label: "Prepare this change" };
  return canOpenForm ? { kind: "form", label: "Add it", risky: action.risky } : null;
}

/** The body for `POST /v1/presence/changes`, from a fix whose action is a card. The source is set by the api from the signed-in user. */
export function proposalBody(action: Extract<FixAction, { kind: "card" }>) {
  return { listingId: action.listingId, network: action.network, changes: [{ field: action.field, value: action.value }] };
}

/** The words the health list is shown under. None of it is counted in the score. */
export const HEALTH_TITLE = "Other checks (not part of the score)";

const HEALTH_MARK = { ok: "Fine", attention: "Needs a look", unknown: "Not checked" } as const;

export function healthMark(s: HealthItem["state"]): string {
  return HEALTH_MARK[s];
}

/** Health items that need a person first, then those we could not check, then the rest. */
export function sortedHealth(items: readonly HealthItem[]): HealthItem[] {
  const rank = { attention: 0, unknown: 1, ok: 2 } as const;
  return items.map((c, i) => ({ c, i })).sort((a, b) => rank[a.c.state] - rank[b.c.state] || a.i - b.i).map((x) => x.c);
}

// ── The change card a prepared fix opens ──────────────────────

/** One change as the api returns it: the shared view of `presenceChangesApi`. */
export type ChangeView = ListingChangeView;

/** Statuses in which a person can still decide. */
export function canDecide(c: Pick<ChangeView, "status">): boolean {
  return c.status === "proposed" || c.status === "validated";
}

export function valueText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "Nothing";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

/** The sentence under a card once it has been acted on. Never "live": a later read proves that. */
export function statusSentence(status: string): string {
  switch (status) {
    case "proposed":
    case "validated":
      return "Waiting for you to approve it.";
    case "approved":
    case "applying":
      return "Approved. It is being sent.";
    case "submitted":
      return "Sent. It shows as submitted until a later check confirms it is live.";
    case "live":
      return "Confirmed live.";
    case "blocked":
      return "Not sent.";
    case "failed":
      return "It could not be sent.";
    case "rejected":
      return "Discarded.";
    default:
      return "";
  }
}
