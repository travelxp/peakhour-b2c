import type { ChannelMeasurement, OptimizerRun, OutcomesResponse, PaidChannel } from "@/lib/api/growth";
import { paidFigureLabel } from "@/lib/visibility-funnel";
import { formatMoney } from "@/lib/outcome-value";
import {
  ADS_CHANNELS,
  adsChannelConnectionState,
  type AdsIntegrationRow,
} from "@/app/(site)/dashboard/ads/ads-channels";

/**
 * D-03 — what the Unified Growth Dashboard's channel sections say, decided once
 * and tested here, so the page only lays it out (plan §6.1).
 *
 * ★CHANNEL IS A FILTER, NEVER A TAB. The funnel and "what changed" are about
 * the business, organic first, and never filter; Needs You, Channels and
 * Learning narrow to one channel. A Needs You item about the business (publish
 * something, connect analytics) stays under every chip; one about ads that
 * names no channel is held back under a chip and counted, never shown as if it
 * were that channel's.
 *
 * ★ABSENT IS NEVER ZERO, here as on the rest of the page. A platform that
 * reports no conversions has no cost per conversion and no "0"; a source not
 * yet read, or that failed, is named as unchecked, never rendered as "nothing
 * needs you".
 */

export const ALL_CHANNELS = "all";

const NUM = new Intl.NumberFormat("en-US");

export interface ChannelChip {
  key: string;
  label: string;
}

/**
 * The chips: "All" plus each channel the page has something about. None at all
 * below two channels — a filter with one choice is a label pretending to be a
 * control.
 */
export function channelChips(platforms: Iterable<string>): ChannelChip[] {
  const seen = [...new Set(platforms)];
  if (seen.length < 2) return [];
  return [
    { key: ALL_CHANNELS, label: "All channels" },
    ...seen.map((p) => ({ key: p, label: paidFigureLabel(p) })),
  ];
}

/** True when `channel` passes `filter`. Untagged items pass every filter. */
export function inChannel(filter: string, channel: string | undefined): boolean {
  return filter === ALL_CHANNELS || channel === undefined || channel === filter;
}

/**
 * The day an EVENT happened, in the merchant's own zone. ★NOT `shortDate`,
 * which formats in UTC because its inputs are UTC-midnight day instants: a
 * decision at 02:00 in Kolkata is the previous day in UTC.
 */
export function eventDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export interface MeasurementBadge {
  label: string;
  tone: "success" | "warning" | "muted";
  /** What the badge means, for its tooltip and screen readers. */
  meaning: string;
}

const BADGES: Record<ChannelMeasurement, MeasurementBadge> = {
  tracked: {
    label: "Tracked",
    tone: "success",
    meaning: "Its conversion count is checked against the conversions Peakhour sent it.",
  },
  partial: {
    label: "Partial",
    tone: "warning",
    meaning:
      "Only the platform's own pixel or tag counts conversions here — nothing Peakhour sends has reached it yet.",
  },
  untracked: {
    label: "Not tracked",
    tone: "muted",
    meaning: "This platform reports no conversions, so nothing here can be credited to it.",
  },
};

export interface ChannelRow {
  platform: string;
  label: string;
  spend: string;
  conversions: string;
  costPerConversion: string;
  /** Null when the api sent no measurement — no badge beats a guessed one. */
  badge: MeasurementBadge | null;
  note: string | null;
}

const NO_FIGURES = "no figures this window";

