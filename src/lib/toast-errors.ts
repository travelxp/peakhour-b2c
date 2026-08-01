import { toast } from "sonner";
import { ApiError } from "@/lib/api";

/**
 * Friendly last-resort toast for an API failure a mutation's own `code`
 * branches didn't recognise.
 *
 * TWO THINGS WENT WRONG BEFORE THIS EXISTED, and it has to fix both
 * without trading one for the other:
 *
 *  1. The LinkedIn Ads surfaces ended their onError chains with a bare
 *     `toast.error("Couldn't X. Try again in a moment.")`. Every boost
 *     was failing with PROVIDER_4XX_CREATE_CAMPAIGN_GROUP — a 100%
 *     reproducible API-contract bug — and users were told to retry. It
 *     went unnoticed for months.
 *  2. The obvious fix (render `err.message`) is worse HERE: the api's
 *     message for those codes is LinkedIn's raw response body, and for
 *     the catch-alls it is an arbitrary exception string — JSON dumps,
 *     internal ids, even config names like "LINKEDIN_CLIENT_ID is not
 *     set". That is what `no-raw-ai-errors-to-users` forbids, and what
 *     `engageErrorMessage` (audience-panel.tsx) already protects against
 *     for LinkedIn Engage.
 *
 * So: the CODE picks plain-language copy, the raw message stays in the
 * api's logs, and the request id goes in the toast as the handle support
 * needs to find them.
 *
 * NOT A BLANKET RULE. Where a route sanitizes at its own boundary and
 * returns curated copy — x-ads' `failFrom` is the example — rendering
 * `err.message` is CORRECT and this helper would throw information away.
 * Use it for surfaces whose messages can carry provider text.
 *
 * RETRYABILITY COMES FROM THE CODE, NOT THE STATUS. The api returns
 * PROVIDER_4XX_* with HTTP 502 (a platform rejection isn't the caller's
 * fault, but it also won't change on retry), so a status-based split
 * gets the motivating case exactly backwards.
 */

/**
 * Second sentence for every ads NEEDS_REAUTH toast.
 *
 * LinkedIn returns the SAME "Not enough permissions" 403 for a short scope
 * grant (a reconnect fixes it) and for a member with no role on the ad
 * account (only an ad-account admin can). The api can't tell them apart
 * from the response, so it stopped promising a reconnect would work — but
 * every surface hardcodes its own reconnect sentence and drops the api's
 * `message`, so that nuance reached no user until this existed.
 */
export const RECONNECT_NUANCE =
  "If reconnecting doesn't help, your LinkedIn user may not have access to this ad " +
  "account — an ad-account admin has to grant it.";

/** What the code family tells us about who can act, and how. */
type Disposition =
  /** Transient. Say "try again in a moment" and stop there. */
  | "retry"
  /** The user can fix it themselves (reconnect, wait out a limit). */
  | "user_fixable"
  /** Real, reproducible, ours to diagnose. Point at support. */
  | "permanent";

/** Codes a caller could reasonably not have branched on, but which the
 *  user can still act on. Kept explicit — these must never collapse
 *  into "contact support". */
const USER_FIXABLE = new Set([
  "NOT_CONNECTED",
  "NO_AD_ACCOUNT",
  "NEEDS_REAUTH",
  "RATE_LIMITED",
  "FORBIDDEN",
  "INVALID_TRANSITION",
  // ★The api authors an actionable sentence for each of these and, without
  // this list, none of it reached anyone: a 409 falls through to "permanent",
  // which renders a non-dismissable "contact support and quote a reference"
  // toast. Telling a user to open a ticket because their audience moved in
  // another tab is exactly the failure this file exists to prevent.
  "PROVENANCE_STALE",
  "NO_PROVENANCE",
  "NOT_A_PROPOSAL",
  "CONFIRM_FAILED",
  // ★AND `NOT_FOUND`, which is the one that would have fired most often. It is
  // also what `app.onError`'s unknown-route handler returns, so if b2c ships
  // ahead of the api EVERY click on a new endpoint tells the user to open a
  // support ticket — a deploy-order hazard, not a hypothetical.
  "NOT_FOUND",
]);

