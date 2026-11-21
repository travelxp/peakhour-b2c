import type { HomeSummary, RailItem } from "@/hooks/use-home-summary";
import type { ScheduledItemDto, ScheduledItemStatus } from "@/lib/scheduler/types";

/**
 * The pure half of the Content home (/dashboard/content): which of the
 * summary's waiting items are about content, which scheduled posts are coming
 * up, and where "Post something" goes. The page only renders what these return.
 */

/** How many waiting items the home shows; the rest are one click away on Needs your OK. */
export const HOME_NEEDS_OK_LIMIT = 3;

/** The window "Coming up this week" covers. */
export const COMING_UP_DAYS = 7;

/**
 * A post due a moment ago that is still queued, retrying or going out is still
 * "coming up": hiding it would read as nothing scheduled while it is stuck.
 */
export const COMING_UP_GRACE_MS = 2 * 60 * 60 * 1000;

/** The most posts the home lists; the Calendar holds the rest. */
export const COMING_UP_LIMIT = 6;

/**
 * Where "Post something" opens the Compose sheet. The Calendar page owns the
 * sheet: `?compose=1` opens it with "pick a channel". (W1-C adds
 * `?compose=<channel>` to pre-pick one; nothing here needs it.)
 */
export const COMPOSE_HREF = "/dashboard/calendar?compose=1";

export interface ContentNeedsOk {
  /** The first {@link HOME_NEEDS_OK_LIMIT} content items, in the api's priority order. */
  top: RailItem[];
  /** Content items in the list the summary sent. */
  count: number;
  /**
   * The summary's list is capped and spans every pillar, so when it holds fewer
   * rows than the summary's own total there may be more content items than
   * `count` says. The page words the number "at least" then.
   */
  mayBeMore: boolean;
}

/**
 * The content part of GET /v1/home/summary's `needsYou`. A stopgap: the full
 * Needs your OK route (/dashboard/content/needs-ok) holds the complete,
 * paged list, and this reads from it once that is the shared source.
 */
export function contentNeedsOk(summary: Pick<HomeSummary, "needsYou" | "kpis">): ContentNeedsOk {
  const content = summary.needsYou.filter((i) => i.pillar === "content");
  return {
    top: content.slice(0, HOME_NEEDS_OK_LIMIT),
    count: content.length,
    mayBeMore: summary.kpis.needsYou > summary.needsYou.length,
  };
}

/** Statuses that mean "still going out". Published, failed and cancelled posts are not coming up. */
const UPCOMING_STATUSES: ReadonlySet<ScheduledItemStatus> = new Set([
  "queued",
  "awaiting_retry",
  "ready",
  "in_flight",
]);

/** The scheduled posts still due in the next {@link COMING_UP_DAYS} days, soonest first. */
export function comingUp(items: ScheduledItemDto[], now: Date, days = COMING_UP_DAYS): ScheduledItemDto[] {
  const from = now.getTime() - COMING_UP_GRACE_MS;
  const to = now.getTime() + days * 24 * 60 * 60 * 1000;
  return items
    .filter((i) => {
      if (!UPCOMING_STATUSES.has(i.status)) return false;
      const at = Date.parse(i.scheduledAtUtc);
      return Number.isFinite(at) && at >= from && at < to;
    })
    .sort((a, b) => Date.parse(a.scheduledAtUtc) - Date.parse(b.scheduledAtUtc));
}

/**
 * What the Drafts card says. "None" is only said when the summary loaded and
 * held nothing: a failed load, or a list that was capped before it reached the
 * content rows, is not an all-clear.
 */
export function draftsLine(drafts: ContentNeedsOk | undefined): string {
  if (!drafts) return "We couldn't check your drafts. Open the list to see what is waiting.";
  if (drafts.count > 0) {
    return `${drafts.mayBeMore ? "At least " : ""}${drafts.count} ${drafts.count === 1 ? "item is" : "items are"} waiting for your OK.`;
  }
  return drafts.mayBeMore ? "Other items are waiting for you. Open the list to see them." : "No drafts are waiting for you.";
}
