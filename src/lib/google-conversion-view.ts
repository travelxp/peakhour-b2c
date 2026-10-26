import { ApiError } from "@/lib/api";
import { adsErrorMessage } from "@/lib/ads-error-message";
import type { GoogleConversionActionState } from "@/lib/api/google-ads";

/**
 * ★★G-17b — what the Google Ads panel's "Conversion tracking" section SAYS,
 * kept pure so every sentence and decision is tested
 * (`google-conversion-view.test.ts`).
 *
 * The api half is G-17 (the conversion-action route, read by GET and chosen by PUT): G-08's
 * daily upload sends nothing until a conversion action is chosen here.
 */

/** The name Peakhour gives the action it creates (api `PEAKHOUR_CONVERSION_ACTION_NAME`). */
export const PEAKHOUR_CONVERSION_ACTION_LABEL = "Peakhour offline purchases";

export const GOOGLE_CONVERSION_NOT_SET_UP = "Not set up — Peakhour can't report sales to Google yet.";

/**
 * Why Peakhour reports sales to Google at all, and the one limit a merchant
 * must know: Google may not use conversions for EEA/UK shoppers until consent
 * is set.
 */
export const GOOGLE_CONVERSION_CONSENT_NOTE =
  "Conversions for shoppers in the EEA or UK may not be used by Google until consent is set: " +
  "in Google Ads, open Tools → Data Manager → Consent settings.";

/** Said beside Create, and again in its confirmation: it is secondary, so bidding is untouched. */
export const GOOGLE_CONVERSION_SECONDARY_NOTE =
  "It is created as a secondary conversion action, so it does not change how Smart Bidding optimises. " +
  "Making it primary is your choice, in Google Ads.";

/** The confirmation before a create — a write to the merchant's live Google Ads account. */
export function googleConversionCreateConfirmation(accountName: string): { title: string; body: string } {
  return {
    title: `Add a conversion action to ${accountName}?`,
    body:
      `Peakhour will add a conversion action named “${PEAKHOUR_CONVERSION_ACTION_LABEL}” to your Google Ads account ` +
      `${accountName}. This changes your Google Ads account, and it spends nothing. ${GOOGLE_CONVERSION_SECONDARY_NOTE}`,
  };
}

// ── The card's state ─────────────────────────────────────────────────────

export type ConversionCardState =
  | { kind: "loading" }
  /** The query is paused (no network) and has nothing: not "not set up". */
  | { kind: "offline" }
  | { kind: "error" }
  | { kind: "not_set_up" }
  /** Chosen, and still an enabled UPLOAD_CLICKS action Google would accept. */
  | { kind: "chosen"; name: string }
  /** Chosen once; removed or disabled in Google Ads since. */
  | { kind: "chosen_not_live"; name: string };

/**
 * ★LOADING, OFFLINE AND ERROR ARE NEVER "NOT SET UP" (the panel's rule;
 * react-query v5): `isLoading` is false for a paused query, so offline with no
 * data would fall through to the empty state — which is a claim. Data wins
 * when there is any, so a failed background refetch keeps what was read.
 */
export function googleConversionCardState(q: {
  data: GoogleConversionActionState | undefined;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
}): ConversionCardState {
  if (q.data) {
    const sel = q.data.selected;
    if (!sel) return { kind: "not_set_up" };
    const name = sel.name && sel.name.length > 0 ? sel.name : `Conversion action ${sel.conversionActionId}`;
    // `selectedIsLive: false` is Google's verdict; `null` with a selection is
    // not expected, and is not read as "live".
    return q.data.selectedIsLive === true ? { kind: "chosen", name } : { kind: "chosen_not_live", name };
  }
  if (q.isError) return { kind: "error" };
  if (q.fetchStatus === "paused") return { kind: "offline" };
  return { kind: "loading" };
}

export function googleConversionStateSentence(s: ConversionCardState): string {
  switch (s.kind) {
    case "loading":
      return "Checking your conversion tracking…";
    case "offline":
      return "You're offline, so we can't check your conversion tracking. It will load when you're back online.";
    case "error":
      return "We couldn't read your conversion tracking from Google Ads just now.";
    case "not_set_up":
      return GOOGLE_CONVERSION_NOT_SET_UP;
    case "chosen":
      return `Peakhour reports your sales to Google as “${s.name}”.`;
    case "chosen_not_live":
      return (
        `You chose “${s.name}”, but it is no longer an enabled import-from-clicks action in Google Ads, ` +
        "so Peakhour can't report sales to Google. Choose another or create a new one."
      );
  }
}

/** The select's default: the stored choice when it is still offered, else nothing (never a guess). */
export function googleConversionDefaultChoice(data: GoogleConversionActionState | undefined): string | undefined {
  const id = data?.selected?.conversionActionId;
  return id && data?.actions.some((a) => a.id === id) ? id : undefined;
}

