import { ApiError } from "@/lib/api";
import type { GoogleKeywordIdea, GoogleKeywordIdeaCompetition, GoogleKeywordIdeasInput, GoogleMatchType } from "@/lib/api/google-ads";
import { googleAdsErrorMessage } from "@/lib/google-ads-view";
import { formatGoogleMicros } from "@/lib/google-reports-view";
import {
  foldKeyword,
  googleKeywordProblem,
  googleNegativeSilences,
  keywordKey,
  type DraftKeyword,
  type TargetingDraft,
} from "@/lib/google-targeting-view";

/**
 * ★★G-14g — what the Google Keyword Ideas section SAYS and DECIDES, kept pure
 * so every sentence and rule is tested (`google-keyword-ideas-view.test.ts`).
 *
 * ★GOOGLE'S IDEAS, BESIDE THE CAMPAIGN'S KEYWORDS, NEVER MERGED INTO THEM.
 * RMF's look-alike rule asks for Google's "Keyword Ideas" next to our own
 * (peakhour-mongodb `docs/idea/google-ads-rmf-gap-assessment.md` §1.3). An idea
 * joins the keyword list only when the merchant adds it, at the match type
 * they pick (PHRASE until they pick another; BROAD only when chosen), and the
 * targeting step's own save writes it.
 *
 * ★D12: Google's figures are Google's history for a search, said as Google's,
 * as Google gives them (an average, a LOW / MEDIUM / HIGH bucket, a bid range),
 * and never as what this campaign will reach.
 */

/** Google: "Requires at least one keyword and no more than 20 keywords." */
export const GOOGLE_IDEAS_MAX_SEED_WORDS = 20;
/** The api's bound on one word or phrase to start from (its `KeywordIdeasBody`). */
export const GOOGLE_IDEAS_MAX_SEED_CHARS = 80;
/** Google: "The resource names of the location to target. Maximum is 10." */
export const GOOGLE_IDEAS_MAX_LOCATIONS = 10;

export const GOOGLE_IDEAS_TITLE = "Keyword ideas from Google";
export const GOOGLE_IDEAS_ATTRIBUTION =
  "Suggested by Google Ads Keyword Planner, not by Peakhour. An idea is not one of your keywords until you add it.";
export const GOOGLE_IDEAS_FIGURES_NOTE =
  "The figures are Google's history for each search: its average monthly searches over the past 12 months, its competition level and its top-of-page bid range. They are not a forecast for this campaign.";

/** The api's own sentences for this section, shown as they are. */
const IDEAS_MERCHANT_FACING_CODES: ReadonlySet<string> = new Set([
  "KEYWORD_IDEAS_THROTTLED",
  "KEYWORD_IDEAS_NOT_AVAILABLE",
  "KEYWORD_IDEAS_URL_UNREADABLE",
  "KEYWORD_IDEAS_REFUSED",
  // Review round 2: a row the api cannot read; "contact support", never "try again".
  "CAMPAIGN_UNREADABLE",
]);

/** A failed request, in the merchant's words: this section's codes, then the panel's. */
export function googleKeywordIdeasErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && IDEAS_MERCHANT_FACING_CODES.has(err.code)) return err.message;
  return googleAdsErrorMessage(err, fallback);
}

/** Words typed as a list ("linen shirts, summer linen"), folded and de-duplicated. */
export function parseSeedWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,\n]/)) {
    const w = foldKeyword(part);
    if (!w || seen.has(w.toLowerCase())) continue;
    seen.add(w.toLowerCase());
    out.push(w);
  }
  return out;
}

/** The words the section starts from: the campaign's own keywords, as many as Google takes. */
export function seedWordsFromDraft(d: TargetingDraft): string {
  return parseSeedWords(d.keywords.map((k) => k.text).join(",")).slice(0, GOOGLE_IDEAS_MAX_SEED_WORDS).join(", ");
}

/**
 * The request, from what the merchant typed and the campaign's own places and
 * language — or why it can't be sent. ★PLACES ARE THE CAMPAIGN'S LOCATIONS, at
 * most ten; a radius is not something Google's ideas take, and is said so.
 */
export function keywordIdeasRequest(
  typed: { words: string; url: string; language: string },
  d: TargetingDraft,
): { input: GoogleKeywordIdeasInput; problem: string | null; placesNote: string | null } {
  const keywords = parseSeedWords(typed.words);
  const url = typed.url.trim();
  const geoTargetConstants = d.locations.slice(0, GOOGLE_IDEAS_MAX_LOCATIONS).map((l) => l.geoTargetConstant);
  const input: GoogleKeywordIdeasInput = {
    keywords,
    ...(url ? { url } : {}),
    ...(typed.language ? { language: typed.language } : {}),
    geoTargetConstants,
  };
  const problem =
    keywords.length === 0 && !url
      ? "Give Google some words or a page of your site to start from."
      : keywords.length > GOOGLE_IDEAS_MAX_SEED_WORDS
        ? `Google takes at most ${GOOGLE_IDEAS_MAX_SEED_WORDS} words or phrases to start from.`
        : // ★SAID HERE, NOT AS THE API'S "Invalid body" (review round 1): a pasted sentence is one long phrase.
          // `.length`, UTF-16 units, as the api's zod `max(80)` counts (review round 2).
          keywords.some((k) => k.length > GOOGLE_IDEAS_MAX_SEED_CHARS)
          ? `A word or phrase to start from is at most ${GOOGLE_IDEAS_MAX_SEED_CHARS} characters. Separate them with commas.`
          : null;
  const placesNote =
    d.locations.length > GOOGLE_IDEAS_MAX_LOCATIONS
      ? `Google takes ${GOOGLE_IDEAS_MAX_LOCATIONS} locations for ideas, so these use the first ${GOOGLE_IDEAS_MAX_LOCATIONS} of yours.`
      : d.locations.length === 0
        ? d.radii.length > 0
          ? "Google's ideas take locations, not a radius, so these are for every location."
          : "No locations yet, so these are for every location."
        : null;
  return { input, problem, placesNote };
}

