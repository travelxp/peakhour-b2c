import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import {
  listErrorState,
  writeErrorMessage,
} from "@/app/(site)/dashboard/growth/signals/page";

/**
 * ★EVERY CODE THE SIGNALS ROUTES CAN RETURN, MAPPED TO A MESSAGE THAT IS NOT
 * "TRY AGAIN IN A MOMENT" UNLESS TRYING AGAIN COULD ACTUALLY HELP.
 *
 * This surface has now shipped that mistake twice: `FORBIDDEN` and
 * `NO_ACTIVE_BUSINESS` fell through to a retry button that could never resolve
 * them, and `RAIL_UNAVAILABLE` was added api-side with no client case at all —
 * caught only because a reviewer went looking. The list below is a decision
 * about which codes exist, so adding one api-side and forgetting the client is
 * a failing test rather than a customer being told to wait for nothing.
 */
const err = (code: string) => new ApiError(code, "server sentence", 400);

/** Traced from `peakhour-api`: the route handlers plus the middleware ABOVE
 *  them (`requireAuth` → UNAUTHORIZED, `requireOrg` → NO_ORG,
 *  `requireRole` → FORBIDDEN). A list built by reading one handler stops
 *  exactly where the middleware starts, which is how two of these were missed. */
const WRITE_CODES = [
  "SIGNAL_EXISTS",
  "FORBIDDEN",
  "NO_ACTIVE_BUSINESS",
  "NOTHING_TO_UPDATE",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "RAIL_UNAVAILABLE",
  "NO_ORG",
  "UNAUTHORIZED",
  // ★AND THE APP-LEVEL GUARD, which is a THIRD layer: `csrfGuard` is mounted in
  // `src/index.ts` above the v1 router, so a list traced from the handlers and
  // their own middleware still stops one short. The commit that added this file
  // claimed to have traced "the middleware above them" and had not.
  "CSRF_MISSING",
  "CSRF_INVALID",
];

describe("signals error copy", () => {
  it("★maps every write code, and none of them is the generic fallback", () => {
    // ★DISTINCT FROM THE FALLBACK *AND* FROM EACH OTHER. "≠ fallback" alone is
    // satisfied by mapping every code to the same one-word string.
    const fallback = writeErrorMessage(err("SOMETHING_NOBODY_HAS_SEEN"));
    const seen = new Map<string, string>();
    for (const code of WRITE_CODES) {
      const msg = writeErrorMessage(err(code));
      expect(msg, code).not.toBe(fallback);
      // (No length floor. A first cut used one and failed on "Nothing was
      // changed." — a correct message that is short because the situation is.
      // Length is a proxy; distinctness is the property.)
      const clash = seen.get(msg);
      // Two codes MAY share a message when they are genuinely the same
      // situation (the two CSRF ones are), so this records rather than forbids —
      // what it refuses is a mapping that has collapsed wholesale.
      if (clash) expect([clash, code].sort().join("|")).toBe("CSRF_INVALID|CSRF_MISSING");
      seen.set(msg, code);
    }
  });

  it("★no unretryable failure is answered with a BARE 'try again in a moment'", () => {
    // ★THE RULE IS ABOUT AN ACTIONLESS RETRY, NOT THE WORDS "try again". A first
    // cut forbade the phrase outright and failed on NO_ORG — whose message is
    // "finish onboarding and try again", where the retry FOLLOWS a real action
    // the customer can take. That is a good message. What is forbidden is
    // offering a retry as the whole remedy for something waiting on nobody: a
    // remedy that cannot resolve the failure is worse than none.
    for (const code of [
      "FORBIDDEN",
      "NO_ACTIVE_BUSINESS",
      "NO_ORG",
      "UNAUTHORIZED",
      "NOTHING_TO_UPDATE",
      "RAIL_UNAVAILABLE",
    ]) {
      // Any bare retry, not one literal phrasing: "try again later" and
      // "please retry" are the same actionless advice.
      const msg = writeErrorMessage(err(code));
      expect(msg, code).not.toMatch(/try again (in a moment|later|shortly)|please retry/i);
    }
  });

  it("★RAIL_UNAVAILABLE explains the wait and offers the other rail", () => {
    const msg = writeErrorMessage(err("RAIL_UNAVAILABLE"));
    expect(msg).toMatch(/wordpress/i);
    expect(msg).toMatch(/hour/i);
    expect(msg).toMatch(/paste/i);
  });

  it("the generic fallback is still there for a code nobody has seen", () => {
    expect(writeErrorMessage(err("WAT"))).toMatch(/try again in a moment/i);
    expect(writeErrorMessage(new Error("network"))).toMatch(/try again in a moment/i);
  });

  it("★the list surface offers a RETRY only where one could work", () => {
    const retryable = listErrorState(new Error("network"), () => {});
    expect(retryable.action).toBeDefined();
    for (const code of ["NO_ACTIVE_BUSINESS", "NO_ORG", "UNAUTHORIZED"]) {
      const state = listErrorState(err(code), () => {});
      expect(state.action, code).toBeUndefined();
      expect(state.description, code).not.toMatch(/try again/i);
    }
  });
});