/** Whether "Use this one" does anything: an offered action that is not already the live choice. */
export function googleConversionCanUse(data: GoogleConversionActionState | undefined, choice: string | undefined): boolean {
  if (!data || !choice || !data.actions.some((a) => a.id === choice)) return false;
  return !(data.selected?.conversionActionId === choice && data.selectedIsLive === true);
}

// ── Errors ───────────────────────────────────────────────────────────────

/** Api codes whose message is written for the merchant, and not overridden below. */
const MERCHANT_FACING_CODES: ReadonlySet<string> = new Set([
  "NO_BUSINESS",
  "FORBIDDEN",
  "NOT_CONNECTED",
  "NEEDS_REAUTH",
  "TOKEN_FAILED",
  "AD_ACCOUNT_NOT_AUTHORIZED",
  "AD_ACCOUNT_FORBIDDEN",
  "RATE_LIMITED",
  "PLATFORM_REFUSED",
  "PLATFORM_FAILED",
  "CONNECTION_GONE",
]);

/** `details.reason` of a CONVERSION_ACTION_REFUSED, in the merchant's words. */
const REFUSAL_REASONS: Readonly<Record<string, string>> = {
  validation_conversion_customer_unreachable:
    "Conversions for this Google Ads account are managed by a different manager account, which your Peakhour " +
    "connection doesn't reach. Reconnect Google Ads through that manager account, then try again.",
  validation_conversion_customer:
    "Google Ads didn't clearly say which account manages conversions here, so Peakhour won't guess. " +
    "Try again in a moment.",
  validation_conversion_action_name_taken:
    "Every name Peakhour uses for its conversion action is already taken in this Google Ads account, " +
    "or one was taken just now. Try again, or choose an existing import-from-clicks action instead.",
};

const detailsOf = (err: unknown): Record<string, unknown> => {
  const d = err instanceof ApiError ? err.details : undefined;
  return d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
};

/**
 * One sentence for a failed read or choice. Every refusal says WHY; anything
 * the api did not author for a merchant shows the caller's fallback (with the
 * request reference), never a raw message.
 */
export function googleConversionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "AD_ACCOUNT_NOT_ALLOWED":
        return "This Google Ads account isn't on your Peakhour connection. Reconnect Google Ads and share this account, then try again.";
      case "CONVERSION_ACTION_NOT_FOUND":
        return "That isn't an enabled import-from-clicks conversion action in this Google Ads account any more. Choose another from the refreshed list.";
      case "CONVERSION_ACTION_UNCONFIRMED":
        return (
          "Google Ads may have added the conversion action, but we couldn't confirm it yet. " +
          `Wait a few minutes and try again: it will pick up the one that was added, not add a second.`
        );
      case "CONVERSION_ACTION_REFUSED": {
        const reason = detailsOf(err).reason;
        if (typeof reason === "string" && Object.hasOwn(REFUSAL_REASONS, reason)) return REFUSAL_REASONS[reason]!;
        // ★An unlisted reason is not trusted to carry words for a merchant (review round 1).
        break;
      }
    }
  }
  return adsErrorMessage(err, fallback, MERCHANT_FACING_CODES);
}

/** A confirm-on-retry state: the create may have landed, so the button must not read as "nothing happened". */
export function googleConversionMayHaveBeenCreated(err: unknown): boolean {
  return err instanceof ApiError && err.code === "CONVERSION_ACTION_UNCONFIRMED";
}

/** Whether the failure means the connection itself needs attention. */
export function googleConversionNeedsReconnect(err: unknown): boolean {
  return err instanceof ApiError && ["NEEDS_REAUTH", "NOT_CONNECTED", "TOKEN_FAILED", "AD_ACCOUNT_NOT_ALLOWED", "AD_ACCOUNT_NOT_AUTHORIZED"].includes(err.code);
}

/**
 * The name of the stored choice a REFUSED read carried (`details.selected`),
 * so the card can say what is configured while it cannot say whether it works.
 */
export function googleConversionErrorSelection(err: unknown): string | null {
  const sel = detailsOf(err).selected;
  if (!sel || typeof sel !== "object") return null;
  const { name, conversionActionId } = sel as { name?: unknown; conversionActionId?: unknown };
  if (typeof name === "string" && name.length > 0) return name;
  return typeof conversionActionId === "string" && conversionActionId.length > 0 ? `Conversion action ${conversionActionId}` : null;
}

/** The toast after a successful choice. */
export function googleConversionSavedSentence(created: boolean, name: string | undefined): string {
  const label = name ? `“${name}”` : "the conversion action";
  return created
    ? `Added ${label} to your Google Ads account. Peakhour will report sales to it.`
    : `Peakhour will report sales to ${label}.`;
}
