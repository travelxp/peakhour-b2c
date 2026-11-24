import type { PlacementRow, ShortenedFor, VersionRow } from "@/lib/api/creative-studio";
import { PLATFORM_LIMITS } from "@/components/composer/types";
import { flattenMetaIntegration } from "@/lib/integrations-meta";
import { STUDIO_COPY } from "@/lib/studio-copy";

/**
 * Pure helpers for platform versions (UX spec S12) and the post step (S13). No React, no fetching: tested directly. Merchant words come from
 * `studio-copy.ts`.
 */

export interface StudioChannel {
  /** The key the ad-spec rows and the scheduler use. */
  key: string;
  label: string;
  /** The key the integrations list uses for the connection. */
  provider: string;
  /** The characters one caption may carry here, from the composer's own limits. */
  captionMax: number;
}

/**
 * The channels Studio posts a picture to: the ones the scheduler posts to with a picture and that have their own Connect screen. X is left out:
 * its posts have their own Peaks price and link rules in the X composer, and it has no verified picture sizes yet.
 */
export const STUDIO_CHANNELS: StudioChannel[] = [
  { key: "facebook", label: "Facebook", provider: "facebook_pages", captionMax: PLATFORM_LIMITS.facebook.maxChars },
  { key: "instagram", label: "Instagram", provider: "instagram", captionMax: PLATFORM_LIMITS.instagram.maxChars },
  { key: "linkedin", label: "LinkedIn", provider: "linkedin_content", captionMax: PLATFORM_LIMITS.linkedin.maxChars },
  { key: "threads", label: "Threads", provider: "threads", captionMax: PLATFORM_LIMITS.threads.maxChars },
];

export const channelByKey = (key: string): StudioChannel | undefined => STUDIO_CHANNELS.find((c) => c.key === key);
export const channelLabel = (key: string): string => channelByKey(key)?.label ?? key.charAt(0).toUpperCase() + key.slice(1);

/** The channels whose connection is live (the integrations list says `connected`). */
export function connectedChannelKeys(integrations: ReadonlyArray<{ provider: string; connected?: boolean }>): string[] {
  const live = new Set(integrations.filter((i) => i.connected === true).map((i) => i.provider));
  return STUDIO_CHANNELS.filter((c) => live.has(c.provider)).map((c) => c.key);
}

type RawIntegration = { provider: string; connected?: boolean; account?: { extra?: Record<string, unknown> } };

/**
 * The connected channels from the raw integrations list. The api keeps ONE `facebook` row for Meta; Facebook Pages and Instagram are the
 * virtual rows the app expands it into (as the Content hub and Integrations do), so the list is flattened before it is read.
 */
export const studioConnectedChannels = (raw: ReadonlyArray<RawIntegration>): string[] => connectedChannelKeys(flattenMetaIntegration([...raw]));

export interface ReadyVersion {
  id: string;
  key: string;
  channel: string;
  label: string;
  width: number;
  height: number;
}

/** The ticked sizes that are made now, with what the post step shows of each (channel, name, pixels), from the free draw's answer and the rows. */
export function readyVersions(rows: SizeRowModel[], ticked: ReadonlySet<string>, rendered: ReadonlyArray<VersionRow>): ReadyVersion[] {
  const fresh = new Map(rendered.map((v) => [v.key, v]));
  const out: ReadyVersion[] = [];
  for (const r of rows) {
    if (!ticked.has(r.placement.key)) continue;
    const v = fresh.get(r.placement.key) ?? r.version;
    if (v && (v.state === "ready" || v.state === "scheduled" || v.state === "published")) {
      out.push({ id: v.id, key: v.key, channel: r.placement.channel, label: r.placement.label, width: v.width, height: v.height });
    }
  }
  return out;
}

