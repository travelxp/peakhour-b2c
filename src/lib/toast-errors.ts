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
]);

const USER_FIXABLE_COPY: Record<string, string> = {
  NOT_CONNECTED: "Connect the ad account first, from Integrations.",
  NO_AD_ACCOUNT: "That connection has no ad account — reconnect it, or create one on the platform.",
  NEEDS_REAUTH: "The connection needs reconnecting, from Integrations.",
  RATE_LIMITED: "The platform is rate-limiting us — give it a minute and try again.",
  FORBIDDEN: "Pick a business first.",
  INVALID_TRANSITION: "That change isn't possible from the campaign's current state.",
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
  // for the surfaces that say it properly.
  if (code === "AD_ACCOUNT_NOT_AUTHORIZED") return "permanent";

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
