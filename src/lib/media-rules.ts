import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { adapterChannel } from "@/lib/drive/fit";

/**
 * What each place a file can go takes (PK-1), and how a file is judged against it.
 *
 * THE LIMITS ARE THE API'S. `GET /v1/media/rules` serves one table, built from the constraints adapters the publishers enforce (and the ad
 * and Inbox limits), so this module holds no number of its own: it reads the table and judges a file against a row. A screen names where the
 * file is going (`MediaDestination`) and the picker does the rest; no screen passes a type, a size or a count.
 */

export type AdPlacement = "meta_ad_image" | "google_ad_landscape" | "google_ad_square" | "google_ad_logo" | "google_demand_gen_logo";

export type MediaDestination =
  | { kind: "post"; channel: string; /** The video is being made as a Reel: the channel's Reel rule judges it, where it has one. */ as?: "reel" }
  | { kind: "presence"; channel: string }
  | { kind: "message"; channel: "whatsapp" }
  | { kind: "ad"; placement: AdPlacement }
  | { kind: "page"; use: "photo" | "document" };

export interface KindRule {
  formats: string[];
  minBytes?: number;
  maxBytes?: number;
  gifMaxBytes?: number;
  /** A GIF is refused unless it is the only attachment. */
  gifMustBeAlone?: boolean;
  minWidth?: number;
  minHeight?: number;
  aspect?: { min: number; max: number };
  minSeconds?: number;
  maxSeconds?: number;
  /** VIDEO and DOCUMENT: refused unless it is the only attachment (an Instagram Reel, a LinkedIn PDF carousel). */
  mustBeAlone?: boolean;
  /** DOCUMENT only: the fewest and the most pages. A file whose pages are not known is not refused for them. */
  minPages?: number;
  maxPages?: number;
}

export interface MediaRule {
  key: string;
  /** "an Instagram post": the place, for a sentence. */
  label: string;
  /** Absent when nobody states one: nothing is refused for the count. */
  maxCount?: number;
  image?: KindRule;
  video?: KindRule;
  /** Post rows only: the video judged as a short vertical Reel, where the channel has a rule for that (Facebook). Used when the destination says `as: "reel"`. */
  reel?: KindRule;
  document?: KindRule;
  /** Post rows only: present when the channel's API lets Peakhour add a first comment after the post is live. */
  firstComment?: { maxLength: number };
}

export type FileKind = "image" | "video" | "document";

/** The key the api's table names a destination by. A post channel is read through the same alias table the fit order uses (beehiiv is "newsletter"). */
export function destinationKey(d: MediaDestination): string {
  switch (d.kind) {
    case "post":
      return `post:${adapterChannel(d.channel)}`;
    case "presence":
      return `presence:${adapterChannel(d.channel)}`;
    case "message":
      return `message:${d.channel}`;
    case "ad":
      return `ad:${d.placement}`;
    case "page":
      return `page:${d.use}`;
  }
}

/** The adapter channel whose content-fit verdicts order the Drive tab, where the destination has one. */
export function fitChannelOf(d: MediaDestination): string | undefined {
  return d.kind === "post" || d.kind === "presence" ? adapterChannel(d.channel) : undefined;
}

export function fetchMediaRules(): Promise<MediaRule[]> {
  return api.get<{ rules: MediaRule[] }>("/v1/media/rules").then((r) => r.rules);
}

export const MEDIA_RULES_KEY = ["media-rules"] as const;

/** The rules table, read once and kept for a while (it changes only with a deploy, so a session that outlives one hears of it within ten minutes). */
export function useMediaRules() {
  return useQuery({ queryKey: MEDIA_RULES_KEY, queryFn: fetchMediaRules, staleTime: 10 * 60_000, gcTime: 60 * 60_000 });
}

/** The row as this destination reads it: a post made as a Reel is judged by the channel's Reel rule where there is one, else by its video rule. */
export function ruleForDestination(row: MediaRule, d: MediaDestination): MediaRule {
  return d.kind === "post" && d.as === "reel" && row.reel ? { ...row, video: { ...row.video, ...row.reel } } : row;
}

export type RuleState = { state: "loading" } | { state: "failed"; retry: () => void } | { state: "unknown" } | { state: "ready"; rule: MediaRule };

/** The row for one destination: ready, still loading, failed (retry offered), or a destination the api has no row for. */
export function useMediaRule(d: MediaDestination): RuleState {
  const q = useMediaRules();
  if (q.data) {
    const row = q.data.find((r) => r.key === destinationKey(d));
    return row ? { state: "ready", rule: ruleForDestination(row, d) } : { state: "unknown" };
  }
  if (q.isError) return { state: "failed", retry: () => void q.refetch() };
  return { state: "loading" };
}

