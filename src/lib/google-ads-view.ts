import { ApiError } from "@/lib/api";
import { formatPeaks } from "@/lib/pricing";
import type { RateCardUseCase } from "@/hooks/use-credits";
import type { GoogleCampaign, GoogleSearchAdInput, GoogleSettableStatus } from "@/lib/api/google-ads";

/**
 * ★★G-15 — what the Google Ads panel SAYS, kept pure so every sentence and
 * every decision is tested (`google-ads-view.test.ts`).
 *
 * ⏸SEARCH ONLY. Nothing here names another Google campaign type: the api
 * creates Responsive Search Ad campaigns and nothing else, and a surface that
 * offered a type the adapter refuses would be worse than one that offers
 * fewer (the plan's G-15 row).
 */

// ── The launch charge ────────────────────────────────────────────────────

/** Seeded by peakhour-mongodb mig 470 at 30 Peaks; charged on first activation. */
export const GOOGLE_LAUNCH_USE_CASE = "google.campaign_launched";

/**
 * The sentence beside Activate — Meta's rule (`metaLaunchChargeSentence`):
 * the price is the rate card's `creditMultiplier`, charged once, the first
 * time a campaign PeakHour created goes live. `undefined` (the card has not
 * loaded) says so rather than guessing a number.
 */
export function googleLaunchChargeSentence(row: Pick<RateCardUseCase, "free" | "creditMultiplier"> | undefined): string {
  const scope = "Campaigns you made in Google Ads itself are never charged.";
  if (!row) return `A campaign PeakHour created may be charged Peaks the first time it goes live. ${scope}`;
  if (row.free) return `Starting a campaign is free. ${scope}`;
  return (
    `A campaign PeakHour created is charged ${formatPeaks(row.creditMultiplier)} Peaks, once, the first time it goes live. ` +
    `Pausing and resuming it costs nothing. ${scope}`
  );
}

// ── Errors ───────────────────────────────────────────────────────────────

/**
 * The api codes whose message is written for the merchant (peakhour-api
 * `routes/google-ads`, G-09). Any other code shows the caller's fallback with
 * the request reference, never a raw message.
 */
export const GOOGLE_MERCHANT_FACING_CODES: ReadonlySet<string> = new Set([
  "NO_BUSINESS",
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
]);

export function googleAdsErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (GOOGLE_MERCHANT_FACING_CODES.has(err.code)) return err.message;
    return err.requestId ? `${fallback} (reference ${err.requestId})` : fallback;
  }
  return fallback;
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
export function googleStatusLabel(c: Pick<GoogleCampaign, "status">): string {
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
  c: Pick<GoogleCampaign, "status" | "platformCampaignId" | "schedule">,
  now: Date = new Date(),
): { status: GoogleSettableStatus; label: string } | { status: null; reason: string } {
  if (c.status === "completed" || c.status === "archived") return { status: null, reason: "Finished" };
  if (!c.platformCampaignId) return { status: null, reason: "Waiting for Google Ads" };
  if (c.status === "active") return { status: "PAUSED", label: "Pause" };
  const endsAt = c.schedule?.endsAt ? Date.parse(c.schedule.endsAt) : NaN;
  if (Number.isFinite(endsAt) && endsAt <= now.getTime()) return { status: null, reason: "Its end date has passed" };
  return { status: "ACTIVE", label: c.status === "draft" ? "Start" : "Resume" };
}

// ── Money ────────────────────────────────────────────────────────────────

export function formatGoogleMoney(amount: number | undefined, currency: string | undefined): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  if (!currency) return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
  }
}

// ── The ad's copy — the api's own rule, checked before sending ───────────

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
    const long = items.find((t) => googleTextWidth(t) > b.chars);
    if (long !== undefined) return `Each of the ${what} must be at most ${b.chars} characters: "${long}" is ${googleTextWidth(long)}.`;
  }
  let url: URL;
  try {
    url = new URL(ad.finalUrl);
  } catch {
    return "The landing page must be a full https:// address.";
  }
  if (url.protocol !== "https:" || /\s/.test(ad.finalUrl)) return "The landing page must be a full https:// address.";
  return null;
}
