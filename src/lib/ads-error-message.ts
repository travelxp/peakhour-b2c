import { ApiError } from "@/lib/api";

/**
 * One rule for every ads panel's error text (G-15 review round 1: Meta's and
 * Google's were copies): an api code on the channel's merchant-facing list
 * shows the api's message; any other failure shows the caller's fallback,
 * with the request reference when there is one — never a raw message.
 */
export function adsErrorMessage(err: unknown, fallback: string, merchantFacing: ReadonlySet<string>): string {
  if (err instanceof ApiError) {
    if (merchantFacing.has(err.code)) return err.message;
    return err.requestId ? `${fallback} (reference ${err.requestId})` : fallback;
  }
  return fallback;
}
