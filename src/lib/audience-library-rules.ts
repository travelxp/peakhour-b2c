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
      // ★NOT "Peakhour suggested", AND THE REASON IS THE FILTER. The api takes
      // ONE `source` value, so a badge that says the same thing for two enum
      // members leaves the second reachable from no option in any dropdown: a
      // customer filtering to "Peakhour suggested" loses a row badged
      // "Peakhour suggested", which is the accepted-then-ignored-filter failure
      // this surface exists to avoid.
      //
      // It is also a real distinction rather than a workaround. `fallback` is
      // the deterministic geography × industry set every plan carries — the
      // one the strategist's ideas are MEASURED AGAINST — so saying which one
      // it is tells the customer more, not less.
      return "Peakhour baseline";
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

/**
 * Business-language attribute names, from the collection's own
 * `zTargetingAttribute` enum.
 *
 * An unknown attribute renders under its own id rather than vanishing — a
 * silent omission makes a narrower audience look complete, which is the one
 * thing this surface must not do.
 *
 * ★AND THE CAMPAIGN AUDIENCE CARD READS THIS ONE. It used to carry its own
 * nine-key copy, and a comment here claimed the two were "kept in step" while
 * this map grew to thirty-one — so the same attribute rendered "Purchase
 * intent" in the library and the raw identifier `purchase_intent` on the ads
 * page, in the same session. One map, or the claim is decoration.
 */
const ATTRIBUTE_LABEL: Record<string, string> = {
  // person / professional
  job_title: "Job title",
  seniority: "Seniority",
  job_function: "Job function",
  skill: "Skills",
  years_experience: "Years of experience",
  education_degree: "Degrees",
  field_of_study: "Fields of study",
  group_membership: "Groups",
  member_interest: "Interests",
  // company / firmographic
  company_industry: "Industry",
  company_size: "Company size",
  company_name: "Companies",
  company_follower: "Company followers",
  company_category: "Company category",
  company_growth_rate: "Company growth",
  company_revenue: "Company revenue",
  school: "Schools",
  // demographic, place, language
  age_range: "Age",
  gender: "Gender",
  geo: "Location",
  language: "Language",
  // behavioural / intent
  behaviour: "Behaviour",
  purchase_intent: "Purchase intent",
  life_event: "Life events",
  search_keyword: "Search terms",
  // audience objects
  custom_audience: "Your own lists",
  lookalike_seed: "Lookalike seed",
  retargeting_audience: "Retargeting",
  // delivery
  // ★NOT "Platform", WHICH ON THIS SURFACE ALREADY MEANS THE AD CHANNEL. The
  // schema's `device` is the operating system or form factor (iOS, Android,
  // desktop); a chip row reading "Platform · iOS" beside "Not checked on X yet"
  // uses one word for two things.
  device: "Device type",
  device_model: "Device model",
  placement: "Placement",
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
export function channelNotes(channel: AudienceChannel): string[] {
  const notes: string[] = [];
  if (channel.droppedAttributes > 0) {
    const n = channel.droppedAttributes;
    notes.push(`${n} thing${n === 1 ? "" : "s"} ${platformLabel(channel.platform)} can't express`);
  }
  // ★BOTH, NOT THE FIRST. A first cut returned one string and stopped at the
  // dropped-attribute case — so a channel that was stale AND lossy rendered
  // byte-identically to one that was merely lossy. They are two true and
  // different facts: one is about the audience the customer would be buying,
  // the other about how old our copy of it is, and this file's whole argument
  // is that collapsing two facts into one sentence is the failure.
  if (channel.stale && channel.rematerialisable) notes.push("May be out of date");
  return notes;
}

/**
 * Every channel this business can advertise on, whether or not this audience
 * has been resolved against it. A row carries only the ones that HAVE been
 * asked, so this is what makes "nobody has asked X" sayable at all.
 *
 * ⚠️ HAND-MIRRORED FROM THE API'S ADAPTER REGISTRY, and said here rather than
 * discovered: `listAudiencePlatforms()` is the authority and this client cannot
 * import it. The consequence of drift is bounded and one-directional — a third
 * channel would simply never be offered as "not checked yet" until somebody
 * edits this line — but it is drift, and `GET /sets` does not publish the list.
 */
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
    // ★THE COUNT SURVIVES THE DISCARD. "Discarded after being corrected four
    // times" is the most informative row in the library — it is an audience we
    // kept getting wrong and they finally gave up on — and a first cut computed
    // the figure and then dropped it on exactly the sets most likely to carry
    // one. Suppressing the OUTCOME on a discard is the rule; suppressing the
    // correction count was an accident of ordering.
    const base = set.discardReason
      ? `You discarded this — "${set.discardReason}"`
      : "You discarded this";
    return corrected ? `${base} (${corrected})` : base;
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
  if (typeof outcome.spend === "number" && outcome.spend >= 0 && outcome.currency) {
    // ★ROUNDED TO WHOLE UNITS EXCEPT WHERE THAT WOULD PRINT A ZERO OVER REAL
    // SPEND, AT EITHER SCALE. `Math.round(0.49)` is 0; `(0.004).toFixed(2)` is
    // "0.00", which is the same lie with more decimal places. Below a cent the
    // only honest rendering is a bound.
    // ★AND A NEGATIVE IS NOT RENDERED AT ALL. The schema forbids one (`min: 0`),
    // and `Math.round(-0.4)` is JavaScript's `-0` — "USD -0 spent" is a
    // sentence about money that nobody can act on.
    if (outcome.spend > 0 && outcome.spend < 0.01) {
      parts.push(`under ${outcome.currency} 0.01 spent`);
    } else {
      const spend =
        outcome.spend > 0 && outcome.spend < 1
          ? outcome.spend.toFixed(2)
          : REACH_FORMAT.format(Math.round(outcome.spend));
      parts.push(`${outcome.currency} ${spend} spent`);
    }
  }
  return parts.join(" · ");
}
