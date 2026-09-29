import type {
  VisibilityAbsence,
  VisibilityFigure,
  VisibilityResponse,
  VisibilityStage,
} from "@/lib/api/growth";
import { knownPlatformLabel } from "@/lib/audience-library-rules";

/**
 * What the visibility funnel SAYS — the phrasing rules, with no React in them.
 *
 * ★★NOTHING HERE DECIDES ANYTHING. Whether a stage may be totalled, whether an
 * amount may be shown, whether a source counts as stopped: every one of those
 * is settled in the api, and a second decision on this side would differ from
 * it on the same data. What lives here is the sentence — which is its own way
 * of being wrong, and the only one this repo can still get wrong.
 *
 * ★THE FAILURE MODE THESE GUARD AGAINST is a true figure inside a false
 * sentence: a stage the api refused to total rendered as "0", a 28-day brand
 * share stated as a percentage of a 7-day figure, a lapsed grant told to
 * "connect Google" when they already did.
 *
 * @package peakhour-b2c
 */

const NUM = new Intl.NumberFormat("en-US");

/**
 * What each stated absence means to a shopkeeper.
 *
 * ★★`needs_reconnect` IS NOT `not_connected`, AND THE WHOLE POINT OF THE api
 * SENDING TWO REASONS IS THAT THEY GET TWO SENTENCES. "Connect Google" is the
 * wrong instruction for somebody whose grant lapsed — they already did, and the
 * thing to do is authorise it again. Collapsing them would waste the
 * distinction the api goes to some trouble to make.
 *
 * ★AND `unavailable` IS OURS, NOT THEIRS. It means we could not read it, so it
 * must not read as anything the merchant should go and fix.
 */
const ABSENCE_TEXT: Record<VisibilityAbsence, string> = {
  not_connected: "not connected",
  not_configured: "needs finishing",
  pending: "gathering data",
  stale: "stopped updating",
  needs_reconnect: "reconnect Google",
  unavailable: "couldn't be read",
};

export function absenceText(reason: VisibilityAbsence): string {
  // ★A REASON THIS BUILD HAS NEVER HEARD OF STILL GETS WORDS. The icon lookup
  // beside this one was hardened for exactly that and this was not — leaving a
  // source row with a warning triangle and nothing next to it, which is a row
  // that says less than saying nothing would.
  return ABSENCE_TEXT[reason] ?? "not available";
}

const SOURCE_LABEL: Record<string, string> = {
  google_search: "Google Search",
  google_business_profile: "Business Profile",
  google_analytics: "Your website",
};

/**
 * An ad platform's row label — "LinkedIn ads", "Google Ads".
 *
 * ★FROM THE ONE PLATFORM TABLE (`audience-library-rules`), not a second copy:
 * a rename edited in one table would name the same platform two ways on one
 * screen. ★AND NEVER THE WIRE VALUE — an unknown platform gets generic words.
 */
export function paidFigureLabel(platform: string | undefined): string {
  const name = platform ? knownPlatformLabel(platform) : undefined;
  if (!name) return "Ads on another platform";
  return /\bads$/i.test(name) ? name : `${name} ads`;
}

/**
 * The row label for one figure.
 *
 * ★NEVER THE RAW WIRE VALUE. The two repos deploy separately, so this build can
 * meet a source — or an ad platform — it has no label for, and
 * `google_business_profile` in a merchant-facing list is worse than a generic
 * word. ★A PAID FIGURE IS LABELLED BY ITS PLATFORM (D-01): every one of them
 * has `source: "paid_ads"`, so the source alone would print "Your ads" twice
 * in one stage. The one without a platform is the failed read.
 */
export function figureLabel(f: Pick<VisibilityFigure, "source" | "platform" | "available">): string {
  if (f.source === "paid_ads") {
    // ★THE FAILED READ IS THE UNAVAILABLE FIGURE WITH NO PLATFORM — keyed on
    // both, so an ANSWERED figure missing its platform is never dressed as it.
    // ★AND NOT "YOUR ads": the api emits it whenever the read throws, for a
    // business that has never advertised too, and "your" claims they exist.
    if (!f.available && !f.platform) return "Ads";
    return paidFigureLabel(f.platform);
  }
  return SOURCE_LABEL[f.source] ?? "Another source";
}

/**
 * A React key for one figure within its stage.
 *
 * ★`source` ALONE IS NOT UNIQUE ANY MORE. A business advertising on two
 * platforms gets two `paid_ads` figures in each paid stage, and keying by
 * source made them one element to React — a duplicate-key warning, and a row
 * that can be dropped or reused on the next render.
 */
export function figureKey(f: Pick<VisibilityFigure, "source" | "platform" | "available">): string {
  if (f.platform) return `${f.source}:${f.platform}`;
  // ★A PAID FIGURE WITH NO PLATFORM IS EITHER THE FAILED READ OR AN ANSWERED
  // ONE MISSING ITS PLATFORM (`figureLabel` tells them apart), and both would
  // key to the bare source — the duplicate key this function exists to stop.
  // ★"#", NOT ":" — a platform can be any string, even "unavailable", so the
  // fallback keys live in a namespace no platform key can reach.
  return f.source === "paid_ads" ? `${f.source}#${f.available ? "no-platform" : "unavailable"}` : f.source;
}

/**
 * What a stage with no total should say instead of a number.
 *
 * ★★TWO STATES, TWO SENTENCES, BECAUSE THEY HAVE DIFFERENT FIXES. "You haven't
 * connected anything that answers this" is a setup step; "one of your
 * connections hasn't reported" is a wait or a repair. And NEITHER is a zero:
 * "0 people found you" is a verdict on a business that has simply connected
 * nothing, which is the single most misleading thing this surface could print.
 */
