import { ApiError } from "@/lib/api";
import { adsErrorMessage } from "@/lib/ads-error-message";
import { formatMoneyOrNumber } from "@/lib/outcome-value";
import type {
  GoogleCampaign,
  GoogleChannelControls,
  GoogleChannelType,
  GoogleDemandGenInput,
  GooglePmaxInput,
  GoogleSearchAdInput,
  GoogleSettableStatus,
  GoogleYoutubeChannel,
} from "@/lib/api/google-ads";

/**
 * ★★G-15 — what the Google Ads panel SAYS, kept pure so every sentence and
 * every decision is tested (`google-ads-view.test.ts`).
 *
 * ★SEARCH, PERFORMANCE MAX AND YOUTUBE VIDEO (DEMAND GEN), AND NOTHING ELSE
 * (G19, G20). The api creates those three types; a surface that offered a type
 * the adapter refuses would be worse than one that offers fewer (the plan's
 * G-15 row), so no other is named — and YouTube video ads are never called
 * by the older type's name, which Google's API can no longer create.
 */

// ── What starting a campaign costs ───────────────────────────────────────

/**
 * The sentence beside Activate. Starting, pausing and resuming a campaign costs nothing (N2): PeakHour charges for outcomes
 * it verifies for your goal, not for launching. There is no price to look up, so there is no rate-card read here.
 */
export const GOOGLE_LAUNCH_NOTE =
  "Starting, pausing and resuming a campaign costs nothing. Peaks are charged for outcomes PeakHour verifies for your goal, not for launching.";

// ── Errors ───────────────────────────────────────────────────────────────

/**
 * The api codes whose message is written for the merchant (peakhour-api
 * `routes/google-ads`, G-09). Any other code shows the caller's fallback with
 * the request reference, never a raw message.
 */
export const GOOGLE_MERCHANT_FACING_CODES: ReadonlySet<string> = new Set([
  "NO_BUSINESS",
  // The api's own sentences (review round 1): a copy or end-date refusal, a
  //  row that could not be written, an account on hold.
  "VALIDATION_ERROR",
  "ROW_INSERT_FAILED",
  "AD_ACCOUNT_FORBIDDEN",
  "NOT_CONNECTED",
  "NEEDS_REAUTH",
  "TOKEN_FAILED",
  "AD_ACCOUNT_NOT_AUTHORIZED",
  "AD_ACCOUNT_NOT_ON_CONNECTION",
  "CURRENCY_MISMATCH",
  "BUDGET_ENVELOPE_EXCEEDED",
  "DECLARATION_REQUIRED",
  "CHANNEL_DENIED",
  "BLOCKED_TERM",
  "BLACKOUT",
  "QUIET_HOURS",
  "ASSET_NOT_APPROVED",
  "CAMPAIGN_REFUSED",
  "SHARED_BUDGET",
  "RATE_LIMITED",
  "PLATFORM_REFUSED",
  "PLATFORM_FAILED",
  "CREATE_FAILED",
  "CREATE_UNCONFIRMED",
  "NOT_CREATED_YET",
  "CAMPAIGN_FINISHED",
  "ADS_HALTED",
  "STATUS_PERSIST_FAILED",
  // G-14a: the targeting step's own sentences.
  "TARGETING_UNCONFIRMED",
  "TARGETING_PERSIST_FAILED",
  "TARGETING_UNREADABLE",
  "KEYWORD_PERSIST_FAILED",
  "NOT_SEARCH",
  "KEYWORD_NOT_FOUND",
  "AD_ACCOUNT_NOT_ALLOWED",
  // G-14b: the bidding routes' own sentences.
  "BIDDING_REFUSED",
  "SHARED_BIDDING_STRATEGY",
  "BIDDING_UNCONFIRMED",
]);

