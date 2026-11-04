import type { ChannelFitEntry, DriveFile, FitVerdict } from "./files";

/**
 * What the Drive picker says about each file for the place it is being added to (row D7). Pure: no api, no DOM.
 *
 * The verdicts are the api's (`channelFit`, row D5b), never recomputed here: the channel's hard limits live in the server's constraints
 * adapters, and a second copy in the browser could only drift. The picker orders by them and says them in plain words.
 */

/** Scheduler and composer channel names that differ from the constraints adapters' keys. */
const ADAPTER_KEY: Readonly<Record<string, string>> = {
  beehiiv: "newsletter",
  google_business: "googlebusiness",
  google_business_profile: "googlebusiness",
  "google-business-profile": "googlebusiness",
};

/** The key the api's constraints adapters know a channel by. */
export function adapterChannel(channel: string): string {
  const k = channel.trim().toLowerCase();
  return ADAPTER_KEY[k] ?? k;
}

export type FitTone = "good" | "warn" | "muted";

export interface FitNote {
  /** What the tile says under the name. Empty when the picker was opened for no particular place. */
  label: string;
  tone: FitTone;
  /** The api's own sentence for a "possible" or "poor" verdict, for the tooltip and screen readers. */
  reason?: string;
  /** 0 first. Ordering key: fits, maybe fits, not checked, doesn't fit. */
  rank: 0 | 1 | 2 | 3;
  verdict: FitVerdict | "unchecked" | "checking" | "none";
}

const DESCRIBING = new Set(["pending", "describing"]);

export function fitNote(file: Pick<DriveFile, "channelFit" | "describeState">, channel: string | undefined): FitNote {
  if (!channel) return { label: "", tone: "muted", rank: 2, verdict: "none" };
  const key = adapterChannel(channel);
  const entry: ChannelFitEntry | undefined = file.channelFit?.find((e) => e.channel === key);
  if (entry) {
    const reason = entry.reason;
    if (entry.fit === "good") return { label: "Fits", tone: "good", rank: 0, verdict: "good", ...(reason ? { reason } : {}) };
    if (entry.fit === "possible") return { label: "Check before using", tone: "warn", rank: 1, verdict: "possible", ...(reason ? { reason } : {}) };
    return { label: "Doesn't fit", tone: "warn", rank: 3, verdict: "poor", ...(reason ? { reason } : {}) };
  }
  if (file.describeState && DESCRIBING.has(file.describeState)) return { label: "Checking fit…", tone: "muted", rank: 2, verdict: "checking" };
  return { label: "Not checked yet", tone: "muted", rank: 2, verdict: "unchecked" };
}

/** Best fit first; files of equal fit keep the order the api sent (newest first). */
export function orderByFit<T extends Pick<DriveFile, "channelFit" | "describeState">>(files: readonly T[], channel: string | undefined): T[] {
  if (!channel) return [...files];
  return files
    .map((f, i) => ({ f, i, rank: fitNote(f, channel).rank }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.f);
}

/** True when at least one file carries a verdict for the channel, so "fits first" is a claim the grid can keep. */
export function anyVerdict(files: readonly Pick<DriveFile, "channelFit" | "describeState">[], channel: string | undefined): boolean {
  if (!channel) return false;
  return files.some((f) => {
    const v = fitNote(f, channel).verdict;
    return v === "good" || v === "possible" || v === "poor";
  });
}

/** "an Instagram post", "a LinkedIn post": the words the picker's line uses for where a file is going. */
export function targetLabel(channelName: string): string {
  const name = channelName.trim();
  return `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name} post`;
}

/** Why a Private file cannot be added where a public link is needed. */
export const PRIVATE_NEEDS_PUBLIC =
  "Private files have no public link, and this needs one. Publish the file in Drive to use it here.";