// ── Judging a file ──────────────────────────────────────

/** What is known of a file. Dimensions and length are absent for a file nobody has measured. */
export interface FileFacts {
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  /** A document's pages, when they could be read. */
  pageCount?: number;
}

export type Verdict =
  | { state: "fits" }
  /** Cannot be used here, and nothing the person does to THIS file changes that (wrong type, too small, too short). */
  | { state: "refused"; reason: string }
  /** Cannot be used as it is, and a change to the file would fix it (crop it, make it smaller, trim it). `fix` says what. */
  | { state: "fixable"; reason: string; fix: string; /** What is wrong, so a caller never reads the sentence to find out. */ what: "size" | "shape" | "length" }
  /** Nothing refuses it, but a limit could not be checked (no dimensions or length on the file). */
  | { state: "unchecked"; reason: string };

export function kindOfMime(mime: string): FileKind | undefined {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("application/") || mime.startsWith("text/")) return "document";
  return undefined;
}

export const kindsOfRule = (rule: MediaRule): FileKind[] => (["image", "video", "document"] as const).filter((k) => rule[k] !== undefined);

/** The `accept` list of a file chooser for this place. */
export function acceptOf(rule: MediaRule): string {
  return kindsOfRule(rule)
    .flatMap((k) => rule[k]!.formats)
    .join(",");
}

/** How many more files can go here, given how many are already on the place. */
export const roomLeft = (rule: MediaRule, attached = 0): number => (rule.maxCount === undefined ? Infinity : Math.max(0, rule.maxCount - attached));

const NAME: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "video/mp4": "MP4",
  "video/quicktime": "MOV",
  "application/pdf": "PDF",
  "text/plain": "text",
};
const nameOf = (mime: string): string => NAME[mime] ?? mime.split("/")[1]?.replace(/^vnd\.[\w.-]*\./, "").toUpperCase() ?? mime;
const listOf = (mimes: string[]): string => {
  const names = [...new Set(mimes.map(nameOf))];
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
};