export function googleAdsErrorMessage(err: unknown, fallback: string): string {
  // ★The api's zod refusal is VALIDATION_ERROR too, worded "Invalid body"
  //  (review round 2): that is not a sentence for a merchant.
  if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && err.message === "Invalid body") {
    return adsErrorMessage(err, fallback, new Set());
  }
  return adsErrorMessage(err, fallback, GOOGLE_MERCHANT_FACING_CODES);
}

/**
 * ★A FAILED CREATE THAT MAY EXIST ON GOOGLE — read from the api's own marker,
 * not a copied list of codes (review round 2). The api attaches the row's
 * `managedCampaignId` when the create may have been sent and could not be
 * confirmed (`CREATE_UNCONFIRMED`): a second create could be a second
 * campaign, so the form closes and clears, as for a 202. Every other refusal
 * — before the row, or one the api archived because nothing was created —
 * keeps the form, so the merchant can fix it and try again, as its message
 * asks.
 */
export function googleCreateMayExist(err: unknown): boolean {
  // ★A FAILURE THAT IS NOT THE API'S ANSWER MAY HAVE REACHED IT (review round
  //  3): a dropped connection or an abort (not an ApiError), a proxy's 504
  //  page (PARSE_ERROR), a response with no api envelope (UNKNOWN). The api
  //  inserts the row and may send before any of those, so they count as
  //  "may exist" — losing the typed form is the cheap error; a second
  //  campaign on Google is not.
  if (!(err instanceof ApiError)) return true;
  if (err.code === "PARSE_ERROR" || err.code === "UNKNOWN") return true;
  // ★A 202 IS THE API'S "pending" (round 3): the api as deployed writes it
  //  outside its usual envelope, so the client raises it as an error.
  if (err.status === 202) return true;
  const id = (err.details as { managedCampaignId?: unknown } | null | undefined)?.managedCampaignId;
  return typeof id === "string" && id.length > 0;
}

/** G14c: removed on Google (mongodb mig 730), which cannot be undone. One rule for every reader of it. */
export function googleCampaignRemoved(c: Pick<GoogleCampaign, "status"> & Partial<Pick<GoogleCampaign, "removedAt">>): boolean {
  return !!c.removedAt && c.status === "archived";
}

/**
 * Whether a campaign's settings (targeting, bidding) can be changed from its row: Google has confirmed it, and it has
 * not finished. One rule for every row button (G-14b review round 1), as the api refuses the rest
 * (NOT_CREATED_YET, CAMPAIGN_FINISHED).
 */
export function googleCampaignSettable(c: Pick<GoogleCampaign, "platformCampaignId" | "status">): boolean {
  return !!c.platformCampaignId && c.status !== "archived" && c.status !== "completed";
}

/** Whether the failure means the connection itself needs attention. */
export function googleAdsNeedsReconnect(err: unknown): boolean {
  return err instanceof ApiError && (err.code === "NEEDS_REAUTH" || err.code === "NOT_CONNECTED" || err.code === "TOKEN_FAILED");
}

// ── A campaign's state, in words ────────────────────────────────────────

/**
 * The status badge. ★`draft` IS "PAUSED, NEVER STARTED": Google has no draft —
 * every PeakHour campaign is created PAUSED and is our `draft` until its first
 * activation (G-09).
 */
export function googleStatusLabel(
  c: Pick<GoogleCampaign, "status"> & Partial<Pick<GoogleCampaign, "platformCampaignId" | "createState" | "removedAt">>,
): string {
  // ★G14c: REMOVED ON GOOGLE is not "not running": it can never run again (mongodb mig 730).
  if (googleCampaignRemoved(c)) return "Removed";
  // ★A ROW GOOGLE HAS NOT CONFIRMED IS NOT "paused on Google" (round 3).
  if (!c.platformCampaignId && (c.createState === "sending" || c.createState === "outcome_unknown")) return "Not confirmed yet";
  if (!c.platformCampaignId && c.status === "archived") return "Not created";
  switch (c.status) {
    case "draft":
      return "Paused — not started yet";
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "completed":
      return "Finished";
    case "archived":
      return "Not running";
    case "review":
      return "In review";
    default:
      return c.status;
  }
}