const USER_FIXABLE_COPY: Record<string, string> = {
  NOT_CONNECTED: "Connect the ad account first, from Integrations.",
  NO_AD_ACCOUNT: "That connection has no ad account — reconnect it, or create one on the platform.",
  NEEDS_REAUTH: "The connection needs reconnecting, from Integrations.",
  RATE_LIMITED: "The platform is rate-limiting us — give it a minute and try again.",
  FORBIDDEN: "Pick a business first.",
  INVALID_TRANSITION: "That change isn't possible from the campaign's current state.",
  PROVENANCE_STALE:
    "This audience has changed since we described it — reload, or open the audience editor to see what it is now.",
  NO_PROVENANCE: "There's no audience record on this campaign to approve.",
  NOT_A_PROPOSAL: "You set this audience yourself, so there's nothing for us to record.",
  CONFIRM_FAILED: "Couldn't record that just now — try again.",
  NOT_FOUND: "That's gone — reload the page to see what's there now.",
};

function dispositionOf(code: string, status: number): Disposition {
  if (USER_FIXABLE.has(code)) return "user_fixable";

  // "2xx with no id header" — the artefact almost certainly EXISTS
  // platform-side and we never learned its id, so it can be neither
  // rolled back nor deduped. Retrying mints a FRESH orphan campaign
  // group in the customer's ad account on every click. 5xx-shaped, but
  // the least retryable failure in the set.
  if (code.endsWith("_ID_MISSING")) return "permanent";

  // The platform rejected the request itself. Repeating it unchanged
  // gets the same answer.
  if (code.startsWith("PROVIDER_4XX_") || code.startsWith("VALIDATION_")) return "permanent";

  // Our app isn't authorised on the advertiser account. Emphatically NOT
  // user_fixable — that classification is what produced a Reconnect CTA
  // for a problem no reconnect can reach. See toastAdAccountNotAuthorized
  // for the surfaces that say it properly. Explicit rather than left to
  // the status-based tail: a 403 already falls through to "permanent", but
  // the api could answer 5xx on a future path and the tail would then say
  // "try again" forever.
  if (code === "AD_ACCOUNT_NOT_AUTHORIZED") return "permanent";
  // Advertiser-fixable on the platform (billing hold, suspended account,
  // access removed) — permanent for US, and the surfaces that can act on
  // it render the api's authored message instead of this floor.
  if (code === "AD_ACCOUNT_FORBIDDEN") return "permanent";

  // Route catch-alls for a NON-AdsOpError throw, i.e. an unexpected
  // programming or config error ("LINKEDIN_CLIENT_ID is not set").
  // 5xx-shaped and never transient — telling the user to retry means
  // telling them to retry forever.
  if (
    code === "BOOST_FAILED" ||
    code === "SYNC_FAILED" ||
    code === "UPDATE_FAILED" ||
    code === "TARGETING_FAILED" ||
    code === "INTERNAL_ERROR" ||
    code === "ADAPTER_MISSING" ||
    code === "CONFIG_ERROR" ||
    // The *_PERSIST_FAILED pair are qualified failures — the platform
    // write landed, only our mirror didn't. Surfaces that can act on
    // that branch on the code explicitly and show the server's own
    // (hardcoded, safe) wording; reaching here means an unhandled
    // surface, where "contact support" is the right floor.
    code === "PERSIST_FAILED" ||
    code === "STATUS_PERSIST_FAILED"
  ) {
    return "permanent";
  }

  // Genuinely transient: the platform or the transport wobbled.
  if (code.startsWith("PROVIDER_5XX_") || code.startsWith("NETWORK_")) return "retry";
  if (code === "TOKEN_FAILED" || code === "PARSE_ERROR") return "retry";

  // Unrecognised code. A 5xx is at least more likely transient than a
  // 4xx, which we treat as reproducible.
  return status >= 500 ? "retry" : "permanent";
}

/**
 * @param whatFailed lower-case verb phrase — "create the campaign".
 * @param platform display name of the ad platform, when the caller
 *   knows it. Omit on multi-platform surfaces rather than guessing —
 *   naming the wrong platform is worse than naming none.
 */
