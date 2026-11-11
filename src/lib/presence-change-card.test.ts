import { describe, it, expect } from "vitest";
import { cardsOf, cardStatus, expiryOf, uniqueCards, UNREAD_STATUS, UNREADABLE_STATUS, TERMINAL_STATUSES } from "./presence-change-card";
import { isPresenceRoute, routeKeyFromPath } from "@/providers/ask-context-provider";

const card = (over: Record<string, unknown> = {}) => ({
  type: "listing_change",
  id: "6650ab6650ab6650ab6650ab",
  status: "proposed",
  placeName: "Acme Bakery",
  networkLabel: "Google",
  field: "specialHours",
  fieldLabel: "Holiday hours",
  headline: "Monday 9 November 2026: closed all day",
  before: "Your usual hours",
  after: "Monday 9 November 2026: closed all day",
  notes: [],
  blockedReason: null,
  awaitingApproval: true,
  expiresAt: "2026-11-07T10:00:00.000Z",
  ...over,
});

describe("cardsOf: the cards in the change tool's output", () => {
  it("takes the cards the api built", () => {
    expect(cardsOf({ status: "proposed", cards: [card()] })).toHaveLength(1);
  });

  it("drops anything that is not a card of this shape", () => {
    expect(cardsOf({ cards: [card({ type: "suggestion" }), card({ id: 5 }), card({ notes: "x" }), null, "text", card()] })).toHaveLength(1);
  });

  it("drops a card the component could not draw: a missing label, a note that is not text", () => {
    expect(cardsOf({ cards: [card({ fieldLabel: undefined }), card({ field: undefined }), card({ expiresAt: undefined }), card({ notes: ["ok", 3] }), card()] })).toHaveLength(1);
  });

  it("is empty for a question, a refusal or nothing at all", () => {
    expect(cardsOf({ status: "needs_place", options: [] })).toEqual([]);
    expect(cardsOf({ status: "refused", cards: undefined })).toEqual([]);
    expect(cardsOf(null)).toEqual([]);
    expect(cardsOf(undefined)).toEqual([]);
    expect(cardsOf({ cards: "nope" })).toEqual([]);
  });
});

describe("cardStatus: what each state tells a person", () => {
  const cases: Array<[string, string, boolean]> = [
    ["proposed", "Draft", true],
    ["validated", "Awaiting your approval", true],
    ["approved", "Approved, waiting to send", false],
    ["applying", "Sent to the network", false],
    ["submitted", "Sent to the network", false],
    ["live", "Live on the network", false],
    ["failed", "Failed", false],
    ["blocked", "Failed", false],
    ["rejected", "Declined by you", false],
    ["expired", "Expired", false],
    ["superseded", "Replaced", false],
    ["something_new", "Unknown", false],
  ];
  it.each(cases)("%s", (status, label, canDecide) => {
    const s = cardStatus(status);
    expect(s.label).toBe(label);
    expect(s.canDecide).toBe(canDecide);
  });

  it("offers Approve and Discard only while a change can be decided", () => {
    for (const [status, , canDecide] of cases) expect(cardStatus(status).canDecide).toBe(canDecide);
  });

  it("never says live before the api does", () => {
    for (const status of ["proposed", "validated", "approved", "applying", "submitted"]) {
      const s = cardStatus(status, { held: null });
      expect(`${s.label} ${s.detail ?? ""}`).not.toMatch(/\blive\b(?! yet)/i);
    }
    expect(cardStatus("approved").detail).toMatch(/not reached/);
    expect(cardStatus("applying").detail).toMatch(/not live yet/);
    expect(cardStatus("submitted").detail).toMatch(/take time to show it/);
  });

  it("explains a held approval and a blocked change in the api's words", () => {
    expect(cardStatus("approved", { held: "Listing changes are held for now." }).detail).toContain("Listing changes are held for now.");
    expect(cardStatus("blocked", { reason: "Google has not confirmed that you control this listing." }).detail).toMatch(/control this listing/);
  });
});

