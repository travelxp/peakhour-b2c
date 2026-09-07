/**
 * What `GET /v1/commerce/search-visibility` answers, and — the whole point of
 * this file — what a merchant may be TOLD it means.
 *
 * ── ★★THE API DECIDES WHAT IS TRUE; THIS FILE DECIDES WHAT IS SAID ─────────
 *
 * The service (api#1251/#1253) computes a per-product verdict and a SEPARATE
 * gate on one specific sentence: whether we may say Google did not show a
 * product. It exists because every way of getting that wrong produces the same
 * thing — a confident claim about a merchant's business that we cannot support
 * — and none of them look like a bug from here.
 *
 * ★SO THE GATE IS NOT A HINT. `absenceAssertable` false means the strong
 * wording is unavailable whatever the numbers look like, and `unknown` on a row
 * means "we hold no search data for this product" rather than "Google never
 * showed it". A screen that read the counts and ignored the flags would undo
 * four rounds of api work in one line, and it would read perfectly.
 *
 * ── ★★AND THE SHOPIFY APP SAYS THE SAME THING, BY DERIVING IT THE SAME WAY ──
 *
 * peakhour-shopify's `lib/search-visibility.ts` is this file's twin. They
 * cannot import from each other — separate repos, no shared package — so the
 * thing that keeps them honest is that NEITHER decides anything: both read
 * `absenceAssertable`, `absenceBlockers`, `summary.unknownWindowCovered` and
 * `window` and phrase exactly what those say. The api is the shared authority
 * precisely so that two surfaces cannot end up disagreeing about whether a
 * merchant's products are invisible to Google.
 *
 * ⏸IF THESE TWO EVER DIVERGE, the fix is to move the decision further into the
 * api rather than to sync the copy — a rule that lives in two places is a rule
 * that will differ in two places.
 */

export type WindowCoverage = "full" | "partial" | "unknown";

export interface ProductRow {
  productId: string;
  title?: string;
  state: string;
  pageUrl?: string;
  clicks?: number;
  impressions?: number;
  position?: number;
  windowCoverage: WindowCoverage;
}

export interface VisibilitySummary {
  total: number;
  earning: number;
  seen_not_clicked: number;
  barely_seen: number;
  unknown: number;
  no_url: number;
  unknownWindowCovered: number;
}

export interface VisibilityReady {
  state: "ready";
  siteUrl: string;
  syncedAt: string;
  stale: boolean;
  catalogTruncated: boolean;
  window?: { start: string; end: string };
  absenceAssertable: boolean;
  absenceBlockers: string[];
  summary: VisibilitySummary;
  matching: number;
  products: ProductRow[];
}

export type VisibilityResult =
  | { state: "not_connected" | "not_configured" | "no_catalog" | "pending" }
  | VisibilityReady;

/**
 * Whether a 200 is actually readable as a `ready` answer.
 *
 * ★BECAUSE THE ALTERNATIVE IS A HEADLINE READING "NaN products". A truncated or
 * half-written body would otherwise reach the counters, which format whatever
 * they are given.
 */
export function isUsableVisibility(r: VisibilityResult | null | undefined): r is VisibilityReady {
  if (!r || r.state !== "ready") return false;
  const v = r as VisibilityReady;
  return (
    !!v.summary &&
    Number.isFinite(v.summary.total) &&
    Number.isFinite(v.summary.unknown) &&
    Number.isFinite(v.summary.unknownWindowCovered) &&
    // ★`matching` DRIVES EVERY COUNT-OF-ROWS DECISION, and it was the one field
    // its Shopify twin left unchecked until a round found it.
    Number.isFinite(v.matching) &&
    Array.isArray(v.products) &&
    // ★AND THE ENTRIES, NOT ONLY THE ARRAY. A `null` entry throws on `p.state`
    // during render.
    v.products.every((p) => !!p && typeof p === "object") &&
    Array.isArray(v.absenceBlockers) &&
    typeof v.siteUrl === "string"
  );
}

/** What each verdict is called, and how it reads. */
const STATE_LABEL: Record<
  string,
  { label: string; tone: "success" | "warning" | "neutral" | "critical"; blurb: string }
