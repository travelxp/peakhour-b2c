import { ApiError } from "@/lib/api";
import type { GoogleWebsiteConversionState, GoogleWebsiteTagSnippet } from "@/lib/api/google-ads";
import { PEAKHOUR_CONVERSION_ACTION_LABEL, googleConversionErrorMessage, googleConversionNeedsReconnect } from "@/lib/google-conversion-view";

/**
 * ★★G-14f — what the Google panel's "Website conversion tag" section SAYS,
 * kept pure so every sentence and decision is tested
 * (`google-website-conversion-view.test.ts`).
 *
 * The api half is the website-conversion route: a `WEBPAGE` conversion action
 * created SECONDARY, and the tag Google generates for it, shown as Google
 * gives it (RMF C.65).
 */

/** The name Peakhour gives the action it creates (api `PEAKHOUR_WEBSITE_CONVERSION_NAME`). */
export const PEAKHOUR_WEBSITE_CONVERSION_LABEL = "Peakhour website purchases";

export const GOOGLE_WEBSITE_CONVERSION_INTRO =
  "Google's own tag for your website. Add it to your site and Google Ads counts the purchases it sees there.";

/**
 * ★★WHY IT IS SECONDARY: the double count. Said beside the button, in the
 * confirmation and under the tag, so the merchant never reads one without it.
 */
export const GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE =
  "It is created as a secondary conversion action: Google Ads reports it but doesn't bid on it. " +
  // ★CONDITIONAL (review round 1): the upload runs only once Conversion tracking has an action chosen.
  `Once Conversion tracking is set up, Peakhour reports each sale to Google by its ad click (“${PEAKHOUR_CONVERSION_ACTION_LABEL}”), ` +
  "and if this tag counted the same purchase as a primary action too, Google would count it twice. " +
  "Making it primary is your call, in Google Ads.";

/** Said instead when Google reads the action as primary: the merchant changed it, or it was primary when adopted. */
export const GOOGLE_WEBSITE_CONVERSION_PRIMARY_WARNING =
  "This action is primary in Google Ads, so Google bids on it. " +
  `If “${PEAKHOUR_CONVERSION_ACTION_LABEL}” is primary too, each sale is counted twice. ` +
  "You can make one of them secondary in Google Ads.";

export const GOOGLE_WEBSITE_TAG_HOW_TO =
  "Paste the Google tag into the <head> of every page of your site, once. " +
  // ★NEVER gtag.js TWICE (review round 1): a site already running a Google tag (Analytics, a store's Google app) adds only the config line.
  "If your site already loads a Google tag (gtag.js), don't load it twice: add only its gtag('config', …) line to the tag you have.";

export const GOOGLE_WEBSITE_TAG_NOT_READY = "Google Ads hasn't generated this action's tag yet. Try again in a few minutes.";

/**
 * ★BOTH CAUSES (review round 1): the api's `storedNotLive` is the action
 * removed or disabled, OR the account's conversions now managed by another
 * account (cross-account tracking), where the action is still enabled.
 */
export const GOOGLE_WEBSITE_CONVERSION_GONE =
  "The website conversion action set up here can't be used any more: it was removed or disabled in Google Ads, " +
  "or this account's conversions are now managed by another Google Ads account. " +
  "Set it up again to get a working tag, and replace the old tag on your site with the new one.";

/** The confirmation before a create: a write to the merchant's live Google Ads account. */
export function googleWebsiteConversionConfirmation(accountName: string): { title: string; body: string } {
  return {
    title: `Add a website conversion action to ${accountName}?`,
    body:
      `Peakhour will add a conversion action named “${PEAKHOUR_WEBSITE_CONVERSION_LABEL}” to your Google Ads account ` +
      `${accountName}, and show you its tag. This changes your Google Ads account, and it spends nothing. ` +
      GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE,
  };
}

// ── The section's state ──────────────────────────────────────────────────

export type WebsiteConversionState =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "error" }
  | { kind: "not_set_up" }
  /** Set up once; removed or disabled in Google Ads since. */
  | { kind: "gone" }
  | { kind: "ready"; name: string; primaryForGoal: boolean; snippets: GoogleWebsiteTagSnippet[] }
  /** Set up, and Google has no snippet for it yet. */
  | { kind: "no_snippet"; name: string; primaryForGoal: boolean };

/** ★LOADING, OFFLINE AND ERROR ARE NEVER "NOT SET UP" (G-17b's rule): data wins when there is any. */
export function googleWebsiteConversionState(q: {
  data: GoogleWebsiteConversionState | undefined;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
}): WebsiteConversionState {
  if (q.data) {
    const a = q.data.action;
    if (!a) return q.data.storedNotLive ? { kind: "gone" } : { kind: "not_set_up" };
    const snippets = orderedSnippets(a.tagSnippets);
    return snippets.length > 0
      ? { kind: "ready", name: a.name, primaryForGoal: a.primaryForGoal, snippets }
      : { kind: "no_snippet", name: a.name, primaryForGoal: a.primaryForGoal };
  }
  if (q.isError) return { kind: "error" };
  if (q.fetchStatus === "paused") return { kind: "offline" };
  return { kind: "loading" };
}

