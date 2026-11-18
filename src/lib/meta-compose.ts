/**
 * The rules of "write a new post" for the Meta channels (Facebook, Instagram, Threads), kept where a test can reach them: this
 * repo runs vitest without a browser for logic, and a rule inside a component is a rule nothing asserts.
 *
 *  - WHICH channels the merchant may start a post on (only the ones they have connected), and who the post goes out as.
 *  - WHAT each channel refuses, in plain words, before the merchant presses Publish. The api refuses the same things at commit
 *    (`publisher.validate` in peakhour-api `adapters/publisher/{facebook,instagram,threads}.ts`), so a wrong answer here costs a
 *    clear message from the server, never a bad post.
 *  - WHAT is sent: one channel's payload for the scheduler, which both "Publish now" and "Schedule" go through.
 *
 * ★WHICH PAGE OR ACCOUNT A POST GOES TO IS NOT DECIDED HERE. The publisher resolves it from the saved connection (see
 * `savedPageOf` below, the only place this file reads it, and only to NAME it on screen). Nothing here sends a page id.
 */

import { flattenMetaIntegration } from "@/lib/integrations-meta";
import { navLabel } from "@/lib/nav-copy";

export type MetaComposeChannel = "facebook" | "instagram" | "threads";

export const META_COMPOSE_CHANNELS: readonly MetaComposeChannel[] = ["facebook", "instagram", "threads"];

export function isMetaComposeChannel(channel: string): channel is MetaComposeChannel {
  return (META_COMPOSE_CHANNELS as readonly string[]).includes(channel);
}

/** The sidebar's current name for /dashboard/integrations (the retired-names test refuses the old one). */
export const CONNECTED_ACCOUNTS_LABEL = navLabel("/dashboard/integrations");

export interface MetaChannelRules {
  label: string;
  /** What the picker says under the name. */
  blurb: string;
  /** Characters the channel allows. */
  maxChars: number;
  /** Hashtags the channel allows in one post, when it counts them. */
  maxHashtags?: number;
  /** How many pictures or videos one post can carry. */
  maxMedia: number;
  /** True when a post with no picture or video is refused (Instagram). */
  mediaRequired: boolean;
  /** What the Drive picker may offer. */
  mediaKinds: readonly ("image" | "video")[];
  /** Whether the post can carry a link of its own. */
  link: boolean;
  /** What Drive calls the destination: "a Facebook post". */
  driveLabel: string;
}

export const META_COMPOSE_RULES: Record<MetaComposeChannel, MetaChannelRules> = {
  facebook: {
    label: "Facebook",
    blurb: "A post on your Facebook Page",
    maxChars: 63_206,
    maxMedia: 10,
    mediaRequired: false,
    mediaKinds: ["image"],
    link: true,
    driveLabel: "a Facebook post",
  },
  instagram: {
    label: "Instagram",
    blurb: "A picture or video post on your Instagram account",
    maxChars: 2200,
    maxHashtags: 30,
    maxMedia: 10,
    mediaRequired: true,
    mediaKinds: ["image", "video"],
    link: false,
    driveLabel: "an Instagram post",
  },
  threads: {
    label: "Threads",
    blurb: "A short post on your Threads profile",
    maxChars: 500,
    maxMedia: 20,
    mediaRequired: false,
    mediaKinds: ["image"],
    link: false,
    driveLabel: "a Threads post",
  },
};

// ── Counting ──────────────────────────────────────────────────────────────

const EMOJI = /\p{Emoji_Presentation}|️/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
function isEmoji(segment: string): boolean {
  if (EMOJI.test(segment)) return true;
  if (!PICTOGRAPHIC.test(segment)) return false;
  return [...segment].some((ch) => ch.codePointAt(0)! >= 0x2600 && PICTOGRAPHIC.test(ch));
}

/**
 * How Threads counts a post against its 500 limit: an emoji counts as its UTF-8 bytes, everything else as one. The same count the api
 * refuses on (`threadsTextLength` in peakhour-api `helpers/threads.ts`), so the counter on screen and the server cannot disagree.
 */
