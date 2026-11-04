import { describe, it, expect } from "vitest";
import { cardsOf, cardStatus } from "./presence-change-card";
import { routeKeyFromPath } from "@/providers/ask-context-provider";

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
    ["proposed", "Waiting for your approval", true],
    ["validated", "Waiting for your approval", true],
    ["approved", "Approved", false],
    ["applying", "Being sent", false],
    ["submitted", "Sent", false],
    ["live", "Live", false],
    ["failed", "Could not be sent", false],
    ["blocked", "Held", false],
    ["rejected", "Discarded", false],
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
    expect(cardStatus("approved").detail).toMatch(/not live yet/);
    expect(cardStatus("submitted").detail).toMatch(/not confirmed live yet/);
  });

  it("explains a held approval and a blocked change in the api's words", () => {
    expect(cardStatus("approved", { held: "Listing changes are held for now." }).detail).toBe("Listing changes are held for now.");
    expect(cardStatus("blocked", { reason: "Google has not confirmed that you control this listing." }).detail).toMatch(/control this listing/);
  });
});

describe("the Presence pages are where the engine is", () => {
  it("routeKeyFromPath gives the keys the server activates on", () => {
    expect(routeKeyFromPath("/dashboard/presence")).toBe("presence");
    expect(routeKeyFromPath("/dashboard/presence/review-poster")).toBe("presence.review-poster");
    expect(/^presence(\.|$)/.test(routeKeyFromPath("/dashboard/presence"))).toBe(true);
    expect(/^presence(\.|$)/.test(routeKeyFromPath("/dashboard/presentations"))).toBe(false);
    expect(/^presence(\.|$)/.test(routeKeyFromPath("/dashboard/insights/analytics"))).toBe(false);
  });
});