describe("cardStatus says what the Presence page says", () => {
  it("names the network from the label it is given", () => {
    expect(cardStatus("submitted", { label: "Testnet", liveOutcome: "pending" }).label).toBe("Under Testnet review");
    expect(cardStatus("live", { label: "Testnet" }).label).toBe("Live on Testnet");
  });

  it("keeps the merchant's own decline apart from the network's refusal", () => {
    expect(cardStatus("rejected", { label: "Testnet" }).label).toBe("Declined by you");
    expect(cardStatus("failed", { label: "Testnet", reason: "Testnet refused it.", reasonCode: "network_rejected" }).label).toBe("Rejected by Testnet");
    expect(cardStatus("failed", { label: "Testnet", reason: "Not showing.", reasonCode: "not_published" }).label).toBe("Didn't go live");
  });
});

describe("a stale card is never approvable", () => {
  it("a proposal past its time reads as expired, whatever the api still says", () => {
    const past = "2026-11-01T00:00:00.000Z";
    const now = Date.parse("2026-11-04T00:00:00.000Z");
    expect(cardStatus("proposed", { expiresAt: past, now })).toMatchObject({ label: "Expired", canDecide: false });
    expect(cardStatus("validated", { expiresAt: past, now }).canDecide).toBe(false);
    expect(cardStatus("proposed", { expiresAt: "2026-11-07T00:00:00.000Z", now }).canDecide).toBe(true);
    // only a change that can still be decided expires: a sent change keeps its status
    expect(cardStatus("submitted", { expiresAt: past, now }).label).toBe("Sent to the network");
  });

  it("the states shown while the live status is unread, or unreadable, offer no Approve", () => {
    expect(UNREAD_STATUS.canDecide).toBe(false);
    expect(UNREADABLE_STATUS.canDecide).toBe(false);
    expect(UNREADABLE_STATUS.detail).toMatch(/could not check/);
  });

  it("terminal statuses are exactly the ones that never change again", () => {
    for (const s of ["rejected", "expired", "superseded", "failed", "blocked", "live"]) expect(TERMINAL_STATUSES.has(s), s).toBe(true);
    for (const s of ["proposed", "validated", "approved", "applying", "submitted"]) expect(TERMINAL_STATUSES.has(s), s).toBe(false);
  });
});

describe("expiryOf: when a waiting card runs out of time", () => {
  it("is the card's own time while it can still be decided, and nothing otherwise", () => {
    expect(expiryOf({ status: "proposed", expiresAt: "2026-11-07T00:00:00.000Z" })).toBe(Date.parse("2026-11-07T00:00:00.000Z"));
    expect(expiryOf({ status: "validated", expiresAt: "2026-11-07T00:00:00.000Z" })).not.toBeNull();
    for (const status of ["approved", "submitted", "live", "blocked", "rejected", "expired"]) expect(expiryOf({ status, expiresAt: "2026-11-07T00:00:00.000Z" }), status).toBeNull();
    expect(expiryOf({ status: "proposed", expiresAt: "not a date" })).toBeNull();
  });
});

describe("uniqueCards: one card per change", () => {
  it("collapses a change named by two tool calls, and keeps order", () => {
    const a = card({ id: "a".repeat(24) });
    const b = card({ id: "b".repeat(24) });
    const out = uniqueCards([{ cards: [a, b] }, { cards: [a] }, { status: "needs_place" }, null]);
    expect(out.map((c) => c.id)).toEqual(["a".repeat(24), "b".repeat(24)]);
  });
});

describe("the Presence pages are where the engine is", () => {
  it("isPresenceRoute matches the keys the server activates on, and no other", () => {
    expect(isPresenceRoute("presence")).toBe(true);
    expect(isPresenceRoute("presence.review-poster")).toBe(true);
    for (const rk of ["presentations", "presence-x", "insights.presence", "analytics", "", "dashboard"]) expect(isPresenceRoute(rk), rk).toBe(false);
  });

  it("routeKeyFromPath gives those keys for the Presence pages", () => {
    expect(routeKeyFromPath("/dashboard/presence")).toBe("presence");
    expect(routeKeyFromPath("/dashboard/presence/review-poster")).toBe("presence.review-poster");
    expect(isPresenceRoute(routeKeyFromPath("/dashboard/presence"))).toBe(true);
    expect(isPresenceRoute(routeKeyFromPath("/dashboard/presentations"))).toBe(false);
    expect(isPresenceRoute(routeKeyFromPath("/dashboard/insights/analytics"))).toBe(false);
  });
});