/** What each Ad Engine platform is called to a merchant (the handoff makes one ad per platform). */
const AD_PLATFORM_LABELS: Record<string, string> = {
  meta: "Facebook and Instagram",
  linkedin: "LinkedIn",
  google_ads: "Google",
  x: "X",
  tiktok: "TikTok",
};
/** The Ad Engine platform a Studio channel runs as (the api's own map): Facebook and Instagram are one, Threads has none. */
const AD_PLATFORM_OF: Record<string, string> = { facebook: "meta", instagram: "meta", linkedin: "linkedin", google_ads: "google_ads", x: "x", tiktok: "tiktok" };
export const adPlatformOf = (channel: string): string | undefined => AD_PLATFORM_OF[channel];
export const adPlatformLabel = (platform: string): string => AD_PLATFORM_LABELS[platform] ?? platform;

export type SizeState = "ready" | "needs_extend" | "extending" | "extend_failed" | "no_spec";

export interface SizeRowModel {
  placement: PlacementRow;
  version: VersionRow | undefined;
  state: SizeState;
}

/**
 * One row per size, from what the channel offers and what has already been made of this final. A size already made (or being made) says so; a
 * size with no verified row is disabled and says its sizes are not confirmed. The pixel size is only ever from a verified row.
 */
export function sizeRows(placements: PlacementRow[], versions: ReadonlyArray<VersionRow>): SizeRowModel[] {
  const byKey = new Map(versions.map((v) => [v.key, v]));
  return placements.map((placement) => {
    const version = byKey.get(placement.key);
    let state: SizeState;
    if (placement.kind === "no_spec") state = "no_spec";
    else if (version?.state === "extending") state = "extending";
    else if (version?.state === "extend_failed") state = "extend_failed";
    else if (version?.state === "needs_extend") state = "needs_extend";
    else if (version) state = "ready";
    else state = placement.kind;
    return { placement, version, state };
  });
}

/** Sizes ticked when the sheet opens: the ones that need nothing more (free). A size that costs Peaks is never ticked for the merchant. */
export const defaultTicked = (rows: SizeRowModel[]): Set<string> => new Set(rows.filter((r) => r.state === "ready").map((r) => r.placement.key));

export const isTickable = (r: SizeRowModel): boolean => r.state === "ready" || r.state === "needs_extend" || r.state === "extend_failed";

/** The ticked sizes that have no row yet: they are drawn first (free), which also tells which ones need more background. */
export const keysToRender = (rows: SizeRowModel[], ticked: ReadonlySet<string>): string[] =>
  rows.filter((r) => ticked.has(r.placement.key) && isTickable(r) && !r.version).map((r) => r.placement.key);

/** The ticked sizes that need more background (the quoted step), after the free draw said which ones those are. */
export function keysToExtend(rows: SizeRowModel[], ticked: ReadonlySet<string>, rendered: ReadonlyArray<VersionRow>): string[] {
  const needs = new Set(rendered.filter((v) => v.state === "needs_extend" || v.state === "extend_failed").map((v) => v.key));
  return rows
    .filter((r) => ticked.has(r.placement.key) && (r.state === "needs_extend" || r.state === "extend_failed" || needs.has(r.placement.key)))
    .map((r) => r.placement.key);
}

/** How many ticked sizes need more background: the count the extend quote is asked for. */
export const extendCount = (rows: SizeRowModel[], ticked: ReadonlySet<string>): number =>
  rows.filter((r) => ticked.has(r.placement.key) && (r.state === "needs_extend" || r.state === "extend_failed")).length;

/** The characters a caption holds, counted by letter (a Hindi or emoji character is one). */
export const captionLength = (text: string): number => Array.from(text).length;

export type CaptionProblem = "required" | "too_long" | null;
export function captionProblem(text: string, channel: string): CaptionProblem {
  if (!text.trim()) return "required";
  const max = channelByKey(channel)?.captionMax;
  return max !== undefined && captionLength(text) > max ? "too_long" : null;
}