/**
 * Whether Google has the campaign, in words — or null when it plainly does
 * (a platform id on the row, nothing pending). ★A REFUSED create says its
 * code; an UNCONFIRMED one says not to create it again, because a second
 * create would be a second campaign (G-09's 202).
 */
export function googleCreateNote(c: Pick<GoogleCampaign, "platformCampaignId" | "createState" | "refusedCode" | "status">): string | null {
  if (c.refusedCode) return `Not created — refused before anything was sent (${c.refusedCode}).`;
  if (c.platformCampaignId) return null;
  switch (c.createState) {
    case "sending":
    case "outcome_unknown":
      return "Google Ads hasn't confirmed this campaign yet. We check within the hour — don't create it again.";
    case "not_created":
      return "Google Ads has no record of this campaign, so nothing is running. Create it again when you're ready.";
    default:
      return c.status === "archived" ? "Not created on Google Ads." : "Waiting for Google Ads to confirm.";
  }
}

/**
 * The one action a row offers, or why it offers none. Activation needs a
 * campaign Google confirmed and one that has not finished; a pause needs an
 * active one. (The api enforces the same; the panel does not offer what it
 * would refuse.)
 */
export function googleStatusAction(
  c: Pick<GoogleCampaign, "status" | "platformCampaignId" | "schedule"> & Partial<Pick<GoogleCampaign, "removedAt">>,
  now: Date = new Date(),
): { status: GoogleSettableStatus; label: string } | { status: null; reason: string } {
  if (googleCampaignRemoved(c)) return { status: null, reason: "Removed" };
  // ★AN ARCHIVED ROW GOOGLE NEVER HAD WAS NOT "finished" (round 3): it was
  //  never created.
  if (c.status === "archived" && !c.platformCampaignId) return { status: null, reason: "Not created" };
  if (c.status === "completed" || c.status === "archived") return { status: null, reason: "Finished" };
  if (!c.platformCampaignId) return { status: null, reason: "Waiting for Google Ads" };
  if (c.status === "active") return { status: "PAUSED", label: "Pause" };
  // ★ONLY draft and paused start (review round 2): any other status ("review",
  //  one added later) offers nothing, never a charged activation by default.
  if (c.status !== "draft" && c.status !== "paused") return { status: null, reason: googleStatusLabel(c) };
  const endsAt = c.schedule?.endsAt ? Date.parse(c.schedule.endsAt) : NaN;
  if (Number.isFinite(endsAt) && endsAt <= now.getTime()) return { status: null, reason: "Its end date has passed" };
  return { status: "ACTIVE", label: c.status === "draft" ? "Start" : "Resume" };
}

// ── Money ────────────────────────────────────────────────────────────────

/** The shared money formatter (`formatMoneyOrNumber`), with a dash for an absent figure. */
export function formatGoogleMoney(amount: number | undefined, currency: string | undefined): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  return formatMoneyOrNumber(amount, currency);
}

/**
 * Today as `YYYY-MM-DD` in the BROWSER's zone (review round 2): the form sends
 * the end date as 23:59:59 local, so "today" must be the local day too — a
 * UTC day disagreed with the api for any merchant off UTC.
 */
export function localIsoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A `YYYY-MM-DD` end date that is today or later (the api refuses a past one). */
export function googleEndDateProblem(endDate: string, today: string): string | null {
  if (!endDate) return null;
  return endDate < today ? "The end date is in the past." : null;
}

/**
 * What stops the create form, in order, or null — the whole decision in one
 * tested place (review round 2): name, budget (finite and above zero: `1e309`
 * is Infinity and is sent as null), currency, end date, then the copy.
 */
export function googleCreateProblem(
  f: { name: string; budget: string; currency: string; endDate: string; searchAd: GoogleSearchAdInput },
  today: string,
): string | null {
  return googleSharedCreateProblem(f, today) ?? googleCopyProblem(f.searchAd);
}

