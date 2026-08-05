import type {
  AudienceChannel,
  AudienceHypothesisAttribute,
  AudienceSet,
  AudienceSource,
} from "@/lib/api/audiences";

/**
 * The decisions the audience library makes, extracted so they can be tested.
 *
 * This repo has no DOM test environment on purpose (`vitest.config.ts`:
 * node-only until a primitive genuinely needs jsdom), so rendering is not what
 * gets asserted. What CAN be got wrong without a DOM — and what would be
 * invisible in review — is the judgement, and on this surface the judgement is
 * almost entirely about ABSENCES:
 *
 *   - a channel nobody has asked, versus one that cannot express the audience;
 *   - a reach we do not have, versus a reach of zero;
 *   - an audience the engine suggested, versus one the customer told us.
 *
 * Collapsing any of those is the failure this whole engine is built not to
 * commit, and each collapse is one line of JSX away.
 */

/**
 * Where an audience came from, in the customer's terms.
 *
 * ★THE BRIEF'S OWN DISTINCTION AND IT MUST BE VISIBLE. "Peakhour inferred" and
 * "user inferred" are the difference between a suggestion and a fact about the
 * business: `generated`/`fallback` is something we thought of, `imported` is
 * something they actually ran with their own money, and `user_defined` is
 * something they sat down and wrote — usually while disagreeing with a
 * proposal we had just shown them, which the design calls the best signal this
 * engine ever gets.
 */
export function originLabel(source: AudienceSource): string {
  switch (source) {
    case "imported":
      return "From your past campaigns";
    case "user_defined":
      return "You built this";
    case "fallback":
    case "generated":
    default:
      return "Peakhour suggested";
  }
}

/** Whether the origin is OURS. Drives the badge's tone: a suggestion is not
 *  the same kind of thing as a record of what they did. */
export function originIsOurs(source: AudienceSource): boolean {
  return source === "generated" || source === "fallback";
}

/** Business-language attribute names. An unknown attribute renders under its
 *  own id rather than vanishing — a silent omission makes a narrower audience
 *  look complete, which is the one thing this surface must not do. Same map as
 *  the campaign audience card, kept in step deliberately. */
const ATTRIBUTE_LABEL: Record<string, string> = {
  geo: "Location",
  company_industry: "Industry",
  company_size: "Company size",
  job_title: "Job title",
  seniority: "Seniority",
  job_function: "Job function",
  member_interest: "Interests",
  company_name: "Companies",
  school: "Schools",
  skill: "Skills",
  degree: "Degrees",
  years_experience: "Years of experience",
  member_behaviour: "Behaviour",
  company_follower: "Followers",
  custom_audience: "Your own lists",
  lookalike: "Lookalikes",
};

export function attributeLabel(attribute: string): string {
  return ATTRIBUTE_LABEL[attribute] ?? attribute.replace(/_/g, " ");
}

/** Channel display names. Unknown platforms render under their own key rather
 *  than being hidden — a channel we cannot name is still a channel this
 *  audience works on. */
const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  x: "X",
  meta: "Meta",
  google_ads: "Google Ads",
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

/**
 * The shape of the audience, in business language, ready to render as chips.
 *
 * ★THE HYPOTHESIS, NEVER A RESOLUTION. A channel's `basis` holds what THAT
 * channel managed to bind — so rendering it would shrink the audience to
 * whatever LinkedIn happened to match, and an audience narrowing by being
 * looked at is the exact failure the channel-neutral shape exists to end.
 *
 * An imported set has no hypothesis at all (its criteria are the platform's
 * own), and that is a real answer rather than an empty one: the caller says so
 * instead of drawing nothing.
 */
export function audienceShape(
  set: Pick<AudienceSet, "hypothesis">,
): Array<{ attribute: string; label: string; values: string[] }> {
  return (set.hypothesis?.attributes ?? [])
    .filter((a: AudienceHypothesisAttribute) => a.values?.length)
    .map((a) => ({ attribute: a.attribute, label: attributeLabel(a.attribute), values: a.values }));
}

/**
 * ★A FIXED LOCALE, not the ambient one, for the reason `audience-card-rules`
 * gives at length: `toLocaleString()` groups by whatever locale the runtime
 * has, so the same number renders differently on the server and in the browser
 * and React reports a hydration mismatch.
 */
const REACH_FORMAT = new Intl.NumberFormat("en-US");

/** How big this audience is on a channel — or WHY there is no number. */
export type ReachReading =
  | { kind: "counted"; text: string }
  /** The platform masked the count because the audience is under its serving
   *  floor. There is no figure to show and there never was one. */
  | { kind: "below_floor"; text: string }
  /** We do not have a size. NOT zero, and NOT a claim about the channel —
   *  "the platform publishes no count" and "our call for it failed" are the
   *  same fact from the customer's side, and the api reports them identically
   *  on purpose. */
  | { kind: "unknown"; text: string };