export function toastUnhandledApiError(
  err: unknown,
  whatFailed: string,
  platform?: string,
): void {
  const apiError = err instanceof ApiError ? err : null;

  if (!apiError) {
    // Not an api response at all — a thrown TypeError from fetch, i.e.
    // offline / DNS / CORS. Genuinely worth another go.
    toast.error(`Couldn't ${whatFailed}. Check your connection and try again.`);
    return;
  }

  const disposition = dispositionOf(apiError.code, apiError.status);

  if (disposition === "retry") {
    // Self-healing — the sentence is complete on its own. A support
    // reference here would be noise on something a second click fixes.
    toast.error(`Couldn't ${whatFailed}. Try again in a moment.`);
    return;
  }

  if (disposition === "user_fixable") {
    toast.error(`Couldn't ${whatFailed}.`, {
      description: USER_FIXABLE_COPY[apiError.code],
    });
    return;
  }

  // Permanent. This is the one case where the user genuinely needs to
  // reach us, so the toast has to survive long enough to be read and
  // copied — hence no auto-dismiss (the Toaster provides a close
  // button). The request id is the ONLY technical detail we surface:
  // an opaque uuid that leaks nothing and is the key to the server-side
  // log holding the provider's actual words.
  const rejected = platform
    ? `${platform} rejected the request.`
    : "The request was rejected.";
  const support = apiError.requestId
    ? `Our team has the details — please contact support and quote reference ${apiError.requestId}.`
    : "Our team has the details — please contact support.";

  toast.error(`Couldn't ${whatFailed}.`, {
    description: `${rejected} ${support}`,
    duration: Infinity,
  });
}

/**
 * AD_ACCOUNT_NOT_AUTHORIZED — the ad platform refuses the account because
 * OUR APP hasn't been granted it (LinkedIn: the Developer Portal's Account
 * Management list / Development tier), with a perfectly valid token.
 *
 * It has its own helper because the WRONG copy for it is so tempting: the
 * api used to return NEEDS_REAUTH here, so every ads surface offered a
 * Reconnect that could not possibly clear it, and users burned real time
 * re-authorising a healthy connection. No Reconnect CTA, no "try again" —
 * it is ours to fix, and support is the only useful next step.
 *
 * @param whatBlocked noun phrase for the blocked operation — "Boosting",
 *   "Activating this campaign".
 */
export function toastAdAccountNotAuthorized(
  err: unknown,
  whatBlocked: string,
  platform = "LinkedIn",
): void {
  const requestId = err instanceof ApiError ? err.requestId : undefined;
  toast.error(`${platform} hasn't authorised Peakhour on this ad account yet.`, {
    description:
      `${whatBlocked} can't work until that access is granted — we've logged it. ` +
      (requestId
        ? `Contact support quoting reference ${requestId}.`
        : "Please contact support."),
    duration: Infinity,
  });
}

/**
 * AD_ACCOUNT_FORBIDDEN — the platform refused the AD ACCOUNT itself. The
 * known causes are advertiser-fixable in the platform's own campaign
 * manager (billing hold, suspended or closed account, the member's access
 * removed), so this says neither "reconnect" nor "contact support" as its
 * headline.
 *
 * BUT it is also the api's landing spot for any 403 wording it cannot
 * attribute, so the request id is not optional here: when the real cause
 * is something else, the user goes to Campaign Manager, finds nothing
 * wrong, and support needs that id to find the provider's actual words in
 * ts_logs. The five surfaces that render this had copy-pasted the toast
 * and all five had dropped it.
 *
 * The MESSAGE is the api's, deliberately: it is authored server-side (it
 * names the ad account), never provider text — the same exception
 * CURRENCY_MISMATCH gets.
 */
export function toastAdAccountForbidden(err: unknown, fallback: string): void {
  const apiError = err instanceof ApiError ? err : null;
  const support = apiError?.requestId
    ? `If everything looks fine there, contact support quoting reference ${apiError.requestId}.`
    : "If everything looks fine there, contact support.";
  toast.error(apiError?.message ?? fallback, {
    description: support,
    duration: Infinity,
  });
}