/** The fields every Google campaign type shares, in order: name, budget, currency, end date. */
function googleSharedCreateProblem(f: { name: string; budget: string; currency: string; endDate: string }, today: string): string | null {
  if (f.name.trim().length === 0) return "Name the campaign.";
  const amount = Number(f.budget);
  if (!Number.isFinite(amount) || !(amount > 0)) return "Set a daily budget above zero.";
  if (!/^[A-Za-z]{3}$/.test(f.currency)) return "Set the budget's three-letter currency.";
  return googleEndDateProblem(f.endDate, today);
}

// ── The ad's copy — the api's own rule, checked before sending ───────────

/** No NUL or line break — the api's `BAD_TEXT` (round 3). Lines are split on breaks; a CR or NUL can remain. */
const BAD_TEXT = /[\u0000\n\r]/;

/** Responsive Search Ad bounds (peakhour-api `adapters/ads/google.ts`, `RSA`). */
export const GOOGLE_RSA = { headlines: { min: 3, max: 15, chars: 30 }, descriptions: { min: 2, max: 4, chars: 90 } } as const;

/**
 * Length as Google counts it: per character, and a double-width character
 * (Han, Hiragana, Katakana, Hangul, fullwidth forms) counts two — the api's
 * `chars`, which refuses the same copy, so the form says so before a request.
 */
const DOUBLE_WIDTH = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿！-｠￠-￦]/u;
export function googleTextWidth(s: string): number {
  return [...s].reduce((n, ch) => n + (DOUBLE_WIDTH.test(ch) ? 2 : 1), 0);
}

/** Lines of a textarea, trimmed, empty lines dropped. */
export function linesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** What is wrong with the ad's copy, in the api's words, or null. */
export function googleCopyProblem(ad: GoogleSearchAdInput): string | null {
  for (const what of ["headlines", "descriptions"] as const) {
    const b = GOOGLE_RSA[what];
    const items = ad[what];
    if (items.length < b.min || items.length > b.max) return `A search ad needs ${b.min} to ${b.max} ${what}, not ${items.length}.`;
    const bad = items.find((t) => BAD_TEXT.test(t));
    if (bad !== undefined) return `Each of the ${what} must be on one line, with no control characters.`;
    const long = items.find((t) => googleTextWidth(t) > b.chars);
    if (long !== undefined) return `Each of the ${what} must be at most ${b.chars} characters: "${long}" is ${googleTextWidth(long)}.`;
  }
  if (!isHttpsUrl(ad.finalUrl)) return "The landing page must be a full https:// address.";
  return null;
}

// ── G19: Performance Max ─────────────────────────────────────────────────

/** A campaign's type, in words. A row from before G19 carries SEARCH, the only type there was. */
export function googleChannelTypeLabel(t: GoogleChannelType | undefined): string {
  if (t === "PERFORMANCE_MAX") return "Performance Max";
  if (t === "DEMAND_GEN") return "YouTube video (Demand Gen)";
  if (t === undefined || t === "SEARCH") return "Search";
  // A type this build does not know is named as the api sent it, never called Search (review round 2).
  return String(t);
}

/**
 * ★★PLAN D3(b), SAID PLAINLY. Performance Max takes the audience as a hint,
 * and Google does not report who saw one of its ads, so PeakHour claims
 * neither: no "targeted at", no audience breakdown. Shown wherever a
 * Performance Max campaign is offered or listed.
 */
export const GOOGLE_PMAX_REPORTING_NOTE =
  "Google does not tell us who saw a Performance Max ad. The audience you give it is a hint, not a limit: Google may show the ads to other people too.";

/** What Performance Max is, before anyone creates one: Google assembles the ads and chooses where they show. */
export const GOOGLE_PMAX_DESCRIPTION =
  "Google builds the ads itself from your text and images and chooses where they show across its own channels.";

/**
 * Performance Max bounds (peakhour-api `adapters/ads/google-pmax.ts`, from
 * Google's asset requirements): the api refuses the same assets, so the form
 * says so before a request.
 */
