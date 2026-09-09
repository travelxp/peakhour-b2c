import type { HealthCheck, MeasurementHealthResponse } from "@/lib/api/growth";

/**
 * Can the numbers be believed? — the words and the one-minute fix.
 *
 * ★★THE API DECIDED EVERY VERDICT; THIS FILE ONLY ADDS THE FIX. Whether a check
 * passed, failed or could not be run is settled once, server-side, so the web
 * app and the Shopify app cannot answer it differently. What this side owns is
 * the part the api cannot know: which button a merchant presses next, and the
 * two or three steps to press it.
 *
 * ── ★★A FIX IS OFFERED ONLY FOR `attention` ───────────────────────────────
 *
 * The steps under a green check are noise, and the steps under `unmeasurable`
 * are worse than noise: "we could not read your analytics" has no fix in
 * Google's admin, because the thing to repair is usually the connection on the
 * page this panel is standing on. Offering a Google link there sends somebody
 * away from the button that would have helped.
 *
 * ── ⚠️A CHECK THIS BUILD HAS NEVER HEARD OF STILL GETS SHOWN ──────────────
 *
 * The api's `HealthCheckId` set grows independently of this deploy. A finding
 * with no entry in the table below renders its api-written headline and detail
 * with no fix beside it — never hidden, and never crashed on. Hiding it is the
 * one outcome that cannot be recovered from: nobody knows to look for a check
 * that was silently dropped.
 */

/** A step-by-step repair, and the place to do it. */
export interface HealthFix {
  /** Where the steps happen, named as the merchant knows it. */
  where: string;
  /** Two or three imperatives. Not prose. */
  steps: string[];
  link: { label: string; href: string };
}

/**
 * ⏸THE LINKS ARE PRODUCT ENTRANCES, NOT DEEP LINKS, AND THAT IS DELIBERATE.
 * A deep link into a GA4 admin screen needs the property id in its path, and
 * this response does not carry one — a link built without it lands the merchant
 * on an account picker having promised a settings page. The entrance plus the
 * steps gets them there in the same minute and cannot be wrong.
 */
const FIXES: Record<string, HealthFix> = {
  unassigned_traffic: {
    where: "your campaign links",
    steps: [
      "Open the links you share in email, social posts and ads.",
      "Add campaign tracking to each one with Google's Campaign URL Builder.",
      "Check that any link shortener or redirect you use keeps the ?utm_ part of the address.",
    ],
    link: {
      label: "Campaign URL Builder",
      href: "https://ga-dev-tools.google/campaign-url-builder/",
    },
  },
  self_referral: {
    where: "Google Analytics · Admin",
    steps: [
      "Go to Admin, then Data streams, and open your website stream.",
      "Open Configure tag settings, then Show more, then List unwanted referrals.",
      "Add the host named above, and save.",
    ],
    link: { label: "Open Google Analytics", href: "https://analytics.google.com/" },
  },
  hostname_agreement: {
    where: "Search Console",
    steps: [
      "Check which site your Search Console property covers.",
      "If it is the wrong one, add the right property and verify it.",
      "Reconnect Search Console here and pick the property that matches your website.",
    ],
    link: { label: "Open Search Console", href: "https://search.google.com/search-console" },
  },
  key_event: {
    where: "Google Analytics · Admin",
    steps: [
      "Decide the one action that counts as a result — an enquiry, a booking, a purchase.",
      "In Admin, open Events, and find the event that fires when it happens.",
      "Switch on Mark as key event.",
    ],
    link: { label: "Open Google Analytics", href: "https://analytics.google.com/" },
  },
  listing_completeness: {
    where: "your Business Profile",
    steps: [
      "Open your Business Profile and choose Edit profile.",
      "Fill in whatever is named above — a category, hours, a phone number, a website, a description.",
      "Save. Google usually shows the change within a day.",
    ],
    link: { label: "Open Business Profile", href: "https://business.google.com/" },
  },
};

/** The fix for a check, or null when offering one would be wrong. */
export function fixFor(check: HealthCheck): HealthFix | null {
  if (check.state !== "attention") return null;
  return FIXES[check.id] ?? null;
}

/**
 * The order findings are read in.
 *
 * ★★WHAT NEEDS DOING COMES FIRST, AND WHAT WE COULD NOT CHECK IS NOT LAST BY
 * ACCIDENT. `unmeasurable` above `ok` is the whole three-state contract made
 * visible: a check we could not run is closer to a problem than to a pass, and
 * sorting it under the green rows would bury the one state nobody goes looking
 * for.
 */
const STATE_RANK: Record<string, number> = { attention: 0, unmeasurable: 1, ok: 2 };

export function orderedChecks(checks: HealthCheck[]): HealthCheck[] {
  // ⚠️A STABLE SORT OVER A COPY. `Array.prototype.sort` mutates, and the array
  // here is react-query's cached response object — sorting it in place reorders
  // the cache under every other reader of the same query.
  return [...checks].sort(
    (a, b) => (STATE_RANK[a.state] ?? 1) - (STATE_RANK[b.state] ?? 1),
  );
}

/**
 * Whether this panel has anything worth taking a merchant's attention for.
 *
 * ★★NOTHING CHECKED IS NOTHING TO SAY. A business with no Google account
 * connected fails every check as `unmeasurable`, and the panel would then open
 * with "we couldn't check your measurement setup" directly above the cards that
 * already say "not connected" — an alarm about the state the page exists to
 * fix. `summary.checked` counts the checks we could actually RUN, so zero of
 * them is exactly that business.
 *
 * ⚠️AND IT IS NOT `checks.length === 0`. Every check is present in every
 * response; what varies is how many of them we could answer.
 *
 * ⏸`attention` IS NOT TESTED BESIDE IT, and a first version tested both. A
 * check in `attention` is a check we ran, so it is already inside `checked` —
 * the extra clause could not fire, and a condition that cannot fire reads as a
 * case somebody considered and is really a case nobody did.
 */
export function hasSomethingToSay(data: MeasurementHealthResponse): boolean {
  return data.summary.checked > 0;
}

/** The period the checks were judged over, in words. */
export function periodLine(data: MeasurementHealthResponse): string {
  const days = data.period.days;
  return `Checked over the last ${days} ${days === 1 ? "day" : "days"}.`;
}

/**
 * How many checks passed, out of how many we could run.
 *
 * ★★THE DENOMINATOR IS WHAT WE COULD CHECK, NOT WHAT EXISTS, and that is the
 * one number a reader would otherwise get wrong. "4 of 5 passed" over a
 * business whose Business Profile we could not read claims we looked at five
 * things. `summary.checked` is the honest denominator, and when it is smaller
 * than the list the sentence says so.
 */
export function passedLine(data: MeasurementHealthResponse): string | null {
  const { checked, attention, unmeasurable } = data.summary;
  if (checked === 0) return null;
  const passed = checked - attention;
  const base = `${passed} of ${checked} ${checked === 1 ? "check" : "checks"} passed`;
  return unmeasurable > 0
    ? `${base}. ${unmeasurable} more couldn't be checked.`
    : `${base}.`;
}