/** The mediaUrls of one channel's post: the published copies of the sizes chosen for that channel, in the order chosen. */
export function mediaFor(
  channel: string,
  versions: ReadonlyArray<{ id: string; channel: string }>,
  media: ReadonlyArray<{ versionId: string; url: string }>,
): string[] {
  const urls = new Map(media.map((m) => [m.versionId, m.url]));
  return versions
    .filter((v) => v.channel === channel)
    .map((v) => urls.get(v.id))
    .filter((u): u is string => !!u);
}

/** The monthly limit as typed: a whole number of 1 or more, up to what the api keeps. */
export const MAX_MONTHLY_CAP = 10_000_000;
export function parseCap(input: string): { ok: true; value: number } | { ok: false; reason: "invalid" | "too_big" } {
  const t = input.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(t)) return { ok: false, reason: "invalid" };
  const n = Number(t);
  if (n < 1) return { ok: false, reason: "invalid" };
  if (n > MAX_MONTHLY_CAP) return { ok: false, reason: "too_big" };
  return { ok: true, value: n };
}

export interface MakeSizesResult {
  /** The sizes the free draw made or marked (empty when none was needed). */
  rendered: VersionRow[];
  /** The ticked sizes that are made now and can go to a post. */
  ready: ReadyVersion[];
  /** The free draw found a different number of sizes that need more background than the price shown covered: nothing was started, the price must be asked again. */
  requote: boolean;
  /** Set when the quoted step was refused or failed: nothing was charged, and the free sizes are still made. */
  extendError?: unknown;
  /** True when the quoted step was started (those sizes arrive on their own). */
  extendStarted: boolean;
}

/**
 * What Continue does, in its order: draw each ticked size (free; this also says which need more background), start the quoted step for those
 * (per size, one press), and name the sizes that can go on to a post now. A refusal of the quoted step is returned, not thrown, so the free
 * sizes stay chosen and the merchant is told why; a failure of the free draw is thrown (nothing was made).
 */
export async function makeSizes(a: {
  rows: SizeRowModel[];
  ticked: ReadonlySet<string>;
  render: (keys: string[]) => Promise<VersionRow[]>;
  extend: (keys: string[]) => Promise<unknown>;
  /** How many sizes the price on screen covers. */
  quotedUnits: number;
}): Promise<MakeSizesResult> {
  const toRender = keysToRender(a.rows, a.ticked);
  const rendered = toRender.length > 0 ? await a.render(toRender) : [];
  const toExtend = keysToExtend(a.rows, a.ticked, rendered);
  let extendError: unknown;
  let extendStarted = false;
  const ready = readyVersions(a.rows, a.ticked, rendered);
  // The receipt is good for exactly the sizes it was asked for: a different count (the renderer found one more) is a new price, never a guess.
  if (toExtend.length > 0 && toExtend.length !== a.quotedUnits) return { rendered, ready, extendStarted: false, requote: true };
  if (toExtend.length > 0) {
    try {
      await a.extend(toExtend);
      extendStarted = true;
    } catch (e) {
      extendError = e;
    }
  }
  return { rendered, ready, extendStarted, requote: false, ...(extendError !== undefined ? { extendError } : {}) };
}

/**
 * What an ad hand-off of words says when the platform's limits made some part shorter than it was written (never silent): one sentence per platform, naming the
 * parts in plain words. Nothing for a platform the words fitted, and a part this app has no plain word for is left out rather than shown as the api's key.
 */
export function shortenedLines(shortened: ReadonlyArray<ShortenedFor>): string[] {
  const names = STUDIO_COPY.post.shortenedParts;
  return shortened.flatMap((s) => {
    const parts = s.parts.map((p) => names[p]).filter((n): n is string => !!n);
    if (s.parts.length === 0) return [];
    return [parts.length > 0 ? STUDIO_COPY.post.adShortened(STUDIO_COPY.post.partsList(...parts), adPlatformLabel(s.platform)) : STUDIO_COPY.post.adShortenedSome(adPlatformLabel(s.platform))];
  });
}