export const GOOGLE_PMAX = {
  headlines: { min: 3, max: 15, chars: 30, label: "headlines" },
  longHeadlines: { min: 1, max: 5, chars: 90, label: "long headlines" },
  descriptions: { min: 2, max: 5, chars: 90, label: "descriptions" },
  businessNameChars: 25,
  images: {
    marketing: { min: 1, max: 20, label: "landscape images" },
    square: { min: 1, max: 20, label: "square images" },
    logos: { min: 1, max: 5, label: "logos" },
  },
} as const;

/**
 * One text field's lines against Google's bounds, in the api's order (count,
 * one line, width, distinct) — shared by Performance Max and YouTube video ads
 * (G20 review round 1), as the api shares `checkTextList`. `who` opens the
 * count sentence ("Performance Max needs …").
 */
function textListProblem(items: string[], b: { min: number; max: number; chars: number; label: string }, who: string): string | null {
  if (items.length < b.min || items.length > b.max) return `${who} needs ${b.min} to ${b.max} ${b.label}, not ${items.length}.`;
  if (items.some((t) => BAD_TEXT.test(t))) return `Each of the ${b.label} must be on one line, with no control characters.`;
  const long = items.find((t) => googleTextWidth(t) > b.chars);
  if (long !== undefined) return `Each of the ${b.label} must be at most ${b.chars} characters: "${long}" is ${googleTextWidth(long)}.`;
  if (new Set(items).size !== items.length) return `Each of the ${b.label} must be different.`;
  return null;
}

/** What is wrong with a Performance Max campaign's assets, in the api's words, or null. */
export function googlePmaxProblem(a: GooglePmaxInput): string | null {
  for (const what of ["headlines", "longHeadlines", "descriptions"] as const) {
    const p = textListProblem(a[what], GOOGLE_PMAX[what], "Performance Max");
    if (p) return p;
  }
  const name = a.businessName.trim();
  if (!name || BAD_TEXT.test(name) || googleTextWidth(name) > GOOGLE_PMAX.businessNameChars) {
    return `The business name must be 1 to ${GOOGLE_PMAX.businessNameChars} characters, counted as Google counts them: it is ${googleTextWidth(name)}.`;
  }
  if (!isHttpsUrl(a.finalUrl)) return "The landing page must be a full https:// address.";
  for (const what of ["marketing", "square", "logos"] as const) {
    const b = GOOGLE_PMAX.images[what];
    const urls = a.images[what];
    if (urls.length < b.min || urls.length > b.max) return `Performance Max needs ${b.min} to ${b.max} ${b.label}, not ${urls.length}.`;
    if (urls.some((u) => !isPublicHttpsUrl(u))) return `Each of the ${b.label} must be a full https:// address on a public host.`;
    if (new Set(urls).size !== urls.length) return `Each of the ${b.label} must be a different image.`;
  }
  // The api's `assertNoRatioClash`: a landscape image cannot also be a square image or a logo (both 1:1).
  const landscape = new Set(a.images.marketing);
  if (a.images.square.some((u) => landscape.has(u))) return "One image can't be both a landscape and a square image.";
  if (a.images.logos.some((u) => landscape.has(u))) return "One image can't be both a landscape image and a logo.";
  return null;
}

/** A landing page: https, no whitespace — the api's rule for both shapes (Search's `googleCopyProblem` and Performance Max's). */
function isHttpsUrl(u: string): boolean {
  try {
    return new URL(u).protocol === "https:" && !/\s/.test(u);
  } catch {
    return false;
  }
}

/**
 * An IMAGE URL: https on a public host, the api's `checkMediaUrl` (localhost,
 * .local, .internal, an IPv6 literal and private IPv4 ranges are refused; the
 * api also resolves the name). No whitespace rule: the api takes a URL `new
 * URL` can parse (review round 2).
 */
