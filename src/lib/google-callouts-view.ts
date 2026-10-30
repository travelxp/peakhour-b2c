import { ApiError } from "@/lib/api";
import type { GoogleCallout, GoogleCalloutAdded } from "@/lib/api/google-ads";
import { adsErrorMessage } from "@/lib/ads-error-message";
import { googleConversionNeedsReconnect } from "@/lib/google-conversion-view";

/**
 * ★★G-14e — what the Google panel's "Callouts" section SAYS, kept pure so
 * every sentence and decision is tested (`google-callouts-view.test.ts`).
 *
 * The api half is the callouts route: a `CALLOUT` asset linked to the Google
 * Ads account (RMF C.75, "supported at the account level only"), its text
 * checked against Google's ad policies before it is created.
 */

export const GOOGLE_CALLOUTS_INTRO =
  "Short lines Google can show under your Search ads, like “Free UK delivery” or “30-day returns”. " +
  "Each one is added to the whole Google Ads account, so it can appear with every Search ad in it.";

/**
 * ★ACCOUNT LEVEL ONLY, AND WHAT THAT MEANS (Google, support answer 6079510):
 * "If you created these ad assets at a more granular level, they will prevent
 * higher level callout assets from serving." A merchant who expects
 * campaign-level callouts is told where they live, and what they do to these.
 */
export const GOOGLE_CALLOUTS_ACCOUNT_LEVEL_NOTE =
  "Peakhour adds callouts to the whole account only. To give one campaign or ad group its own callouts, add them in Google Ads; " +
  "where you do, Google shows those instead of these for that campaign or ad group.";

/** Said before the merchant writes one: the policy check, and that it spends nothing. */
export const GOOGLE_CALLOUT_CHECK_NOTE =
  "Before it is added, we check the text against Google's ad policies. Adding a callout costs nothing; Google reviews it too.";

// ── The text ─────────────────────────────────────────────────────────────

/** Google's limit (v26 `CalloutAsset.callout_text`: "between 1 and 25, inclusive"). The api checks it too. */
export const GOOGLE_CALLOUT_MAX = 25;

/** East Asian Wide and Fullwidth (UAX #11): the api's `calloutTextWidth` ranges, so the counter and the refusal agree. */
const DOUBLE_WIDTH =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3FFFD}]/u;

/** A callout's length as Google limits it: a Chinese, Japanese or Korean character counts two. */
export function googleCalloutWidth(text: string): number {
  let width = 0;
  for (const ch of text.trim()) width += DOUBLE_WIDTH.test(ch) ? 2 : 1;
  return width;
}

/** The counter under the field, and whether the text can be sent at all. */
export function googleCalloutLength(text: string): { label: string; over: boolean; empty: boolean; multiline: boolean } {
  const width = googleCalloutWidth(text);
  return {
    label: `${width}/${GOOGLE_CALLOUT_MAX}`,
    over: width > GOOGLE_CALLOUT_MAX,
    empty: text.trim().length === 0,
    // ★The api refuses control characters (review round 1): a tab pasted from a spreadsheet is said here, before a round trip.
    // eslint-disable-next-line no-control-regex
    multiline: /[\u0000-\u001F\u007F]/.test(text.trim()),
  };
}

/** Said under the field when the text holds a line break or a tab (the api's own sentence). */
export const GOOGLE_CALLOUT_ONE_LINE = "A callout is one line of text, with no line breaks or tabs.";

export const GOOGLE_CALLOUT_LENGTH_HINT = "Up to 25 characters (12 in Chinese, Japanese or Korean).";

// ── One callout's labels ─────────────────────────────────────────────────

/** Google's serving status for the link, in words. An unknown value is said as Google's own word. */
export function googleCalloutStatusLabel(c: Pick<GoogleCallout, "status" | "primaryStatus">): string {
  if (c.status === "PAUSED") return "Paused in Google Ads";
  switch (c.primaryStatus) {
    case "ELIGIBLE":
      return "Can show";
    case "LIMITED":
      return "Showing in a limited way";
    case "NOT_ELIGIBLE":
      return "Not showing";
    case "PENDING":
      return "Waiting for Google";
    case "PAUSED":
      return "Paused in Google Ads";
    case "UNSPECIFIED":
    case "UNKNOWN":
      return "Google hasn't said yet";
    default:
      return c.primaryStatus;
  }
}

/** Whether the status is one the merchant should look at. */
export const googleCalloutStatusIsProblem = (c: Pick<GoogleCallout, "status" | "primaryStatus">): boolean =>
  c.status === "ENABLED" && (c.primaryStatus === "NOT_ELIGIBLE" || c.primaryStatus === "LIMITED");

