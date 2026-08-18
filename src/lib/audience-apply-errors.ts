/**
 * What the api's refusals MEAN when you put an audience on a campaign, or save
 * one off it (G4).
 *
 * ★MOST OF THESE ARE ANSWERS, NOT ERRORS, AND THEY ARE WRITTEN FOR THE
 * CUSTOMER. "We won't spend against a version of this audience we can't
 * confirm", "X can't express anything that makes this audience specific", "add
 * a location to it first" — every one is a sentence about THIS audience on THIS
 * channel, and replacing it with "something went wrong" throws away the only
 * useful part.
 *
 * ★BUT NOT ALL OF THEM ARE. A first cut hand-listed the ones to pass through
 * and missed `NOTHING_RESOLVED` and `NO_GEOGRAPHY` — the two whose sentences
 * the commit message was quoting — and listed `SET_NOT_SERVABLE` while the
 * materialiser emits `NOT_SERVABLE`, a one-word slip that neutered the branch.
 * Hence a classifier with a test against the api's own list rather than an
 * allowlist nobody can check.
 */

/**
 * How a caller should treat an apply failure.
 *
 * `audience` — the api authored a sentence about this audience and this
 *   channel. Show it as written.
 * `ad_account_not_authorized` / `ad_account_forbidden` — a 403 about the ad
 *   ACCOUNT. Both have platform-wide copy and neither is fixed by a reconnect,
 *   which is why they are not lumped in with the rest.
 * `persisted_on_platform` — ★THE PLATFORM HAS THE NEW AUDIENCE AND WE DO NOT.
 *   Treating this as a plain failure tells the customer "nothing was changed"
 *   about a campaign whose targeting has already moved — and the next thing
 *   they do is activate it.
 * `unhandled` — hand to `toastUnhandledApiError`, which owns the
 *   retry/permanent split, the support reference, and the NOT_FOUND
 *   deploy-order hazard.
 */
export type ApplyErrorKind =
  | "audience"
  | "ad_account_not_authorized"
  | "ad_account_forbidden"
  | "persisted_on_platform"
  | "unhandled";

/**
 * Refusals whose message is ABOUT THE AUDIENCE and is written for a customer.
 *
 * Sourced from the apply route and from `materialiseForPlatform`'s own
 * `MaterialiseResult` codes, which the route passes through verbatim.
 */
const AUDIENCE_REFUSALS = new Set([
  // ★A PRODUCT GAP IS NOT A SUPPORT TICKET. Both routes author a specific
  // sentence for this ("we don't have X's targeting vocabulary yet"), and
  // sending it to the shared handler made it a 4xx with no disposition —
  // therefore `permanent`, therefore a NON-DISMISSABLE "contact support and
  // quote this reference" toast, for something no support agent can clear. It
  // is reachable today: the capability registry is empty for a platform until
  // its migration runs, and the registry crons do not run in dev.
  "PLATFORM_UNSUPPORTED",
  // Same shape: "this campaign has no identity on the platform to target",
  // which is a sentence about this campaign and not a ticket.
  "NO_PLATFORM_ID",
  // the route's own
  "SET_DISCARDED",
  "SET_STALE",
  "SET_NOT_SERVABLE",
  "PLATFORM_MISMATCH",
  "FACET_NOT_APPLIABLE",
  "APPLY_REJECTED",
  // the materialiser's, passed through
  "NOT_SERVABLE",
  "NOTHING_RESOLVED",
  "NO_GEOGRAPHY",
  "NO_CAPABILITIES",
  // the save route's
  "NO_TARGETING",
  "LIBRARY_FULL",
  "NO_HYPOTHESIS",
]);

export function classifyApplyError(code: string | undefined): ApplyErrorKind {
  if (!code) return "unhandled";
  if (code === "APPLY_PERSIST_FAILED") return "persisted_on_platform";
  // ★BOTH SPELLINGS, BECAUSE ONLY ONE OF THEM IS DEPLOYED. api#1026 renamed
  // `APP_NOT_AUTHORIZED` to the platform-wide `AD_ACCOUNT_NOT_AUTHORIZED`, and
  // until that api is in production the LIVE code is the old one — so a
  // classifier that knew only the new name would have left the very 403 this
  // was written for falling through to "contact support", with a green test
  // asserting the name that is not yet on the wire.
  if (code === "AD_ACCOUNT_NOT_AUTHORIZED" || code === "APP_NOT_AUTHORIZED") {
    return "ad_account_not_authorized";
  }
  if (code === "AD_ACCOUNT_FORBIDDEN") return "ad_account_forbidden";
  if (AUDIENCE_REFUSALS.has(code)) return "audience";
  // ★EVERYTHING ELSE GOES TO THE SHARED HANDLER, INCLUDING THE ONES THAT LOOK
  // OBVIOUS. `NOT_CONNECTED`, `NEEDS_REAUTH` and `RATE_LIMITED` all have
  // platform-wide copy there, and a second hand-written sentence here is a
  // second place for it to drift.
  return "unhandled";
}
