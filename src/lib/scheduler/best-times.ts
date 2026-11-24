/**
 * The business's own best time to post, per channel (Content Wave 3, W3-C). Backed by GET /v1/content/best-times: the api works the time out of the business's own published
 * posts (a day and an hour in its own time zone, shown only when it has repeat history) and says whether a channel's figure is the business's own or the channel's typical one.
 * The words are made here, from that answer, so the composer and the calendar say the same thing.
 */
import { api } from "../api";
import { channelDisplayName } from "./format";

export interface BestTimeView {
  channel: string;
  /** `own`: from this business's posts. `typical`: not enough history yet. */
  source: "own" | "typical";
  timezone: string;
  /** "Tue 7 pm" for own, "8 am" for typical; null when the channel has neither. */
  label: string | null;
  /** How many of the business's own posts the figure comes from. */
  scoredPosts: number;
}

export interface BestTimesResponse {
  channels: BestTimeView[];
}

export const bestTimes = {
  get(channels: readonly string[]) {
    const query = channels.length > 0 ? `?channels=${encodeURIComponent(channels.join(","))}` : "";
    return api.get<BestTimesResponse>(`/v1/content/best-times${query}`);
  },
};

/**
 * "Your best time on LinkedIn: Tue 7 pm (from your last 31 posts)", or "Typical best time on LinkedIn: 8 am" while the business has no repeat history of its own.
 * Null when there is nothing to say (a channel that keeps no best time). PURE.
 */
export function bestTimeLine(view: BestTimeView | undefined, composerTimezone?: string): string | null {
  if (!view || !view.label) return null;
  // the label is on the BUSINESS's clock; when the composer shows another zone, say whose clock it is so nobody reads it in the wrong one
  const clock = view.timezone && composerTimezone && view.timezone !== composerTimezone ? `, ${view.timezone.replace(/_/g, " ")} time` : "";
  const name = channelDisplayName(view.channel);
  if (view.source === "own") {
    if (!Number.isInteger(view.scoredPosts) || view.scoredPosts < 1) return `Your best time on ${name}: ${view.label}${clock}`;
    const posts = view.scoredPosts === 1 ? "your last post" : `your last ${view.scoredPosts} posts`;
    return `Your best time on ${name}: ${view.label} (from ${posts}${clock})`;
  }
  return `Typical best time on ${name}: ${view.label}${clock}`;
}
