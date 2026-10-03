import type { ChannelMeasurement, OptimizerRun, OutcomesResponse, PaidChannel } from "@/lib/api/growth";
import { paidFigureLabel } from "@/lib/visibility-funnel";
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
 * Learning narrow to one channel. ★AN ITEM'S CHANNELS ARE SENT, NOT GUESSED:
 * the api tags every ads action with its one `channel`, our own cards carry theirs,
 * and an item with none is about the business and stays under every chip.
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

/** True when an item about `channel` passes `filter`. No channel: the business's. */
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

/**
 * An amount beside its currency CODE — "USD 1,235" — the shape `paidNote` and
 * the conversions card already print, so one quantity never reads two ways on
 * one page. ★The currency's own decimals (JPY has none), and a code Intl
 * refuses still prints rather than taking the page down.
 */
export function codeMoney(amount: number, currency: string, wholeUnits = false): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      ...(wholeUnits ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
    })
      .format(amount)
      .replace(/\u00a0/g, " ");
  } catch {
    return `${currency} ${NUM.format(wholeUnits ? Math.round(amount) : amount)}`;
  }
}

export interface MeasurementBadge {
  label: string;
  tone: "success" | "warning" | "muted";
  /** What the badge means, for its tooltip and screen readers. */
  meaning: string;
}

// ★EACH MEANING CLAIMS ONLY WHAT D-02's STATE PROVES. `tracked` is a delivery
// receipt — Peakhour's latest conversion upload reached the platform whole —
// not a reconciliation of the two counts; `partial` is "no such receipt",
// which includes a receipt nobody could read, so it never says uploads failed.
const BADGES: Record<ChannelMeasurement, MeasurementBadge> = {
  tracked: {
    label: "Tracked",
    tone: "success",
    meaning: "It reports conversions, and Peakhour's latest conversion upload reached it in full.",
  },
  partial: {
    label: "Partial",
    tone: "warning",
    meaning:
      "It reports conversions, but Peakhour can't confirm its own conversion upload reaches it — the count may be the platform's pixel or tag alone.",
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
  else costPerConversion = codeMoney(priced.amount / ch.conversions, priced.currency);
  return {
    ...base,
    spend: priced === null ? "couldn't be totalled" : codeMoney(priced.amount, priced.currency, true),
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
  /** The ad channel it is about; absent for an item about the business. */
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

/** A stale-figures card: the api emits one per stale channel, `ads-stale-<platform>`. */
export function isStaleCard(id: string): boolean {
  return id.startsWith("ads-stale-");
}

/**
 * The api's next actions without each stale card whose channel has a
 * reconnect card — one fault, one card. ★READ FROM THE CARD'S OWN CHANNEL,
 * not from `reach.paid`: the api sends `paid: null` when nothing moved, which
 * is exactly the lapsed-token case. Kept when it names no channel, or one
 * without a reconnect card, because then it is the only thing saying so.
 */
export function withoutCoveredAdsStale<T extends { id: string; channel?: string }>(
  actions: readonly T[],
  reconnect: readonly NeedsYouItem[],
): T[] {
  // Never holds `undefined`, so a card naming no channel is never covered.
  const covered = new Set<string | undefined>(reconnect.flatMap((i) => (i.channel ? [i.channel] : [])));
  return actions.filter((a) => !(isStaleCard(a.id) && covered.has(a.channel)));
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

/** Free text as a sentence: its own closing stop kept, one added if missing. */
export function asSentence(text: string): string {
  const t = text.trim();
  return /[.!?…]["'”’)]*$/.test(t) ? t : `${t}.`;
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
        detail = `Expected: ${asSentence(p.expectedEffect)} ${UNMEASURED}`;
        when = p.appliedAt ?? p.decidedAt;
      } else if (p.status === "approved") {
        headline = `You approved: ${p.summary}`;
        detail = `Expected: ${asSentence(p.expectedEffect)} ${UNMEASURED}`;
        when = p.decidedAt;
      } else if (p.status === "dismissed") {
        headline = `You dismissed: ${p.summary}`;
        detail = `It expected: ${asSentence(p.expectedEffect)}`;
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

/**
 * What the Learning card says when its list is empty. ★UNDER A CHIP IT IS
 * ABOUT THAT CHANNEL: "nothing has been tried" while another channel has
 * applied changes is a false sentence about the business.
 */
export function learningEmptyText(filter: string): string {
  return filter === ALL_CHANNELS
    ? "Nothing has been tried yet. When an optimizer proposal is approved, applied, dismissed or fails, it's listed here with what it expected to do."
    : `Nothing has been tried on ${paidFigureLabel(filter)} yet.`;
}

/** The heading over the movements. ★IT CLAIMS NO COMPARISON: some movements
 *  compare the window with the one before it, and some (the engagement rate)
 *  describe the window alone. */
export function changedHeading(days: number): string {
  return `What changed in the last ${days} days`;
}