> = {
  earning: {
    label: "Earning clicks",
    tone: "success",
    blurb: "People find this in Google and click through.",
  },
  seen_not_clicked: {
    label: "Shown, not clicked",
    tone: "warning",
    blurb: "Google shows this page and almost nobody clicks — usually the title or the image.",
  },
  barely_seen: {
    label: "Barely shown",
    tone: "warning",
    blurb: "Google has the page but rarely shows it — a ranking problem, not a listing one.",
  },
  unknown: {
    label: "No data",
    tone: "neutral",
    blurb: "We hold no search data for this product in the reported window.",
  },
  no_url: {
    label: "No usable link",
    tone: "critical",
    blurb: "This product has no address we can match to a page, so it cannot be measured.",
  },
};

/**
 * ★FALLS BACK TO THE RAW KEY RATHER THAN HIDING THE ROW — a sixth state added
 * server-side should look unfamiliar, not invisible.
 *
 * ★★AND IT USES `Object.hasOwn`, NOT `??`. An object literal inherits from
 * `Object.prototype`, so `STATE_LABEL["toString"]` is a FUNCTION — not nullish
 * — and `??` would never reach the fallback, rendering the source of `toString`
 * as a badge. The Shopify twin hit this on two separate maps.
 */
export function stateLabel(state: string): {
  label: string;
  tone: "success" | "warning" | "neutral" | "critical";
  blurb: string;
} {
  if (Object.hasOwn(STATE_LABEL, state)) return STATE_LABEL[state];
  return { label: state, tone: "neutral", blurb: "" };
}

/** The Badge variants this surface has. */
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/**
 * The four tones the states carry, mapped to the four Badge variants.
 *
 * ★★COLLAPSING THEM TO TWO MAKES `no_url` LOOK LIKE `unknown` — and those are
 * the two that must NOT look alike. `no_url` is the one row state the merchant
 * can act on today (the product has no address we can match); `unknown` is a gap
 * in OUR data and asks nothing of them. A first cut mapped `success → default`
 * and everything else to `secondary`, painting the actionable row and the
 * do-nothing row identically.
 *
 * ★IT LIVES HERE, NOT IN THE COMPONENT, because this repo tests
 * framework-agnostic logic and renders untested — so a decision left in the JSX
 * is a decision nothing can score.
 */
export function badgeVariant(tone: "success" | "warning" | "neutral" | "critical"): BadgeVariant {
  if (tone === "success") return "default";
  if (tone === "critical") return "destructive";
  if (tone === "warning") return "outline";
  return "secondary";
}

/**
 * Which verdicts to explain under the table, in the order they should read.
 *
 * ★ONLY THE STATES PRESENT, so the legend never explains a row that is not
 * there — and only those with a blurb, so an unrecognised state contributes a
 * badge to the list and no empty line.
 *
 * ★★AND IT EXISTS AT ALL BECAUSE THE BLURBS WERE DEAD. Copy no merchant can see
 * is worse than none in this file, since the mutation harness scores it and
 * reports the rule healthy. Its Shopify twin had the identical defect.
 */
export function legendEntries(
  products: Array<{ state?: unknown }>,
): Array<{ state: string; label: string; tone: BadgeVariant; blurb: string }> {
  const seen = new Set<string>();
  const out: Array<{ state: string; label: string; tone: BadgeVariant; blurb: string }> = [];
  for (const p of products ?? []) {
    const state = String(p?.state ?? "");
    if (!state || seen.has(state)) continue;
    seen.add(state);
    const s = stateLabel(state);
    if (!s.blurb) continue;
    out.push({ state, label: s.label, tone: badgeVariant(s.tone), blurb: s.blurb });
  }
  return out;
}

/**
 * A window as the merchant reads it — two dates, never "the last 28 days".
 *
 * ★★RENDERED IN UTC, BECAUSE THE WINDOW IS UTC. The api normalises both ends to
 * whole UTC days — the open at 00:00, the close at 23:59:59.999 — so formatting
 * in the viewer's zone moves the printed date by a day for every merchant east
 * of UTC. A window ending 6 Sep 23:59Z reads "7 Sept" in Delhi, and the
 * sentence beside it is a dated claim about their business.
 */
export function windowSentence(w: { start: string; end: string } | undefined): string {
  if (!w) return "";
  const fmt = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  const start = fmt(w.start);
  const end = fmt(w.end);
  // ★A HALF-PARSED RANGE SAYS NOTHING RATHER THAN HALF OF SOMETHING.
  if (!start || !end) return "";
  return `${start} – ${end}`;
}

/** The same window inside a sentence that already said "between" — a dash there
 *  is range notation and reads as a subtraction. */
export function windowPhrase(w: { start: string; end: string } | undefined): string {
  const range = windowSentence(w);
  return range ? range.replace(" – ", " and ") : "";
}