function isPublicHttpsUrl(u: string): boolean {
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.includes(":")) return false;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!v4) return true;
  const [a, b, c] = [Number(v4[1]), Number(v4[2]), Number(v4[3])];
  return !(
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0 && c === 0) || a >= 224
  );
}

/** The create form's decision for a Performance Max campaign: the shared fields first, then the assets. */
export function googlePmaxCreateProblem(
  f: { name: string; budget: string; currency: string; endDate: string; performanceMax: GooglePmaxInput },
  today: string,
): string | null {
  return googleSharedCreateProblem(f, today) ?? googlePmaxProblem(f.performanceMax);
}

// ── G20: YouTube video ads (Demand Gen) ──────────────────────────────────

/**
 * ★★PLAN D3(b), FOR YOUTUBE VIDEO ADS. Demand Gen takes the audience as a hint
 * too (Google's optimized targeting may reach past it), and Google does not
 * report who saw an ad, so PeakHour claims neither. Shown wherever a YouTube
 * video ad is offered, listed or started.
 */
export const GOOGLE_DEMAND_GEN_REPORTING_NOTE =
  "Google does not tell us who saw a YouTube video ad. The audience you give it is a hint, not a limit: Google may show the ads to other people too.";

/** Google's minimum daily budget for Demand Gen is per currency and read by the api; the form says so before the request. */
export const GOOGLE_DEMAND_GEN_BUDGET_NOTE =
  "Google sets a minimum daily budget for YouTube video ads in each currency. If yours is below it, we'll tell you before anything is created.";

/** What a YouTube video ad is, before anyone creates one: the merchant's own videos, already on YouTube. */
export const GOOGLE_DEMAND_GEN_DESCRIPTION =
  "Your own YouTube videos, shown as ads on YouTube. Use videos that are already on YouTube (public or unlisted): PeakHour never uploads one.";

/** The YouTube placements offered, in Google's order, with what each means. */
export const GOOGLE_YOUTUBE_CHANNELS: ReadonlyArray<{ value: GoogleYoutubeChannel; name: string; label: string }> = [
  { value: "youtube_in_stream", name: "YouTube in-stream", label: "YouTube in-stream (before, during or after other videos)" },
  { value: "youtube_in_feed", name: "YouTube in-feed", label: "YouTube in-feed (in search results and the home feed)" },
  { value: "youtube_shorts", name: "YouTube Shorts", label: "YouTube Shorts" },
];

/**
 * YouTube video ad bounds (peakhour-api `adapters/ads/google-demand-gen.ts`,
 * from Google Ads Help's Demand Gen specs): the api refuses the same ad, so
 * the form says so before a request.
 */
export const GOOGLE_DEMAND_GEN = {
  videos: { min: 1, max: 5, label: "YouTube videos" },
  headlines: { min: 1, max: 5, chars: 40, label: "headlines" },
  longHeadlines: { min: 1, max: 5, chars: 90, label: "long headlines" },
  descriptions: { min: 1, max: 5, chars: 90, label: "descriptions" },
  businessNameChars: 25,
  logos: { min: 1, max: 5, label: "square logos" },
} as const;

/** "The 11 character string value used in the YouTube video URL" (the api's `youtubeVideoId`). */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

/**
 * The YouTube video id in what a merchant pasted — the id, or a link to it — or
 * null. The api's own rule (`youtubeVideoId`), so the form refuses what the api
 * would: a video file, a channel page or a playlist is not a video on YouTube.
 */
