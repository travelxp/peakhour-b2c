/**
 * GBP L7: the ONE line at the top of the Presence page. How the listing is doing, whether publishing is on, and how many things need the
 * merchant. Each part links to the place on the page that says more.
 *
 * ★NOTHING HERE IS RE-DERIVED. The score is `ListingScoreResponse` as the score card reads it, the publishing words come from
 * `publishingBanner`'s tone, a request's need is `requestStatus`'s own `next`, and the health rows are the score answer's `health`. A part whose
 * data has not answered is LEFT OUT, never guessed: "Nothing needs you" is only said once everything it counts has been read.
 *
 * No network is named here: the words carry no label, so the line reads the same on every network.
 */

import { publishingBanner, requestGroups, requestStatus, type CapabilitiesResponse, type ChangeCardData } from "@/lib/presence-edit";
import { changesView, type PresenceNetworkEntry } from "@/lib/presence-panels";
import type { ListingScoreResponse } from "@/lib/presence-score";

/** The in-page anchors the line links to. The page puts each id on the section it names. */
export const SUMMARY_ANCHORS = {
  score: "listing-score",
  publishing: "publishing-status",
  requests: "your-requests",
  networkChanges: "network-changes",
} as const;

/** The id of one request's row in "Your requests". */
export const requestRowId = (changeId: string) => `request-${changeId}`;

export interface NeedItem {
  kind: "approve" | "request" | "publishing" | "changed" | "health";
  /** An in-page anchor, `#...`. */
  href: string;
  /** What to do, said short, for the screen-reader sentence. */
  words: string;
}

export interface SummaryPart {
  id: "score" | "publishing" | "needs";
  /** What is drawn. */
  text: string;
  /** Null when there is nowhere to go: "Nothing needs you" is plain text, not a link to nothing. */
  href: string | null;
  /** The full sentence a screen reader hears. */
  sentence: string;
}

export interface SummaryInput {
  /** The score answer; undefined until it has answered (loading or failed). */
  score: ListingScoreResponse | undefined;
  /** `changes` and `capabilities` are what `changesView` reads: the edits the network made on its own that nobody has answered. */
  entry: (Pick<PresenceNetworkEntry, "label" | "publishing"> & Partial<Pick<PresenceNetworkEntry, "changes" | "capabilities">>) | null | undefined;
  can: CapabilitiesResponse["can"] | undefined;
  /** The listing's changes; undefined until they have answered. */
  changes: readonly ChangeCardData[] | undefined;
  now: number;
}

const FAILED_STAGES: ReadonlySet<string> = new Set(["failed", "rejected_by_network", "not_published", "not_sent"]);

const plural = (n: number) => (n === 1 ? "1 thing needs you" : `${n} things need you`);

/** Everything that needs the merchant, in the order to look at it. Null when something it counts has not been read yet. */
export function needItems(input: SummaryInput): NeedItem[] | null {
  const { score, entry, can, changes, now } = input;
  if (!entry || !can || !changes || score === undefined) return null;
  const items: NeedItem[] = [];
  const { open, recent } = requestGroups(changes, now);
  for (const c of [...open, ...recent]) {
    const r = requestStatus(c, entry.label, can, entry.publishing ?? null);
    // `decide` is only ever given to a role that can approve.
    if (r.next.kind === "decide") items.push({ kind: "approve", href: `#${requestRowId(c.id)}`, words: "approve or decline a request" });
    // A request stopped by the publishing blocker is the blocker's, counted once below.
    else if (FAILED_STAGES.has(r.stage) && r.next.kind === "redo") items.push({ kind: "request", href: `#${requestRowId(c.id)}`, words: "look at a request that did not go through" });
  }
  const banner = publishingBanner(entry, can);
  if (banner?.action) items.push({ kind: "publishing", href: `#${SUMMARY_ANCHORS.publishing}`, words: "fix what stops publishing" });
  // Each line `changesView` lists is a change nobody has answered yet (keeping or putting it back removes the line).
  const own = entry.changes && entry.capabilities ? changesView({ changes: entry.changes, capabilities: entry.capabilities }, entry.label) : null;
  for (let i = 0; i < (own?.kind === "some" ? own.lines.length : 0); i++) items.push({ kind: "changed", href: `#${SUMMARY_ANCHORS.networkChanges}`, words: "answer a change made on the listing itself" });
  if (score.state === "ready") {
    for (const h of score.health) if (h.state === "attention") items.push({ kind: "health", href: `#${SUMMARY_ANCHORS.score}`, words: "look at a listing check" });
  }
  return items;
}

/** The parts of the line, in reading order. A part whose data has not answered is not in it. */
export function summaryLine(input: SummaryInput): SummaryPart[] {
  const parts: SummaryPart[] = [];
  const { score } = input;
  if (score !== undefined) {
    const n = score.state === "ready" ? score.score.score : null;
    const text = n === null ? "Listing not scored yet" : `Listing ${n}/100`;
    parts.push({
      id: "score",
      text,
      href: `#${SUMMARY_ANCHORS.score}`,
      sentence: n === null ? "Your listing is not scored yet. Go to the score." : `Your listing score is ${n} out of 100. Go to the score.`,
    });
  }
  const banner = input.can ? publishingBanner(input.entry, input.can) : null;
  if (banner) {
    const text = banner.tone === "good" ? "Publishing on" : banner.tone === "warn" ? "Publishing hasn't started" : "Can't publish";
    const sentence = banner.tone === "good" ? "Publishing is on." : banner.tone === "warn" ? "Publishing has not started yet." : "Peakhour can't publish right now.";
    parts.push({ id: "publishing", text, href: `#${SUMMARY_ANCHORS.publishing}`, sentence: `${sentence} Go to the publishing status.` });
  }
  const needs = needItems(input);
  if (needs) {
    const first = needs[0];
    parts.push({
      id: "needs",
      text: needs.length === 0 ? "Nothing needs you" : plural(needs.length),
      href: first ? first.href : null,
      sentence: first ? `${plural(needs.length)}. Go to the first one: ${first.words}.` : "Nothing needs you right now.",
    });
  }
  return parts;
}

export const WAITING_WORDS = "Waiting: see Your requests";

/**
 * The one short line a section shows while a request for its field is open, linking to that request's row in "Your requests". The full status,
 * reason and actions live only there. Null when nothing for the field is open. `requestGroups` decides what is open (and lets a proposal that
 * ran out stop counting), so this never re-reads a status.
 */
export function waitingLine(
  changes: readonly ChangeCardData[] | undefined,
  now: number,
  matches: (c: Pick<ChangeCardData, "field" | "network">) => boolean,
): { text: string; href: string } | null {
  const first = requestGroups(changes, now).open.find(matches);
  return first ? { text: WAITING_WORDS, href: `#${requestRowId(first.id)}` } : null;
}
