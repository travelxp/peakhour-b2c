import { toast } from "sonner";
import { ApiError } from "@/lib/api";

/**
 * Last-resort toast for an API error none of a mutation's own `code`
 * branches recognised.
 *
 * WHY THIS EXISTS: the LinkedIn Ads surfaces each ended their onError
 * chain with a bare `toast.error("Couldn't X. Try again in a moment.")`,
 * discarding `err.message`. When every boost started failing with
 * PROVIDER_4XX_CREATE_CAMPAIGN_GROUP — a 100% reproducible API-contract
 * bug — users were told to retry, and the platform's actual rejection
 * ("locale is required", "status PAUSED not allowed on create") never
 * reached anyone. It went unnoticed for months.
 *
 * The rule: an unclassified failure must SAY WHAT HAPPENED. Only
 * genuinely transient failures (5xx, network) get "try again".
 *
 * Handle the codes you can act on above this; use it for the rest.
 *
 * @param whatFailed lower-case verb phrase — "create the campaign".
 */
export function toastUnhandledApiError(err: unknown, whatFailed: string): void {
  const apiError = err instanceof ApiError ? err : null;
  // A 4xx is a decision the server made about this request — retrying
  // it unchanged gives the same answer. status 0 = the request never
  // landed (offline / CORS), which is worth another go.
  const retryable = !apiError || apiError.status === 0 || apiError.status >= 500;
  const detail = apiError?.message?.trim();

  toast.error(
    retryable ? `Couldn't ${whatFailed}. Try again in a moment.` : `Couldn't ${whatFailed}.`,
    // Longer than the default: provider messages are worth reading, and
    // are usually the only copy of the reason a user ever sees.
    detail ? { description: detail, duration: 12_000 } : undefined,
  );
}