/** "Dynamic callouts" Google adds itself are listed too, and labelled as Google's. */
export const googleCalloutAddedByGoogle = (c: Pick<GoogleCallout, "source">): boolean => c.source === "AUTOMATICALLY_CREATED";

/** The confirmation before an unlink. ★The asset stays: Google assets cannot be deleted. */
export function googleCalloutRemoveConfirmation(text: string): { title: string; body: string } {
  return {
    title: `Remove “${text}”?`,
    body:
      "It stops showing with your Search ads. Google Ads keeps the text as an unused asset in your account " +
      "(Google doesn't let assets be deleted), and you can add the callout again at any time.",
  };
}

// ── Adding ───────────────────────────────────────────────────────────────

/** The toast after an add. */
export function googleCalloutAddedSentence(res: Pick<GoogleCalloutAdded, "created" | "callout" | "policy">): string {
  if (!res.created) return `Your account already has “${res.callout.text}”.`;
  if (res.policy && !res.policy.checked) {
    return `Added “${res.callout.text}”. Our policy check couldn't run, so Google's own review is the only one.`;
  }
  return `Added “${res.callout.text}”. Google reviews it before it shows.`;
}

/** The policy check's warning, when that is why the add was refused: shown with "Add anyway". */
export function googleCalloutPolicyWarning(err: unknown): string | null {
  return err instanceof ApiError && err.code === "CALLOUT_POLICY_WARNING" ? err.message : null;
}

/** An add the api could not confirm: it may exist, and asking again adds no second. */
export const googleCalloutMayHaveBeenAdded = (err: unknown): boolean => err instanceof ApiError && err.code === "CALLOUT_UNCONFIRMED";

/** Api codes whose message is written for the merchant. */
const MERCHANT_FACING_CODES: ReadonlySet<string> = new Set([
  "NO_BUSINESS",
  "FORBIDDEN",
  "NOT_CONNECTED",
  "NEEDS_REAUTH",
  "TOKEN_FAILED",
  "AD_ACCOUNT_NOT_ALLOWED",
  "AD_ACCOUNT_NOT_AUTHORIZED",
  "AD_ACCOUNT_FORBIDDEN",
  "RATE_LIMITED",
  "PLATFORM_REFUSED",
  "PLATFORM_FAILED",
  "VALIDATION_ERROR",
  "CALLOUT_REPEATS",
  "BLOCKED_TERM",
  "CALLOUT_POLICY_BLOCKED",
  "CALLOUT_POLICY_WARNING",
  "CALLOUT_UNCONFIRMED",
  "POLICY_CHECK_UNAVAILABLE",
  // ★Review round 1: a refusal of our own before sending (a malformed id), said by the api for a merchant.
  "CALLOUT_REFUSED",
]);

/**
 * One sentence for a failed read, add or remove. ★The api's zod refusal
 * ("Invalid body") is not a sentence for a merchant (G-15's rule), so it shows
 * the fallback.
 */
export function googleCalloutErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && err.message === "Invalid body") {
    return err.requestId ? `${fallback} (reference ${err.requestId})` : fallback;
  }
  if (err instanceof ApiError && err.code === "CALLOUT_POLICY_BLOCKED") {
    return `Google's ad policies wouldn't allow this callout: ${err.message}`;
  }
  return adsErrorMessage(err, fallback, MERCHANT_FACING_CODES);
}

/** Whether the failure is fixed on the integrations page. */
export function googleCalloutNeedsReconnect(err: unknown): boolean {
  // ★G-17b's list, not a fourth copy of it (review round 1): the callout routes answer from the same account check.
  return googleConversionNeedsReconnect(err);
}

// ── The section's state ──────────────────────────────────────────────────

export type GoogleCalloutsState =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "error" }
  | { kind: "none" }
  | { kind: "list"; callouts: GoogleCallout[] };

/** ★LOADING, OFFLINE AND ERROR ARE NEVER "NONE" (G-17b's rule): data wins when there is any. */
export function googleCalloutsState(q: {
  data: { callouts: GoogleCallout[] } | undefined;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
}): GoogleCalloutsState {
  if (q.data) return q.data.callouts.length > 0 ? { kind: "list", callouts: q.data.callouts } : { kind: "none" };
  if (q.isError) return { kind: "error" };
  if (q.fetchStatus === "paused") return { kind: "offline" };
  return { kind: "loading" };
}