export function reachReading(channel: AudienceChannel): ReachReading {
  // Order matters: "we have no number" outranks any reading of one, so a
  // `{reachSupported: false, reachValue: 0}` can never claim a floor.
  if (!channel.reachSupported || typeof channel.reachValue !== "number") {
    return {
      kind: channel.belowFloor ? "below_floor" : "unknown",
      text: channel.belowFloor
        ? `Too small for ${platformLabel(channel.platform)} to count`
        : `No size from ${platformLabel(channel.platform)}`,
    };
  }
  if (channel.belowFloor || channel.reachValue === 0) {
    // ★A LITERAL ZERO IS THE FLOOR, NOT A COUNT. LinkedIn's masked `total: 0`
    // means "fewer than 300"; the api maps it to `belowFloor` with no number,
    // so a zero arriving here means something upstream changed — and "0
    // people" is the exact sentence this file exists to prevent.
    return {
      kind: "below_floor",
      text: `Too small for ${platformLabel(channel.platform)} to count`,
    };
  }
  return {
    kind: "counted",
    text: `${REACH_FORMAT.format(channel.reachValue)} on ${platformLabel(channel.platform)}`,
  };
}

/**
 * What a channel row should say beyond its reach, or null.
 *
 * ★`stale` IS ONLY ACTIONABLE WHEN THE AUDIENCE CAN BE RE-EXPRESSED. An
 * imported set carries no hypothesis: its criteria are a record of what somebody
 * actually ran, there is nothing to re-derive, and nothing it could be out of
 * date WITH. Showing "may be out of date" over it would invite an action that
 * does not exist — which is exactly the collapse the api's own
 * `rematerialisable` flag was added to prevent.
 */
export function channelNote(channel: AudienceChannel): string | null {
  if (channel.droppedAttributes > 0) {
    const n = channel.droppedAttributes;
    return `${n} thing${n === 1 ? "" : "s"} ${platformLabel(channel.platform)} can't express`;
  }
  if (channel.stale && channel.rematerialisable) return "May be out of date";
  return null;
}

/** Every channel this business can advertise on, whether or not this audience
 *  has been resolved against it. The library's own rows carry only the ones
 *  that HAVE been asked. */
export const LIBRARY_CHANNELS = ["linkedin", "x"] as const;

/**
 * The channels nobody has asked about this audience.
 *
 * ★THIS IS A FIRST-CLASS ANSWER AND NOT AN EMPTY ONE. "We haven't looked at X
 * for this audience" is a different sentence from "it doesn't work on X", and
 * rendering the second when the first is true claims something about a
 * customer's reach on a channel nobody has queried. It is also the affordance:
 * the unasked channel is exactly the one worth offering to check.
 */
export function unaskedChannels(
  set: Pick<AudienceSet, "channels">,
  known: readonly string[] = LIBRARY_CHANNELS,
): string[] {
  const asked = new Set(set.channels.map((c) => c.platform));
  return known.filter((p) => !asked.has(p));
}

/**
 * What has HAPPENED to this audience, in one line, or null when nothing has.
 *
 * ★`discarded` OUTRANKS EVERYTHING, INCLUDING AN OUTCOME. A discarded audience
 * that once ran is a rejection with history, and leading with its click-through
 * rate would read as a recommendation.
 */
export function historyLine(set: Pick<AudienceSet, "status" | "userEdits" | "discardReason">): string | null {
  const edits = set.userEdits?.length ?? 0;
  const corrected = edits > 0 ? `corrected ${edits} time${edits === 1 ? "" : "s"}` : null;
  if (set.status === "discarded") {
    return set.discardReason
      ? `You discarded this — "${set.discardReason}"`
      : "You discarded this";
  }
  if (set.status === "superseded") {
    return corrected ? `Replaced by a newer audience, ${corrected}` : "Replaced by a newer audience";
  }
  if (set.status === "applied") {
    return corrected ? `On a campaign, ${corrected}` : "On a campaign";
  }
  return corrected ? `Suggested, ${corrected}` : null;
}

/**
 * The one-line performance summary, or null when the audience has never run.
 *
 * ★A RATIO OVER ZERO IMPRESSIONS IS NOT ZERO. The api omits `ctr` when nothing
 * served, precisely so a set whose campaign never delivered is not ranked below
 * one that genuinely underperformed — and a client that filled in "0.0%" would
 * undo that in the one number a customer reads as a verdict.
 *
 * ★AND THE FIGURES ARE COPIED FROM THE CAMPAIGNS, NOT MEASURED HERE. The
 * caller says so; this only decides what may be shown.
 */
export function outcomeLine(outcome: AudienceSet["outcome"]): string | null {
  if (!outcome) return null;
  const parts: string[] = [`${REACH_FORMAT.format(outcome.impressions)} impressions`];
  if (typeof outcome.ctr === "number") {
    parts.push(`${(outcome.ctr * 100).toFixed(2)}% clicked`);
  } else if (outcome.impressions === 0) {
    // Said rather than left blank: "it never served" and "it served and nobody
    // clicked" are different facts about an audience.
    parts.push("never served");
  }
  if (typeof outcome.spend === "number" && outcome.currency) {
    parts.push(`${outcome.currency} ${REACH_FORMAT.format(Math.round(outcome.spend))} spent`);
  }
  return parts.join(" · ");
}