export function incompleteLine(stage: VisibilityStage): string {
  if (stage.incomplete === "nothing_connected") return "Nothing connected yet";

  // ★★"WAITING ON A CONNECTION" IS ONLY TRUE OF SOME OF THE THINGS THAT BLOCK A
  // TOTAL, and `stage.figures` was in hand and unread. When the blocker is
  // `unavailable` the fault is OURS — the headline blamed the merchant's
  // connection for our own timeout, directly above a row saying "couldn't be
  // read". And when it is `needs_reconnect` there is something to DO, which
  // "waiting" tells nobody.
  const blocking = stage.figures.filter((f) => !f.available && f.reason !== "not_connected");
  if (blocking.every((f) => !f.available && f.reason === "unavailable")) {
    return "We couldn't read this";
  }
  if (blocking.some((f) => !f.available && f.reason === "needs_reconnect")) {
    return "Reconnect Google to see this";
  }
  // ★A SOURCE THAT STOPPED IS NOT ONE WE ARE WAITING ON. "Waiting on a
  // connection" above a row saying "stopped updating" is the true-row,
  // false-headline mismatch this function exists to prevent — and paid
  // figures (D-01) make a stale blocker common rather than rare.
  // ★EVERY blocker, not SOME: over a mix (our own `unavailable`, or a source
  // still gathering) "stopped updating" blames the one that stopped for all.
  if (blocking.every((f) => !f.available && f.reason === "stale")) {
    return "Some of this stopped updating";
  }
  return "Waiting on a connection";
}

/**
 * The shortest coverage among the sources that answered — the one that made the
 * stage partial.
 *
 * ★THE SHORTEST, NOT THE LONGEST OR THE AVERAGE. The sentence exists to warn
 * that part of the window is missing, and it is the WORST-covered source that
 * decides how much. Reporting the best one would understate exactly the gap the
 * line is there to disclose.
 */
export function shortestSpan(stage: VisibilityStage): number {
  const days = stage.figures.filter((f) => f.available).map((f) => f.days);
  return days.length > 0 ? Math.min(...days) : 0;
}

/** "Part of the period — 7 of 28 days", or null when the stage is whole. */
export function partialLine(stage: VisibilityStage, windowDays: number): string | null {
  // ★ONLY WHEN THERE IS A TOTAL TO QUALIFY. A stage with no number has nothing
  // for this sentence to be about, and printing a coverage note beside
  // "Nothing connected yet" reads as though something WAS measured.
  if (typeof stage.total !== "number" || !stage.partial) return null;
  return `Part of the period — ${shortestSpan(stage)} of ${windowDays} days`;
}

/**
 * The brand-split sentence, or the api's own refusal, or nothing.
 *
 * ★★IT NAMES DAYS, NEVER A PERCENTAGE, AND THAT IS THE RULE THIS FUNCTION
 * EXISTS FOR. The split classifies the newest Search Console slice, written
 * over a fixed trailing window that is NOT the page's — so on a 7-day view its
 * clicks cover four times the FOUND figure sitting above it, and a share
 * computed against that figure can exceed 100%. The api sends `windowDays`
 * precisely so a surface can state the span instead of dividing by the wrong
 * denominator.
 *
 * ★AND A REFUSAL IS RENDERED, NOT DROPPED. "We could not work out which
 * searches are your own name" and "Search Console is not connected" have
 * different fixes; dropping the first makes it look like the second.
 */
export function brandLine(brandSplit: VisibilityResponse["brandSplit"]): string | null {
  if (!brandSplit) return null;
  const { split, windowDays } = brandSplit;
  if (!split.assertable) return split.message;

  const total = split.brand.clicks + split.nonBrand.clicks;
  const impressions = split.brand.impressions + split.nonBrand.impressions;
  // ★★COMPUTED BEFORE THE EARLY RETURNS, NOT AFTER THEM. A first version put
  // this below both zero branches, so the two sentences that fire on a
  // no-click window stated a GUESSED brand classification as a confirmed one —
  // the exact seed the qualifier exists to disclose, on the two sentences most
  // likely to be read as a verdict.
  const seeded = split.termsSource === "seeded" ? " (using the name we worked out)" : "";

  // ★★A ZERO IN CLICKS IS NOT A ZERO IN DEMAND, AND SAYING SO WAS A FALSE
  // SENTENCE OVER A TRUE FIGURE — the thing this module exists to prevent,
  // committed by this module. "Nobody searched Google for you by name" sat
  // directly under a FOUND stage reporting 1,320 impressions, because the
  // check looked only at clicks. A shop can appear hundreds of times and be
  // clicked never; that is a finding, and a different one.
  if (total === 0 && impressions > 0) {
    return (
      `${NUM.format(split.brand.impressions)} of ${NUM.format(impressions)} times you ` +
      `appeared in Google were people searching for you by name — none of them clicked ` +
      `through, over the last ${windowDays} days${seeded}.`
    );
  }
  // ★★NO CLICKS AND NO IMPRESSIONS IS "NOBODY LOOKED", NOT "NOBODY LOOKED BY
  // NAME". This branch is only reachable when the whole window is empty — the
  // impressions case above takes every other zero — so narrowing the sentence
  // to "by name" implies there WAS generic search traffic that this business
  // did not get by reputation, which is a claim about demand that did not
  // happen. Say what is true: Google sent nothing at all.
  if (total === 0) {
    return `You did not appear in Google search at all in the last ${windowDays} days.`;
  }
  return (
    `${NUM.format(split.brand.clicks)} of ${NUM.format(total)} search clicks came from ` +
    `people searching for you by name, over the last ${windowDays} days${seeded}.`
  );
}
