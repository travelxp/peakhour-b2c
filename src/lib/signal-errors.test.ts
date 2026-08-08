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
];

describe("signals error copy", () => {
  it("★maps every write code, and none of them is the generic fallback", () => {
    const fallback = writeErrorMessage(err("SOMETHING_NOBODY_HAS_SEEN"));
    for (const code of WRITE_CODES) {
      expect(writeErrorMessage(err(code)), code).not.toBe(fallback);
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
      expect(writeErrorMessage(err(code)), code).not.toMatch(/try again in a moment/i);
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
