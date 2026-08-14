"use client";

/**
 * The six numbers a post has, on one line, each one explained on hover —
 * and three of them are doors.
 *
 * ── ★ONE ROW, NOT TWO ────────────────────────────────────────────────
 * The previous strip split these across two lines, "reach" above and
 * "engagement" below. It reads as a taxonomy the viewer has to learn
 * before they can compare anything, and the wrap point moved with the
 * container, so the grouping it was meant to communicate was not even
 * stable. Six figures fit on one line at every width we support; below
 * that they wrap as a single flowing row, which is the honest behaviour
 * for a list of peers.
 *
 * ── ★ICONS NEED WORDS, AND A `title=` IS NOT THEM ────────────────────
 * A row of six glyphs is unreadable until you already know it. The old
 * strip leaned on the native `title` attribute, which does not appear on
 * keyboard focus, does not appear on touch at all, and takes about a
 * second to show — so for most people the icons were simply unlabelled.
 * Each metric now carries a real tooltip from the shared component, keyed
 * to the trigger, so it is reachable by keyboard and says what the number
 * MEANS rather than restating it.
 *
 * ── ★AND THE COUNT IS THE BUTTON ─────────────────────────────────────
 * Reactions, comments and reposts open their own dialog. There used to be
 * a separate "View engagement" control beside these numbers, which made
 * the numbers decoration: you read "24 comments", then looked elsewhere
 * for the way in, then chose a tab to get back to what you had already
 * pointed at. Pointing at it IS the way in now.
 *
 * A count of zero stays rendered but is not a button — an empty dialog is
 * a wasted click, and on reactions and comments it is a wasted LinkedIn
 * request against a ~500/day app-wide budget.
 */

import {
  Eye,
  MousePointerClick,
  TrendingUp,
  Heart,
  MessageSquare,
  Repeat2,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface MetricStripValues {
  impressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
}

/** What each icon means, in the words a person would use. Kept beside the
 *  icons rather than at the call site so the six explanations cannot drift
 *  apart, and so a seventh metric has an obvious home. */
const EXPLANATIONS = {
  impressions: "How many times this post appeared on someone's screen.",
  clicks: "Clicks on the post — links, images, “see more”, your page name.",
  engagement:
    "Reactions, comments, reposts and clicks as a share of impressions. A post seen 400 times with 20 comments is doing better than one seen 12,000 times with 3.",
  likes: "Reactions of every kind — Like, Celebrate, Love, Insightful, Support, Funny.",
  comments: "Comments and replies from people who saw this.",
  shares: "People who reposted this to their own network.",
} as const;

/**
 * Engagement over reach, or null when there is no reach to divide by.
 *
 * ★Null rather than 0. A post nobody saw has no rate — rendering "0.0%"
 * asserts a measured failure where there is only absence, and those are
 * different things to a person deciding what to write next.
 */
export function engagementRate(v: MetricStripValues): number | null {
  if (v.impressions <= 0) return null;
  return ((v.likes + v.comments + v.shares + v.clicks) / v.impressions) * 100;
}

/**
 * Whether a count is a door.
 *
 * A zero is not: an empty dialog is a wasted click, and on reactions and
 * comments it is a wasted LinkedIn request against a ~500/day budget
 * shared by every customer. Nor is anything on a post with no real URN,
 * where the only possible outcome is an error.
 */
export function opensDialog(count: number, canOpen: boolean): boolean {
  return canOpen && count > 0;
}

export function MetricStrip({
  values,
  onOpenReactions,
  onOpenComments,
  onOpenReposts,
  /** False when we cannot read engagement for this post — a post with no
   *  real URN. The counts still render; they just do not open anything,
   *  which is better than a dialog that can only fail. */
  canOpen,
}: {
  values: MetricStripValues;
  onOpenReactions: () => void;
  onOpenComments: () => void;
  onOpenReposts: () => void;
  canOpen: boolean;
}) {
  const rate = engagementRate(values);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground tabular-nums">
        <Metric icon={Eye} label="impressions" value={values.impressions} explain={EXPLANATIONS.impressions} />
        <Metric icon={MousePointerClick} label="clicks" value={values.clicks} explain={EXPLANATIONS.clicks} />
        {rate !== null && (
          <Metric
            icon={TrendingUp}
            label="engagement rate"
            display={`${rate.toFixed(1)}%`}
            // The precise figure belongs in the tooltip; the strip shows one
            // decimal so six numbers stay scannable.
            explain={`${rate.toFixed(2)}% — ${EXPLANATIONS.engagement}`}
          />
        )}
        <Metric
          icon={Heart}
          label="reactions"
          value={values.likes}
          explain={EXPLANATIONS.likes}
          {...(opensDialog(values.likes, canOpen) ? { onClick: onOpenReactions, action: "See who reacted" } : {})}
        />
        <Metric
          icon={MessageSquare}
          label="comments"
          value={values.comments}
          explain={EXPLANATIONS.comments}
          {...(opensDialog(values.comments, canOpen) ? { onClick: onOpenComments, action: "Read and reply" } : {})}
        />
        <Metric
          icon={Repeat2}
          label="reposts"
          value={values.shares}
          explain={EXPLANATIONS.shares}
          {...(opensDialog(values.shares, canOpen) ? { onClick: onOpenReposts, action: "See who reposted" } : {})}
        />
      </div>
    </TooltipProvider>
  );
}

/**
 * One metric — a span, or a button when it opens something.
 *
 * ★The element TYPE changes with the behaviour rather than a span
 * carrying an onClick. A clickable count has to be reachable by keyboard
 * and announced as a control, and `<button>` is the only thing that gets
 * all of that without re-implementing it.
 */
function Metric({
  icon: Icon,
  label,
  value,
  display,
  explain,
  onClick,
  action,
}: {
  icon: LucideIcon;
  label: string;
  /** Omitted for a derived metric that has no count of its own. */
  value?: number;
  /** Pre-formatted text, when the value is not a plain count. */
  display?: string;
  explain: string;
  onClick?: () => void;
  /** What the click does — appended to the tooltip so the affordance is
   *  stated rather than left to be discovered by hovering. */
  action?: string;
}) {
  const text = display ?? formatCount(value ?? 0);
  // The accessible name carries the FULL number; the visible text may be
  // abbreviated to "1.2k", which is not something to read out.
  const name = display ? `${display} ${label}` : `${(value ?? 0).toLocaleString()} ${label}`;

  const body = (
    <>
      <Icon className="size-3.5" aria-hidden />
      {text}
    </>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            aria-label={`${name} — ${action ?? "open"}`}
            className="flex items-center gap-1 rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {body}
          </button>
        ) : (
          <span className="flex items-center gap-1" aria-label={name}>
            {body}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium capitalize">{label}</p>
        <p className="mt-0.5 text-xs">{explain}</p>
        {action && <p className="mt-1 text-xs font-medium">{action} →</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
