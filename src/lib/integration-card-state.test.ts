import { describe, it, expect } from "vitest";
import {
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

  it("exports the states it tests, so the card and the tests cannot drift", () => {
    expect([...RECOVERABLE_STATUSES].sort()).toEqual([
      "error",
      "expired",
      "needs_reauth",
    ]);
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
});