export function youtubeVideoIdOf(raw: string): string | null {
  const text = raw.trim();
  if (YOUTUBE_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = /^\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? null;
  else if (YOUTUBE_HOSTS.has(host)) {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : (/^\/(?:shorts|embed|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? null);
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** What is wrong with a YouTube video ad, in the api's words, or null. */
export function googleDemandGenProblem(a: GoogleDemandGenInput): string | null {
  // ★THE API'S ORDER (`checkDemandGenAssets`, review round 1): text, then videos, name, landing page, logos, placements.
  for (const what of ["headlines", "longHeadlines", "descriptions"] as const) {
    const p = textListProblem(a[what], GOOGLE_DEMAND_GEN[what], "A YouTube video ad");
    if (p) return p;
  }
  const v = GOOGLE_DEMAND_GEN.videos;
  if (a.videos.length < v.min || a.videos.length > v.max) return `A YouTube video ad needs ${v.min} to ${v.max} ${v.label}, not ${a.videos.length}.`;
  const ids = a.videos.map(youtubeVideoIdOf);
  const badVideo = a.videos.find((_, i) => ids[i] === null);
  if (badVideo !== undefined) return `"${badVideo}" is not a YouTube video link or id.`;
  if (new Set(ids).size !== ids.length) return "Each YouTube video must be a different video.";
  const name = a.businessName.trim();
  if (!name || BAD_TEXT.test(name) || googleTextWidth(name) > GOOGLE_DEMAND_GEN.businessNameChars) {
    return `The business name must be 1 to ${GOOGLE_DEMAND_GEN.businessNameChars} characters, counted as Google counts them: it is ${googleTextWidth(name)}.`;
  }
  if (!isHttpsUrl(a.finalUrl)) return "The landing page must be a full https:// address.";
  const l = GOOGLE_DEMAND_GEN.logos;
  if (a.logos.length < l.min || a.logos.length > l.max) return `A YouTube video ad needs ${l.min} to ${l.max} ${l.label}, not ${a.logos.length}.`;
  if (a.logos.some((u) => !isPublicHttpsUrl(u))) return "Each logo must be a full https:// address on a public host.";
  if (new Set(a.logos).size !== a.logos.length) return "Each logo must be a different image.";
  if (a.channels.length === 0) return "Choose at least one YouTube placement.";
  return null;
}

/** The create form's decision for a YouTube video ad: the shared fields first, then the ad. */
export function googleDemandGenCreateProblem(
  f: { name: string; budget: string; currency: string; endDate: string; demandGen: GoogleDemandGenInput },
  today: string,
): string | null {
  return googleSharedCreateProblem(f, today) ?? googleDemandGenProblem(f.demandGen);
}

/**
 * Where a YouTube video ad may show, in words, and whether Google said so —
 * or null when the row carries no channels. ★"CONFIRMED" ONLY ON GOOGLE'S WORD
 * (`targetingApplied`): the api stores what it sent, unconfirmed, when Google's
 * answer did not carry the channels.
 */
export function googleChannelControlsSentence(cc: GoogleChannelControls | undefined): string | null {
  const places = googleChannelPlaces(cc);
  if (!places) return null;
  // ★"SET TO SHOW", NOT "SHOWS" (round 2): a draft or paused campaign shows nowhere yet.
  return cc!.targetingApplied ? `Set to show on ${places} — confirmed by Google.` : `Set to show on ${places}; Google hasn't confirmed it yet.`;
}

/**
 * Where a YouTube video ad's channel controls place it, as a phrase ("YouTube
 * in-stream and YouTube Shorts"), or null when the row carries none. The start
 * dialog and the row both say this (round 2): the dialog where money is
 * committed must not say less than the row above it.
 */
export function googleChannelPlaces(cc: GoogleChannelControls | undefined): string | null {
  if (!cc || cc.selected.length === 0) return null;
  // ★NEVER A RAW CHANNEL ID ON SCREEN (review round 1). Peakhour asks for
  //  YouTube's three only; any other channel Google reports is said as "other
  //  Google placements", once — not by Google's id, which would also name a
  //  campaign type this panel never offers.
  const youtube = GOOGLE_YOUTUBE_CHANNELS.filter((c) => cc.selected.includes(c.value)).map((c) => c.name);
  const list = cc.selected.some((c) => !GOOGLE_YOUTUBE_CHANNELS.some((y) => y.value === c)) ? [...youtube, "other Google placements"] : youtube;
  return list.length === 1 ? list[0]! : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