const mb = (b: number): string => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${Math.round((b / 1048576) * 10) / 10} MB`);
const ratio = (r: number): string => `${Math.round(r * 100) / 100}:1`;

/** The kinds this place takes, in words: "pictures", "pictures or videos". */
export function takesInWords(rule: MediaRule): string {
  const words = kindsOfRule(rule).map((k) => (k === "image" ? "pictures" : k === "video" ? "videos" : "documents"));
  return words.length <= 1 ? (words[0] ?? "files") : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;
}

/** One line on what a place takes, for the top of the Upload tab ("JPG or PNG, up to 8 MB"). Empty when nothing is worth saying. */
export function takesLine(rule: MediaRule): string {
  const parts: string[] = [];
  for (const k of kindsOfRule(rule)) {
    const r = rule[k]!;
    const bits = [listOf(r.formats)];
    if (r.maxBytes !== undefined) bits.push(`up to ${mb(r.maxBytes)}`);
    if (k === "video" && r.maxSeconds !== undefined) bits.push(`${r.maxSeconds >= 120 ? `${Math.round(r.maxSeconds / 60)} minutes` : `${r.maxSeconds} seconds`} at most`);
    if (k === "document" && r.maxPages !== undefined) bits.push(`${r.maxPages} pages at most`);
    parts.push(`${k === "image" ? "" : k === "video" ? "Videos: " : "Documents: "}${bits.join(", ")}`);
  }
  return parts.join(". ");
}

/** Judge a file against a place's rule, in plain words. Pure. */
export function judgeFile(rule: MediaRule, f: FileFacts): Verdict {
  const kind = kindOfMime(f.mimeType);
  const where = rule.label;
  const spec = kind ? rule[kind] : undefined;
  if (!kind || !spec) return { state: "refused", reason: `${cap(where)} takes ${takesInWords(rule)}, not this kind of file.` };
  if (!spec.formats.includes(f.mimeType)) return { state: "refused", reason: `${cap(where)} takes ${listOf(spec.formats)} files, not ${nameOf(f.mimeType)}.` };
  if (f.sizeBytes === 0) return { state: "refused", reason: "That file is empty." };
  const max = f.mimeType === "image/gif" && spec.gifMaxBytes !== undefined ? spec.gifMaxBytes : spec.maxBytes;
  if (max !== undefined && f.sizeBytes > max) {
    return kind === "image"
      ? { state: "fixable", what: "size", reason: `${cap(where)} takes files up to ${mb(max)}; this one is ${mb(f.sizeBytes)}.`, fix: "Save it at a smaller size, then add it again." }
      : { state: "refused", reason: `${cap(where)} takes files up to ${mb(max)}; this one is ${mb(f.sizeBytes)}.` };
  }
  if (spec.minBytes !== undefined && f.sizeBytes < spec.minBytes) return { state: "refused", reason: `${cap(where)} needs a file of at least ${mb(spec.minBytes)}; this one is ${mb(f.sizeBytes)}.` };
  let unknown = false;
  const needsPixels = spec.minWidth !== undefined || spec.minHeight !== undefined || spec.aspect !== undefined;
  if (needsPixels) {
    if (!f.width || !f.height) unknown = true;
    else {
      if (spec.minWidth !== undefined && f.width < spec.minWidth) return { state: "refused", reason: `${cap(where)} needs a picture at least ${spec.minWidth} px wide; this one is ${f.width} px.` };
      if (spec.minHeight !== undefined && f.height < spec.minHeight) return { state: "refused", reason: `${cap(where)} needs a picture at least ${spec.minHeight} px tall; this one is ${f.height} px.` };
      if (spec.aspect) {
        const r = f.width / f.height;
        if (r < spec.aspect.min || r > spec.aspect.max) {
          const from = ratio(spec.aspect.min);
          const to = ratio(spec.aspect.max);
          return {
            state: "fixable",
            what: "shape",
            reason: `${cap(where)} takes shapes from ${from} to ${to}; this one is ${ratio(r)}.`,
            fix: spec.aspect.min === spec.aspect.max || to === from ? `Crop it to ${to}, then add it again.` : `Crop it to a shape between ${from} and ${to}, then add it again.`,
          };
        }
      }
    }
  }
  if (spec.minSeconds !== undefined || spec.maxSeconds !== undefined) {
    if (f.durationSeconds === undefined) unknown = true;
    else {
      if (spec.maxSeconds !== undefined && f.durationSeconds > spec.maxSeconds) {
        return { state: "fixable", what: "length", reason: `${cap(where)} takes videos up to ${spec.maxSeconds} seconds; this one is ${Math.round(f.durationSeconds)}.`, fix: "Trim it, then add it again." };
      }
      if (spec.minSeconds !== undefined && f.durationSeconds < spec.minSeconds) return { state: "refused", reason: `${cap(where)} needs a video of at least ${spec.minSeconds} seconds.` };
    }
  }
  if (spec.minPages !== undefined || spec.maxPages !== undefined) {
    if (f.pageCount === undefined) unknown = true;
    else {
      if (spec.maxPages !== undefined && f.pageCount > spec.maxPages) return { state: "refused", reason: `${cap(where)} takes documents up to ${spec.maxPages} pages; this one has ${f.pageCount}.` };
      if (spec.minPages !== undefined && f.pageCount < spec.minPages) return { state: "refused", reason: `${cap(where)} needs a document of at least ${spec.minPages} page${spec.minPages === 1 ? "" : "s"}.` };
    }
  }
  return unknown ? { state: "unchecked", reason: "Its size, length or page count is not known yet, so the limits are not fully checked." } : { state: "fits" };
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Several files going to one place, judged TOGETHER: a platform that refuses a GIF, or a video, beside other files (the rule says so) is told the
 * sentence a merchant reads. `files` are what is being added or chosen; `attached` counts what the place already holds (a held file's type is
 * not known here, so any held file stops a GIF being added; the host knows the rest). Null when nothing is wrong.
 */
export function aloneProblem(rule: MediaRule, files: readonly FileFacts[], attached = 0): string | null {
  if (files.length + attached <= 1) return null;
  if (rule.image?.gifMustBeAlone && files.some((f) => f.mimeType === "image/gif")) return `A GIF has to be the only picture in ${rule.label}.`;
  if (rule.video?.mustBeAlone && files.some((f) => f.mimeType.startsWith("video/"))) return `A video has to be the only item in ${rule.label}.`;
  if (rule.document?.mustBeAlone && files.some((f) => kindOfMime(f.mimeType) === "document")) return `A document has to be the only item in ${rule.label}.`;
  return null;
}

/** The sentence a refused or fixable file shows. */
export function verdictText(v: Verdict): string | null {
  if (v.state === "refused") return v.reason;
  if (v.state === "fixable") return `${v.reason} ${v.fix}`;
  return null;
}
