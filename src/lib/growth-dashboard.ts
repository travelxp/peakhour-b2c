import type { ChannelMeasurement, OptimizerRun, OutcomesResponse, PaidChannel } from "@/lib/api/growth";
import { paidFigureLabel } from "@/lib/visibility-funnel";
import { shortDate } from "@/lib/outcome-value";
import {
  ADS_CHANNELS,
  metaAdsConnectionState,
  type AdsIntegrationRow,
} from "@/app/(site)/dashboard/ads/ads-channels";

/**
 * D-03 — what the Unified Growth Dashboard's channel sections say, decided once
 * and tested here, so the page only lays it out (plan §6.1).
 *
 * ★CHANNEL IS A FILTER, NEVER A TAB. The funnel and "what changed" are about
 * the business, organic first, and never filter; Channels, Needs You and
 * Learning narrow to one channel. A Needs You item that belongs to no channel
 * (publish something, connect analytics) stays under every chip: a filter that
 * hid "nothing is being measured" would be the dashboard hiding a broken thing.
 *
 * ★ABSENT IS NEVER ZERO, here as on the rest of the page. A platform that
 * reports no conversions has no cost per conversion and no "0"; a source that
 * failed to load is named as unchecked, never rendered as "nothing needs you".
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

/** One channel, as the Channels section shows it. */
export function channelRow(ch: PaidChannel): ChannelRow {
  const money = ch.spend !== null && ch.currency ? ch.spend : null;
  let costPerConversion: string;
  if (ch.conversions === null) costPerConversion = "not measurable";
  else if (money === null) costPerConversion = "spend not totalled";
  else if (ch.conversions === 0) costPerConversion = "no conversions yet";
  else costPerConversion = `${ch.currency} ${(money / ch.conversions).toFixed(2)}`;
  return {
    platform: ch.platform,
    label: paidFigureLabel(ch.platform),
    spend: money === null ? "couldn't be totalled" : `${ch.currency} ${NUM.format(Math.round(money))}`,
    conversions: ch.conversions === null ? "not reported" : NUM.format(ch.conversions),
    costPerConversion,
    badge: ch.measurement ? BADGES[ch.measurement] : null,
    note: ch.stale
      ? `stopped updating${ch.lastReadAt ? ` — last read ${shortDate(ch.lastReadAt)}` : ""}`
      : null,
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

/**
 * One item per ads channel whose connection needs reconnecting — and none for
 * a channel that also has a live connection, which is still working.
 */
export function reconnectItems(integrations: readonly AdsIntegrationRow[]): NeedsYouItem[] {
  const items: NeedsYouItem[] = [];
  for (const c of ADS_CHANNELS) {
    const state =
      c.key === "meta"
        ? metaAdsConnectionState(integrations)
        : integrations.some((i) => i.provider === c.providerKey && i.connected === true)
          ? "connected"
          : integrations.some((i) => i.provider === c.providerKey && i.status === "needs_reauth")
            ? "needs_reauth"
            : "absent";
    if (state !== "needs_reauth") continue;
    items.push({
      id: `reconnect-${c.key}`,
      severity: "critical",
      title: `Reconnect ${c.label}`,
      detail: "Peakhour's access to it has lapsed. Until you reconnect, its figures here can fall out of date.",
      href: `/dashboard/ads?channel=${c.key}`,
      cta: "Reconnect",
      channel: c.key,
    });
  }
  return items;
}

/**
 * Which Needs You sources could not be read. Named, because an empty list
 * after a failed read is a claim that nothing needs the merchant — and nobody
 * checked.
 */
export function uncheckedNote(failed: { proposals: boolean; connections: boolean }): string | null {
  const what = [
    failed.proposals ? "optimizer proposals" : null,
    failed.connections ? "your ad connections" : null,
  ].filter(Boolean);
  return what.length > 0 ? `We couldn't check ${what.join(" or ")} just now.` : null;
}

export interface LearningItem {
  id: string;
  channel: string;
  when: string | null;
  headline: string;
  detail: string;
}

/**
 * What was tried, newest first: every optimizer proposal that was applied,
 * dismissed or failed. ★AN APPLIED CHANGE SAYS ITS EFFECT IS NOT MEASURED,
 * because nothing measures it yet — the experiment ledger that would record
 * "what it did" is C-03's, and a line implying the change worked would be the
 * dashboard narrating something no number beside it supports.
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
        detail = `Expected: ${p.expectedEffect}. What it actually did isn't measured yet.`;
        when = p.appliedAt ?? p.decidedAt;
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
        when: when ? shortDate(when) : null,
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