/** One channel, as the Channels section shows it. */
export function channelRow(ch: PaidChannel): ChannelRow {
  const base = {
    platform: ch.platform,
    label: paidFigureLabel(ch.platform),
    badge: ch.measurement ? BADGES[ch.measurement] : null,
    note: ch.stale ? `stopped updating${ch.lastReadAt ? ` — last read ${eventDate(ch.lastReadAt)}` : ""}` : null,
  };
  // ★A CHANNEL THAT DID NOT MOVE IS LISTED ONLY BECAUSE IT IS STALE (the api's
  //  `rollupPaid`): its null spend is not a refusal and its 0 is not a measured
  //  zero — the window has no figures from it. `paidNote` leaves it out of the
  //  total for the same reason.
  if (ch.moved === false) {
    return { ...base, spend: NO_FIGURES, conversions: NO_FIGURES, costPerConversion: NO_FIGURES };
  }
  // A spend with no currency is refused like a null one: a bare number beside
  // other channels' money reads as the same unit.
  const priced = ch.spend !== null && ch.currency ? { amount: ch.spend, currency: ch.currency } : null;
  let costPerConversion: string;
  if (ch.conversions === null) costPerConversion = "not measurable";
  else if (priced === null) costPerConversion = "spend not totalled";
  else if (ch.conversions === 0) costPerConversion = "no conversions yet";
  else costPerConversion = formatMoney(priced.amount / ch.conversions, priced.currency);
  return {
    ...base,
    spend: priced === null ? "couldn't be totalled" : formatMoney(priced.amount, priced.currency),
    conversions: ch.conversions === null ? "not reported" : NUM.format(ch.conversions),
    costPerConversion,
  };
}

type Paid = OutcomesResponse["reach"]["paid"];

/** The Channels section's rows under a filter. */
export function channelRows(paid: Paid, filter: string): ChannelRow[] {
  return (paid?.byChannel ?? []).filter((ch) => inChannel(filter, ch.platform)).map(channelRow);
}

export interface NeedsYouItem {
  id: string;
  severity: "critical" | "attention" | "opportunity";
  title: string;
  detail: string;
  href?: string;
  cta?: string;
  /** The channel it belongs to; absent for an item about the business. */
  channel?: string;
}

/**
 * One item per channel with optimizer proposals still open. Every run counts,
 * not just the newest: the optimizer page offers an older week's open proposal
 * for a decision too, and a count that disagreed with that page would be wrong
 * on one of them.
 */
export function proposalItems(runs: readonly OptimizerRun[]): NeedsYouItem[] {
  const open = new Map<string, number>();
  for (const run of runs) {
    const n = run.proposals.filter((p) => p.status === "proposed").length;
    if (n > 0) open.set(run.platform, (open.get(run.platform) ?? 0) + n);
  }
  return [...open].map(([platform, n]) => ({
    id: `proposals-${platform}`,
    severity: "attention",
    title: `${n} optimizer proposal${n === 1 ? "" : "s"} waiting for your decision`,
    detail: `For ${paidFigureLabel(platform)}. Each says what it expects to change and when it would be rolled back.`,
    href: "/dashboard/optimizer",
    cta: "Review",
    channel: platform,
  }));
}

/** One item per ads channel whose connection needs reconnecting. */
export function reconnectItems(integrations: readonly AdsIntegrationRow[]): NeedsYouItem[] {
  return ADS_CHANNELS.filter((c) => adsChannelConnectionState(integrations, c) === "needs_reauth").map((c) => ({
    id: `reconnect-${c.key}`,
    severity: "critical",
    title: `Reconnect ${c.label}`,
    detail: "Peakhour's access to it has lapsed. Until you reconnect, its figures here can fall out of date.",
    href: `/dashboard/ads?channel=${c.key}`,
    cta: "Reconnect",
    channel: c.key,
  }));
}

/** The api's next actions that are about ads but name no channel. */
export function isAdsAction(id: string): boolean {
  return /^(campaign|campaigns|ads)-/.test(id);
}

/**
 * The api's next actions without `ads-stale` when every stale channel already
 * has its own reconnect card — one fault, one card. Kept when any stale channel
 * has none, because then it is the only thing saying so.
 */
export function withoutCoveredAdsStale<T extends { id: string }>(
  actions: readonly T[],
  paid: Paid,
  reconnect: readonly NeedsYouItem[],
): T[] {
  const stale = (paid?.byChannel ?? []).filter((c) => c.stale).map((c) => c.platform);
  const covered = new Set(reconnect.map((i) => i.channel));
  const allCovered = stale.length > 0 && stale.every((p) => covered.has(p));
  return actions.filter((a) => !(a.id === "ads-stale" && allCovered));
}