export function threadsTextLength(text: string): number {
  const encoder = new TextEncoder();
  let n = 0;
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
    n += isEmoji(segment) ? encoder.encode(segment).length : 1;
  }
  return n;
}

/** The length the channel holds against its limit. */
export function metaTextLength(channel: MetaComposeChannel, text: string): number {
  return channel === "threads" ? threadsTextLength(text) : text.length;
}

/** Hashtags as Instagram counts them: a `#` that starts a word, followed by a letter, digit or underscore. */
export function countHashtags(text: string): number {
  return text.match(/(?<![\p{L}\p{N}_#])#[\p{L}\p{N}_]+/gu)?.length ?? 0;
}

// ── Validation ────────────────────────────────────────────────────────────

export interface MetaMedia {
  url: string;
  mime: string;
}

export interface MetaDraft {
  text: string;
  media: readonly MetaMedia[];
  /** Facebook only. */
  link: string;
}

const isVideo = (m: MetaMedia) => m.mime.startsWith("video/");

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * What stops this post going out, in plain words. Empty means it can be sent. Every line is something the api would also refuse;
 * the order is the order a person fixes them in.
 */
export function metaPostProblems(channel: MetaComposeChannel, draft: MetaDraft): string[] {
  const rules = META_COMPOSE_RULES[channel];
  const out: string[] = [];
  const text = draft.text.trim();
  const media = draft.media;

  if (text === "") out.push(channel === "instagram" ? "Write a caption for your post." : "Write something to post.");
  if (rules.mediaRequired && media.length === 0) {
    out.push(`${rules.label} posts need ${rules.mediaKinds.includes("video") ? "a picture or a video" : "a picture"}. Add one from Drive.`);
  }
  if (media.length > rules.maxMedia) out.push(`${rules.label} takes up to ${rules.maxMedia} pictures in one post. Remove ${media.length - rules.maxMedia}.`);
  if (media.some(isVideo)) {
    if (!rules.mediaKinds.includes("video")) out.push(`${rules.label} posts from here take pictures only. Remove the video.`);
    else if (media.length > 1) out.push("A video goes on its own. Remove the other items, or use pictures only.");
  }
  const length = metaTextLength(channel, draft.text);
  if (length > rules.maxChars) {
    out.push(`${rules.label} allows ${rules.maxChars.toLocaleString("en-US")} characters. This is ${length.toLocaleString("en-US")}.`);
  }
  if (rules.maxHashtags !== undefined) {
    const tags = countHashtags(draft.text);
    if (tags > rules.maxHashtags) out.push(`${rules.label} allows ${rules.maxHashtags} hashtags. This has ${tags}.`);
  }
  if (channel === "facebook" && draft.link.trim() !== "") {
    if (!isHttpUrl(draft.link.trim())) out.push("The link needs to start with http:// or https://.");
    else if (media.length > 0) out.push("A link can't go with pictures. Remove the pictures, or the link.");
  }
  return out;
}

// ── What is sent ──────────────────────────────────────────────────────────

/** The scheduler's channel entry for this post: the same shape "Schedule" and "Publish now" both send. */
export function buildMetaChannel(channel: MetaComposeChannel, draft: MetaDraft) {
  const link = channel === "facebook" ? draft.link.trim() : "";
  return {
    channel,
    payload: {
      text: draft.text.trim(),
      ...(draft.media.length > 0 ? { mediaUrls: draft.media.map((m) => m.url) } : {}),
      ...(link !== "" ? { channelOptions: { link } } : {}),
    },
  };
}

/** A short title for the calendar: the first line of the post. */
export function metaPostTitle(text: string): string | undefined {
  const first = text.trim().split(/\r?\n/).find((l) => l.trim().length > 0);
  return first ? first.slice(0, 120).trim() : undefined;
}

// ── Who the post goes out as ──────────────────────────────────────────────

/** Just enough of `GET /v1/integrations` to name the Page, the Instagram account and the Threads profile. */
export interface MetaIntegrationRow {
  provider: string;
  connected?: boolean;
  account?: {
    name?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extra?: Record<string, any>;
  };
  metaLogin?: { content?: boolean; ads?: boolean };
  metaConnections?: Array<{ purpose: "content" | "ads" | null; status?: string }>;
}

export interface MetaComposeTarget {
  channel: MetaComposeChannel;
  /** "Posting to Acme Bakery" / "Posting to @acme on Instagram". Null when the row does not say. */
  postingTo: string | null;
}

interface StoredPage {
  pageId?: string;
  pageName?: string;
  instagramAccountId?: string;
  instagramUsername?: string;
}

/**
 * The Page the connection has saved, to NAME it on screen: the stored primary Page, else the first Page. The publisher is the one that
 * decides where a post lands; this only tells the merchant the name it will find.
 */
export function savedPageOf(extra: Record<string, unknown> | undefined): StoredPage | undefined {
  const pages = Array.isArray(extra?.pages) ? (extra.pages as StoredPage[]) : [];
  const primary = typeof extra?.primaryPageId === "string" ? extra.primaryPageId : undefined;
  return pages.find((p) => primary !== undefined && p.pageId === primary) ?? pages[0];
}

/** The Page that carries the saved Instagram account, else the first with one. */
export function savedInstagramOf(extra: Record<string, unknown> | undefined): StoredPage | undefined {
  const pages = Array.isArray(extra?.pages) ? (extra.pages as StoredPage[]) : [];
  const saved = typeof extra?.instagramAccountId === "string" ? extra.instagramAccountId : undefined;
  return pages.find((p) => saved !== undefined && p.instagramAccountId === saved) ?? pages.find((p) => p.instagramAccountId);
}

/**
 * The Meta channels this merchant can start a post on: the ones they have connected, in picker order. Facebook and Instagram ride one
 * `facebook` connection, so each is judged by its own card (`flattenMetaIntegration`, the expansion Connected accounts and the
 * content hub already use), and Threads by its own connection.
 */
export function metaComposeTargets(integrations: readonly MetaIntegrationRow[] | undefined): MetaComposeTarget[] {
  const flat = flattenMetaIntegration([...(integrations ?? [])]);
  const row = (provider: string) => flat.find((i) => i.provider === provider && i.connected === true);
  const out: MetaComposeTarget[] = [];

  const fb = row("facebook_pages");
  if (fb) {
    const name = savedPageOf(fb.account?.extra)?.pageName;
    out.push({ channel: "facebook", postingTo: name ? `Posting to ${name}` : null });
  }
  const ig = row("instagram");
  if (ig) {
    const page = savedInstagramOf(ig.account?.extra);
    const handle = page?.instagramUsername ? `@${page.instagramUsername}` : undefined;
    out.push({
      channel: "instagram",
      postingTo: handle ? `Posting to ${handle}` : page?.pageName ? `Posting to the Instagram account linked to ${page.pageName}` : null,
    });
  }
  const th = row("threads");
  if (th) {
    const handle = typeof th.account?.extra?.username === "string" ? `@${th.account.extra.username}` : th.account?.name;
    out.push({ channel: "threads", postingTo: handle ? `Posting to ${handle}` : null });
  }
  return out;
}

// ── After it is published ─────────────────────────────────────────────────

/**
 * Where the merchant can see the post they just published: the hub for Facebook and Instagram (which lists the account's latest
 * posts), the post itself for Threads (it has no hub yet), and the calendar when the post has no address yet.
 */
export function publishedLink(channel: MetaComposeChannel, externalUrl: string | undefined): { href: string; label: string; external: boolean } {
  if (channel === "threads") {
    return externalUrl
      ? { href: externalUrl, label: "View on Threads", external: true }
      : { href: "/dashboard/calendar", label: "Open the calendar", external: false };
  }
  return { href: `/dashboard/content/${channel}`, label: `See your latest ${META_COMPOSE_RULES[channel].label} posts`, external: false };
}