/** The note under an action: the double-count reason when secondary, the warning when Google says primary. */
export function googleWebsiteConversionGoalNote(primaryForGoal: boolean): string {
  return primaryForGoal ? GOOGLE_WEBSITE_CONVERSION_PRIMARY_WARNING : GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE;
}

// ── Snippets ─────────────────────────────────────────────────────────────

const TYPE_ORDER = ["WEBPAGE", "WEBPAGE_ONCLICK"];
const FORMAT_ORDER = ["HTML", "AMP"];
const rank = (order: string[], v: string) => (order.includes(v) ? order.indexOf(v) : order.length);

/**
 * Google's snippets, page-load HTML first (what an order confirmation page
 * needs). ★ORDER ONLY: the text is never changed, and none is dropped.
 */
export function orderedSnippets(snippets: readonly GoogleWebsiteTagSnippet[]): GoogleWebsiteTagSnippet[] {
  return snippets
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(TYPE_ORDER, a.s.type) - rank(TYPE_ORDER, b.s.type) || rank(FORMAT_ORDER, a.s.pageFormat) - rank(FORMAT_ORDER, b.s.pageFormat) || a.i - b.i)
    .map(({ s }) => s);
}

/** A snippet's label in the picker, from Google's enums. An unknown value is said as Google's own word. */
export function googleWebsiteSnippetLabel(s: GoogleWebsiteTagSnippet): string {
  const what = s.type === "WEBPAGE" ? "When the page loads" : s.type === "WEBPAGE_ONCLICK" ? "When a button is clicked" : s.type;
  const format = s.pageFormat === "HTML" ? "HTML page" : s.pageFormat === "AMP" ? "AMP page" : s.pageFormat;
  return `${what} (${format})`;
}

/**
 * ★WHERE THE EVENT SNIPPET GOES DEPENDS ON ITS TYPE (review round 2): a
 * page-load snippet fires where it is pasted; a click snippet only defines
 * `gtag_report_conversion`, which fires nothing until a click calls it.
 */
export function googleWebsiteEventSnippetLabel(s: GoogleWebsiteTagSnippet): string {
  return s.type === "WEBPAGE_ONCLICK" ? "Event snippet — the page with the button" : "Event snippet — order confirmation page only";
}

export function googleWebsiteEventSnippetHowTo(s: GoogleWebsiteTagSnippet): string {
  return s.type === "WEBPAGE_ONCLICK"
    ? "Paste the event snippet on the page with the button, and call gtag_report_conversion() from the button's click: on its own it fires nothing."
    : "Paste the event snippet on your order confirmation page only.";
}

/**
 * A key for one snippet among the action's, ★UNIQUE BY POSITION (review round
 * 1): two snippets may share a type and format (an unknown or missing one is
 * "UNSPECIFIED"), and a shared key would hide the second for ever.
 */
export const googleWebsiteSnippetKey = (s: GoogleWebsiteTagSnippet, index: number): string => `${index}:${s.type}/${s.pageFormat}`;

// ── Errors and toasts ────────────────────────────────────────────────────

/** One sentence for a failed read or set-up: G-17b's words, except where they name the upload action. */
export function googleWebsiteConversionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.code === "CONVERSION_ACTION_REFUSED") {
    const d = err.details;
    const reason = d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>).reason : undefined;
    if (reason === "validation_conversion_action_name_taken") {
      return (
        "Every name Peakhour uses for its website conversion action is already taken in this Google Ads account, " +
        "or one was taken just now. Try again, or rename one of them in Google Ads (removing one does not free its name)."
      );
    }
  }
  return googleConversionErrorMessage(err, fallback);
}

/**
 * Whether the failure is fixed on the integrations page. ★AN UNREACHABLE
 * CONVERSION CUSTOMER TOO (review round 1): its sentence says "Reconnect
 * Google Ads through that manager account", so a Try again beside it would
 * fail the same way for ever.
 */
export function googleWebsiteConversionNeedsReconnect(err: unknown): boolean {
  if (googleConversionNeedsReconnect(err)) return true;
  if (!(err instanceof ApiError) || err.code !== "CONVERSION_ACTION_REFUSED") return false;
  const d = err.details;
  return !!d && typeof d === "object" && !Array.isArray(d) && (d as Record<string, unknown>).reason === "validation_conversion_customer_unreachable";
}

/** The toast after a set-up. */
export function googleWebsiteConversionSavedSentence(created: boolean, name: string): string {
  return created ? `Added “${name}” to your Google Ads account. Copy its tag below.` : `Here is the tag for “${name}”.`;
}