/**
 * Needs You under a filter: the items shown, and how many ads items naming no
 * channel were held back from it.
 */
export function needsYouUnder(
  filter: string,
  items: readonly NeedsYouItem[],
): { items: NeedsYouItem[]; heldBack: number } {
  if (filter === ALL_CHANNELS) return { items: [...items], heldBack: 0 };
  const shown: NeedsYouItem[] = [];
  let heldBack = 0;
  for (const i of items) {
    if (i.channel === undefined && isAdsAction(i.id)) heldBack++;
    else if (inChannel(filter, i.channel)) shown.push(i);
  }
  return { items: shown, heldBack };
}

export type SourceState = "read" | "checking" | "failed";

/** A query's state as Needs You reports it: read only when there is data. */
export function sourceState(q: { data: unknown; isError: boolean }): SourceState {
  return q.data !== undefined ? "read" : q.isError ? "failed" : "checking";
}

/**
 * Which Needs You sources are not read. Named, because an empty list over an
 * unread source is a claim that nothing needs the merchant — and nobody
 * checked.
 */
export function uncheckedNote(state: { proposals: SourceState; connections: SourceState }): string | null {
  const names = { proposals: "optimizer proposals", connections: "your ad connections" } as const;
  const keys = ["proposals", "connections"] as const;
  const failed = keys.filter((k) => state[k] === "failed").map((k) => names[k]);
  const checking = keys.filter((k) => state[k] === "checking").map((k) => names[k]);
  const parts = [
    failed.length > 0 ? `We couldn't check ${failed.join(" or ")} just now.` : null,
    checking.length > 0 ? `Still checking ${checking.join(" and ")}.` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

export interface LearningItem {
  id: string;
  channel: string;
  when: string | null;
  headline: string;
  detail: string;
}

const UNMEASURED = "What it actually did isn't measured yet.";

/**
 * What was tried, newest first: every optimizer proposal approved, applied,
 * dismissed or failed. ★`approved` IS MOSTLY FINAL — the api leaves every
 * approval but a budget resplit at `approved` for good, so skipping it would
 * hide most of what a merchant accepted. ★A CHANGE SAYS ITS EFFECT IS NOT
 * MEASURED, because nothing measures it yet: the experiment ledger that would
 * record "what it did" is C-03's.
 */
export function learningItems(runs: readonly OptimizerRun[], filter: string, limit = 5): LearningItem[] {
  const items: (LearningItem & { at: number })[] = [];
  for (const run of runs) {
    if (!inChannel(filter, run.platform)) continue;
    for (const p of run.proposals) {
      let headline: string;
      let detail: string;
      let when: string | undefined;
      if (p.status === "applied") {
        headline = `Applied: ${p.summary}`;
        detail = `Expected: ${p.expectedEffect}. ${UNMEASURED}`;
        when = p.appliedAt ?? p.decidedAt;
      } else if (p.status === "approved") {
        headline = `You approved: ${p.summary}`;
        detail = `Expected: ${p.expectedEffect}. ${UNMEASURED}`;
        when = p.decidedAt;
      } else if (p.status === "dismissed") {
        headline = `You dismissed: ${p.summary}`;
        detail = `It expected: ${p.expectedEffect}.`;
        when = p.decidedAt;
      } else if (p.status === "failed") {
        headline = `Tried, and it failed: ${p.summary}`;
        detail = p.failReason ?? "No reason was recorded.";
        when = p.decidedAt;
      } else continue;
      items.push({
        id: `${run._id}-${p.id}`,
        channel: run.platform,
        when: when ? eventDate(when) : null,
        headline,
        detail,
        at: when ? Date.parse(when) : -Infinity,
      });
    }
  }
  return items
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map(({ id, channel, when, headline, detail }) => ({ id, channel, when, headline, detail }));
}

/** The heading over the movements: they compare the window against the one
 *  before it, which is not "this week", so the heading says what they are. */
export function changedHeading(days: number): string {
  return `What changed — the last ${days} days against the ${days} before`;
}