/**
 * Why we cannot say Google did not show these products.
 *
 * ★IN THE MERCHANT'S TERMS. Most of these are about OUR reach; one — the wrong
 * property — is a thing the merchant fixes, and it is the one that matters
 * most, because it is also the one that would otherwise have produced a
 * confident and completely wrong answer about their whole catalogue.
 */
const BLOCKER_NOTE: Record<string, string> = {
  slice_truncated:
    "your site has more pages than we read in one pass, and the ones we dropped are the low-traffic ones this list is about",
  rows_lost: "part of the last read did not save",
  catalog_truncated: "your catalogue is larger than we read in one pass",
  completeness_unknown: "the last read finished before we started recording how complete it was",
  window_unknown: "we could not work out which dates the last read covers",
  property_mismatch:
    "the Search Console property we read does not serve this store — check which site is connected",
};

/**
 * The caveat line, or "" when there is nothing to caveat.
 *
 * ★AN UNKNOWN BLOCKER IS NAMED, NOT SWALLOWED. A reason added server-side that
 * this map has not learned yet must still tell the merchant something is
 * holding the answer back — an empty caveat beside softened wording is the one
 * combination that reads as a bug in the copy rather than a limit on the data.
 */
export function blockerNote(blockers: string[], opts: { subject?: boolean } = {}): string {
  const reasons = (blockers ?? [])
    .filter((b) => typeof b === "string" && b.length > 0)
    .map((b) =>
      Object.hasOwn(BLOCKER_NOTE, b) ? BLOCKER_NOTE[b] : `we hit a limit we cannot describe yet (${b})`,
    );
  if (reasons.length === 0) return "";
  const why = reasons.join("; and ");
  // ★★TWO LEADS, BECAUSE THE CAVEAT MUST SURVIVE THE ALL-CLEAR. The default
  // lead refers to "these" — the products the headline just named — and has no
  // antecedent when the headline is "every product we can measure is showing
  // up". A first fix SUPPRESSED the caveat in that case, which silenced every
  // blocker whenever nothing was unknown: a catalogue truncated at MAX_CATALOG
  // with all the products we read indexed then reported everything fine, with
  // no hint that a third of it was never looked at. The wording was the
  // problem; the information never was.
  return opts.subject === false
    ? `This doesn't cover everything — ${why}.`
    : `We can't say for certain that Google never showed these — ${why}.`;
}

/**
 * The headline, and whether it is the strong claim or the weak one.
 *
 * ── ★★THIS IS THE SENTENCE THE WHOLE FEATURE IS FOR, AND ITS ONE RISK ──────
 *
 * "Eleven of your products have never appeared in a Google search" is what a
 * merchant cannot get anywhere else. It is also a statement about their
 * business, so it is spoken ONLY when both halves of the api's gate agree:
 * `absenceAssertable`, and the row's own `windowCoverage: "full"` — which is
 * what `summary.unknownWindowCovered` already counts.
 *
 * ★THE COUNT IS `unknownWindowCovered`, NEVER `unknown`. The difference is
 * products we cannot speak about — added part-way through the window, or with
 * no date of their own — and quoting the larger number is precisely the
 * overcount the api added that field to prevent.
 *
 * ★WHEN THE GATE IS SHUT THE SENTENCE CHANGES SUBJECT, from the merchant's
 * products to our data. That is the difference between a finding and an
 * accusation, and it is why this returns the words rather than a boolean.
 */
export function headline(r: VisibilityReady): { text: string; asserted: boolean; count: number } {
  const covered = r.summary.unknownWindowCovered;
  const unknown = r.summary.unknown;

  if (r.absenceAssertable && covered > 0) {
    const when = windowPhrase(r.window);
    const dates = when ? ` between ${when}` : "";
    return {
      text: `${covered} ${covered === 1 ? "product has" : "products have"} not appeared in a Google search${dates}.`,
      asserted: true,
      count: covered,
    };
  }

  if (unknown > 0) {
    return {
      text: `We don't have search data for ${unknown} ${unknown === 1 ? "product" : "products"} yet.`,
      asserted: false,
      count: unknown,
    };
  }

  // ★NOT "0 products have not appeared", which reads as a defect rather than as
  // good news. ★AND `asserted` IS FALSE, because nothing is being asserted about
  // ABSENCE here — its Shopify twin reported the GATE instead and painted a red
  // zero beside the good news.
  return {
    text: "Every product we can measure is showing up in Google search.",
    asserted: false,
    count: 0,
  };
}