/** Google's average, as Google's: "Google: about 1,300 searches a month (12-month average)". Null when Google gave none. */
export function googleIdeaSearchesSentence(idea: Pick<GoogleKeywordIdea, "avgMonthlySearches">): string | null {
  if (idea.avgMonthlySearches === undefined) return null;
  const n = idea.avgMonthlySearches;
  return `Google: about ${n.toLocaleString("en-US")} search${n === 1 ? "" : "es"} a month (12-month average)`;
}

const COMPETITION_WORDS: Record<GoogleKeywordIdeaCompetition, string> = { LOW: "low", MEDIUM: "medium", HIGH: "high" };

/** Google's bucket, as Google's: "Google competition: medium". */
export function googleIdeaCompetitionLabel(idea: Pick<GoogleKeywordIdea, "competition">): string | null {
  return idea.competition ? `Google competition: ${COMPETITION_WORDS[idea.competition]}` : null;
}

/**
 * Google's top-of-page bid range in the account's currency, or null without
 * both ends. The panel's own micros formatter (review round 1: one way to
 * say Google's money on the panel).
 */
export function googleIdeaBidRange(idea: Pick<GoogleKeywordIdea, "lowTopOfPageBidMicros" | "highTopOfPageBidMicros">, currency: string | undefined): string | null {
  if (idea.lowTopOfPageBidMicros === undefined || idea.highTopOfPageBidMicros === undefined) return null;
  return `Google top-of-page bid: ${formatGoogleMicros(idea.lowTopOfPageBidMicros, currency)}–${formatGoogleMicros(idea.highTopOfPageBidMicros, currency)}`;
}

/**
 * Whether these ideas answer the request as it stands now (review round 1):
 * after the words, page, language or places change, the list on screen is for
 * the earlier one, and says so.
 */
export function sameIdeasRequest(a: GoogleKeywordIdeasInput | undefined, b: GoogleKeywordIdeasInput): boolean {
  if (!a) return false;
  const key = (r: GoogleKeywordIdeasInput) =>
    JSON.stringify([r.keywords.map((k) => k.toLowerCase()), r.url ?? "", r.language ?? "", [...r.geoTargetConstants].sort()]);
  return key(a) === key(b);
}

/** "Google has 2,400 ideas for these; here are its first 100." Null when all are shown. */
export function googleIdeasMoreSentence(shown: number, totalSize: number | undefined): string | null {
  if (totalSize === undefined || totalSize <= shown) return null;
  return `Google has ${totalSize.toLocaleString("en-US")} ideas for these; here are its first ${shown}. Narrow the words or the page for others.`;
}

/** The keyword an idea becomes when the merchant adds it: the text folded, the match type theirs. */
export function ideaAsKeyword(idea: Pick<GoogleKeywordIdea, "text">, matchType: GoogleMatchType): DraftKeyword {
  return { text: foldKeyword(idea.text), matchType };
}

/** Said for an idea already in the campaign's keyword list at that match type. */
export const GOOGLE_IDEA_ALREADY_ADDED = "Already in your keywords.";

/**
 * Why this idea can't be added at this match type, or null: the keyword rules
 * the step applies to a typed keyword, then the list it would join, then the
 * campaign's negatives (review round 1: one that would silence it blocks the
 * step's Save, so it is said on the idea's row). `keywordKeys` is the list's
 * keys, built once by the caller.
 */
export function ideaAddProblem(
  idea: Pick<GoogleKeywordIdea, "text">,
  matchType: GoogleMatchType,
  d: TargetingDraft,
  keywordKeys: ReadonlySet<string>,
  pausedKeys?: ReadonlySet<string>,
): string | null {
  const k = ideaAsKeyword(idea, matchType);
  const p = googleKeywordProblem(k.text);
  if (p) return p;
  const key = keywordKey(k);
  if (keywordKeys.has(key)) return GOOGLE_IDEA_ALREADY_ADDED;
  if (pausedKeys?.has(key)) return "Paused in Google Ads. Enable it there rather than adding it again.";
  const negative = d.negativeKeywords.find((n) => googleNegativeSilences(n, k));
  if (negative) return `Your negative keyword “${foldKeyword(negative.text)}” would stop it from ever showing.`;
  return null;
}
