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
 *  2. The obvious fix (render `err.message`) is worse: the api's message
 *     for those codes is LinkedIn's raw response body, and for the
 *     catch-alls it is an arbitrary exception string — JSON dumps,
 *     internal ids, even config names like "LINKEDIN_CLIENT_ID is not
 *     set". That is exactly what `no-raw-ai-errors-to-users` forbids,
 *     and what `engageErrorMessage` (audience-panel.tsx) already
 *     protects against for LinkedIn Engage.
 *
 * So: the CODE picks plain-language copy, the raw message stays in the
 * api's logs, and the request id goes in the toast as the handle
 * support needs to find those logs.
 *
 * RETRYABILITY COMES FROM THE CODE, NOT THE STATUS. The api returns
 * PROVIDER_4XX_* with HTTP 502 (a platform rejection isn't the caller's
 * fault, but it also won't change on retry), so a status-based split
 * gets the motivating case exactly backwards.
 */

/** What the code family tells us about acting on the failure. */
type Disposition = "retry" | "permanent" | "unknown";

function dispositionOf(code: string, status: number): Disposition {
  // The platform rejected the request itself. Repeating it unchanged
  // gets the same answer.
  if (code.startsWith("PROVIDER_4XX_") || code.startsWith("VALIDATION_")) return "permanent";
  if (code === "VALIDATION_ERROR") return "permanent";
  // Ours to fix, not the user's — never tell them to retry into it.
  if (code === "ADAPTER_MISSING" || code === "CONFIG_ERROR") return "permanent";
  // Genuinely transient: the platform or the network wobbled.
  if (code.startsWith("PROVIDER_5XX_") || code.startsWith("NETWORK_")) return "retry";
  if (code === "TOKEN_FAILED" || code === "PARSE_ERROR") return "retry";
  // Nothing recognisable in the code — fall back to the status, where a
  // 5xx is at least more likely transient than a 4xx.
  if (status >= 500 || status === 0) return "retry";
  if (status >= 400) return "unknown";
  return "unknown";
}

/**
 * @param whatFailed lower-case verb phrase — "create the campaign".
 */
export function toastUnhandledApiError(err: unknown, whatFailed: string): void {
  const apiError = err instanceof ApiError ? err : null;

  if (!apiError) {
    // Not an api response at all — a thrown TypeError from fetch, i.e.
    // offline / DNS / CORS. Genuinely worth another go.
    toast.error(`Couldn't ${whatFailed}. Check your connection and try again.`);
    return;
  }

  const disposition = dispositionOf(apiError.code, apiError.status);
  const title =
    disposition === "retry"
      ? `Couldn't ${whatFailed}. Try again in a moment.`
      : `Couldn't ${whatFailed}.`;

  const description =
    disposition === "permanent"
      ? "LinkedIn rejected the request. Our team has the details — please contact support."
      : disposition === "unknown"
        ? "Something we didn't expect went wrong. Please contact support if it keeps happening."
        : undefined;

  // The request id is the ONLY technical detail we surface: it's an
  // opaque uuid, it leaks nothing, and it's the key to the server-side
  // log that holds the provider's actual words.
  const withRef = apiError.requestId
    ? `${description ? `${description} ` : ""}Reference: ${apiError.requestId}`
    : description;

  toast.error(title, withRef ? { description: withRef } : undefined);
}
