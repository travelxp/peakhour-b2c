import { describe, it, expect } from "vitest";
import { classifyApplyError } from "./audience-apply-errors";

/**
 * ★A TABLE AGAINST THE API'S OWN CODE LIST, because the defect this file was
 * written for was a hand-maintained allowlist that missed two codes and
 * misspelled a third. The list below is every code
 * `POST /v1/audiences/sets/:id/apply` and `POST /v1/audiences/sets/from-campaign`
 * can return, mirrored from the routes — including the ones the materialiser
 * emits and the route passes through verbatim.
 *
 * Nothing may classify as `unhandled` by accident: `unhandled` is a decision to
 * let the shared `toastUnhandledApiError` own the copy, and it is stated here
 * per code rather than being where unlisted codes fall.
 */
const API_CODES: Array<[code: string, kind: ReturnType<typeof classifyApplyError>]> = [
  // ── the apply route ────────────────────────────────────────────────────
  ["SET_DISCARDED", "audience"],
  ["SET_STALE", "audience"],
  ["SET_NOT_SERVABLE", "audience"],
  ["PLATFORM_MISMATCH", "audience"],
  ["FACET_NOT_APPLIABLE", "audience"],
  ["APPLY_REJECTED", "audience"],
  // ★THE PLATFORM HAS THE AUDIENCE AND WE DO NOT. Anything that renders this
  // as "nothing was changed" is telling the customer the opposite of the truth
  // about a campaign they are about to activate.
  ["APPLY_PERSIST_FAILED", "persisted_on_platform"],
  ["AD_ACCOUNT_NOT_AUTHORIZED", "ad_account_not_authorized"],
  // ★THE SPELLING THAT IS STILL DEPLOYED. api#1026 renamed it; until that api
  // is in production this is the code on the wire, and a table asserting only
  // the new name is green while the live path tells the customer to open a
  // ticket.
  ["APP_NOT_AUTHORIZED", "ad_account_not_authorized"],
  ["AD_ACCOUNT_FORBIDDEN", "ad_account_forbidden"],
  // Shared copy lives in toast-errors.ts; a second sentence here would drift.
  ["NOT_CONNECTED", "unhandled"],
  ["NEEDS_REAUTH", "unhandled"],
  ["NO_AD_ACCOUNT", "unhandled"],
  ["RATE_LIMITED", "unhandled"],
  ["INVALID_TRANSITION", "unhandled"],
  ["NOT_FOUND", "unhandled"],
  ["FORBIDDEN", "unhandled"],
  ["NO_PLATFORM_ID", "audience"],
  ["APPLY_FAILED", "unhandled"],
  ["TOKEN_FAILED", "unhandled"],
  // ★A PRODUCT GAP, NOT A TICKET. Both routes author a sentence for it, and
  // `unhandled` makes a 4xx `permanent` — a non-dismissable "contact support".
  ["PLATFORM_UNSUPPORTED", "audience"],
  // ── passed through from materialiseForPlatform ─────────────────────────
  // ★THE TWO THE FIRST CUT MISSED. Their messages are the ones the feature's
  // own commit message quoted as the reason not to flatten anything.
  ["NOTHING_RESOLVED", "audience"],
  ["NO_GEOGRAPHY", "audience"],
  // ★AND THE ONE IT MISSPELLED: the route lists SET_NOT_SERVABLE, the
  // materialiser emits NOT_SERVABLE, and only the first was handled.
  ["NOT_SERVABLE", "audience"],
  ["NO_CAPABILITIES", "audience"],
  ["PROVIDER_FAILED", "unhandled"],
  ["TIMED_OUT", "unhandled"],
  // ── the from-campaign route ────────────────────────────────────────────
  ["NO_TARGETING", "audience"],
  // Its insert catch-all. `unhandled` is a DECISION here, not where an
  // unlisted code lands: a 502 has no sentence worth quoting and the shared
  // handler's "try again in a moment" is right.
  ["SAVE_FAILED", "unhandled"],
  // Both routes. Practically unreachable from these dialogs — both clamp to the
  // server's own limits — but it is a code they can return.
  ["VALIDATION_ERROR", "unhandled"],
  ["LIBRARY_FULL", "audience"],
  ["NO_HYPOTHESIS", "audience"],
];

describe("classifyApplyError", () => {
  it.each(API_CODES)("classifies %s as %s", (code, kind) => {
    expect(classifyApplyError(code)).toBe(kind);
  });

  it("hands an unknown code to the shared handler rather than guessing", () => {
    // A code we have never seen has no sentence we can vouch for, and
    // `toastUnhandledApiError` is where the retry/permanent split and the
    // support reference live.
    expect(classifyApplyError("SOMETHING_NEW")).toBe("unhandled");
    expect(classifyApplyError(undefined)).toBe("unhandled");
  });
});
