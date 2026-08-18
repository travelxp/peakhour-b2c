import { describe, it, expect } from "vitest";
import {
  CONNECTED_STATUSES,
  RECOVERABLE_STATUSES,
  hasConnection,
  isRecoverableStatus,
  showsComingSoon,
} from "./integration-card-state";

/**
 * The bug these pin: the card's body was
 * `connected ? … : isComingSoon ? "Coming soon" : …`, where `connected` meant
 * `status === "active"`. In production Shopify is `coming_soon` (the provider
 * registry env-gates it), so a merchant whose install had gone to
 * `needs_reauth` saw a dimmed card reading "Coming soon" — no Reconnect, no
 * error text. It is reachable because the App Store install path writes the
 * connection without ever consulting `availability`.
 *
 * Every case below is written as the pair the card actually receives —
 * (availability, status) — because reading either one alone is precisely the
 * mistake.
 */

describe("isRecoverableStatus", () => {
  it("accepts every state that still holds an unusable token", () => {
    for (const status of ["needs_reauth", "expired", "error"]) {
      expect(isRecoverableStatus(status)).toBe(true);
    }
  });

  it("rejects states that are not a broken connection", () => {
    // `active` is healthy; `disconnected` has had its credentials wiped, so it
    // is a fresh connect; undefined is a provider never connected at all.
    for (const status of ["active", "disconnected", undefined]) {
      expect(isRecoverableStatus(status)).toBe(false);
    }
  });

  it("classifies every member of the API's status union, exhaustively", () => {
    // ★A COMPILE-TIME GATE, not just an assertion. An earlier version compared
    // the local constants against local literals and claimed "a new API status
    // should fail here" — it could not: nothing in this repo referenced the
    // union, so adding a sixth value changed nothing and the test still
    // passed. `Record<ConnectionStatus, …>` makes a new member a BUILD error
    // in this file, which is the only thing that actually holds the line.
    //
    // Mirrors `zConnectionStatus` in
    // peakhour-mongodb/schemas/zod/db/_common.zod.ts. If that gains a member,
    // add it here and decide deliberately which side it falls on.
    type ConnectionStatus =
      | "active"
      | "disconnected"
      | "expired"
      | "error"
      | "needs_reauth";

    const HOLDS_CREDENTIALS: Record<ConnectionStatus, boolean> = {
      active: true,
      needs_reauth: true,
      expired: true,
      error: true,
      // Credentials wiped by DELETE /v1/integrations/:provider — a fresh
      // connect, so the coming-soon gate legitimately applies.
      disconnected: false,
    };
    const IS_RECOVERABLE: Record<ConnectionStatus, boolean> = {
      active: false,
      needs_reauth: true,
      expired: true,
      error: true,
      disconnected: false,
    };

    for (const [status, expected] of Object.entries(HOLDS_CREDENTIALS)) {
      expect(hasConnection(status)).toBe(expected);
    }
    for (const [status, expected] of Object.entries(IS_RECOVERABLE)) {
      expect(isRecoverableStatus(status)).toBe(expected);
    }
    // And the two exported lists agree with the tables above.
    expect([...CONNECTED_STATUSES].sort()).toEqual(
      Object.keys(HOLDS_CREDENTIALS).filter((s) => HOLDS_CREDENTIALS[s as ConnectionStatus]).sort(),
    );
    expect([...RECOVERABLE_STATUSES].sort()).toEqual(
      Object.keys(IS_RECOVERABLE).filter((s) => IS_RECOVERABLE[s as ConnectionStatus]).sort(),
    );
  });
});

describe("showsComingSoon", () => {
  it("signposts a coming-soon provider the org has never connected", () => {
    expect(showsComingSoon("coming_soon", undefined)).toBe(true);
  });

  it("signposts a coming-soon provider the org disconnected", () => {
    // Credentials are gone — reconnecting is a fresh connect, which the
    // coming-soon gate legitimately withholds.
    expect(showsComingSoon("coming_soon", "disconnected")).toBe(true);
  });

  it("★yields to a BROKEN connection on a coming-soon provider", () => {
    // The reported regression: each of these rendered as bare "Coming soon",
    // with no Reconnect button and no lastError.
    for (const status of RECOVERABLE_STATUSES) {
      expect(showsComingSoon("coming_soon", status)).toBe(false);
    }
  });

  it("★yields to an ACTIVE connection on a coming-soon provider", () => {
    // The second half, found while pinning the first: the card's body already
    // took its `connected` branch here, but the dimming and the "Soon" badge
    // keyed off availability alone — so a healthy prod Shopify merchant saw a
    // 50%-opacity card badged BOTH "Live" and "Soon".
    expect(showsComingSoon("coming_soon", "active")).toBe(false);
  });

  it("never signposts an available provider, in any connection state", () => {
    for (const status of [undefined, "active", "disconnected", ...RECOVERABLE_STATUSES]) {
      expect(showsComingSoon("available", status)).toBe(false);
    }
  });

  it("treats a missing availability as not-coming-soon", () => {
    expect(showsComingSoon(undefined, "needs_reauth")).toBe(false);
    expect(showsComingSoon(undefined, undefined)).toBe(false);
  });
});

describe("hasConnection", () => {
  it("is true for every state that holds credentials", () => {
    for (const status of ["active", ...RECOVERABLE_STATUSES]) {
      expect(hasConnection(status)).toBe(true);
    }
  });

  it("is false with no row, an empty status, or a wiped one", () => {
    for (const status of [undefined, "", "disconnected"]) {
      expect(hasConnection(status)).toBe(false);
    }
  });

  it("★fails toward the signpost for a status it does not recognize", () => {
    // The set is closed deliberately. An open "anything but disconnected" rule
    // would call an unknown status a live connection, suppress the signpost,
    // and — not being recoverable either — render a Connect button that 400s
    // COMING_SOON. Falling back to the inert signpost is the safe direction.
    expect(hasConnection("suspended_by_provider")).toBe(false);
    expect(showsComingSoon("coming_soon", "suspended_by_provider")).toBe(true);
    expect(isRecoverableStatus("suspended_by_provider")).toBe(false);
    // On an available provider an unknown status still just offers Connect,
    // exactly as it did before this rule existed.
    expect(showsComingSoon("available", "suspended_by_provider")).toBe(false);
  });
});
