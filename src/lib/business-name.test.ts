import { describe, it, expect } from "vitest";
import { displayBusinessName, greetingForHour } from "./business-name";

/**
 * The helper CAPITALISES a stored hostname; it does not edit one. Two failure
 * modes bracket it, and most of these tests are about staying between them:
 * mangling a name a human typed, and shortening a name into something that is
 * not the business's name at all.
 */
describe("displayBusinessName", () => {
  it("keeps the complete registered name, separators and all", () => {
    // ★NOT "Quests". An earlier version stripped the suffix, which shortened
    //  the customer's own name into a fragment of it at the top of their
    //  dashboard.
    expect(displayBusinessName("quests.travel")).toBe("Quests.Travel");
    expect(displayBusinessName("bellas-boutique.com")).toBe("Bellas-Boutique.Com");
    expect(displayBusinessName("acme_co.io")).toBe("Acme_Co.Io");
  });

  it("strips a leading www., which is how you reach a name rather than part of one", () => {
    expect(displayBusinessName("www.questsandtrails.com")).toBe("Questsandtrails.Com");
  });

  it("does not eat a workspace whose first segment really is www", () => {
    expect(displayBusinessName("www.co")).toBe("Co");
  });

  it("leaves a name a person typed completely alone", () => {
    // A space is the strongest signal we have that a human wrote it.
    expect(displayBusinessName("Bella's Boutique")).toBe("Bella's Boutique");
    expect(displayBusinessName("Smith & Sons")).toBe("Smith & Sons");
    expect(displayBusinessName("The Coffee Co.")).toBe("The Coffee Co.");
  });

  it("leaves a single word alone, even a lowercase one", () => {
    // No separator means nothing to interpret; capitalising here would be
    // guessing at a name rather than parsing a hostname.
    expect(displayBusinessName("peakhour")).toBe("peakhour");
  });

  it("leaves non-Latin names untouched", () => {
    expect(displayBusinessName("बेला बुटीक")).toBe("बेला बुटीक");
    expect(displayBusinessName("東京カフェ")).toBe("東京カフェ");
  });

  it("leaves a hyphenated brand alone — shape alone is not evidence", () => {
    // These all satisfy the machine-name SHAPE (no whitespace, letters and
    // separators only). Rewriting them was a real regression a review caught,
    // in the one code path everybody sees.
    expect(displayBusinessName("T-Mobile")).toBe("T-Mobile");
    expect(displayBusinessName("Coca-Cola")).toBe("Coca-Cola");
    expect(displayBusinessName("J.P.Morgan")).toBe("J.P.Morgan");
    expect(displayBusinessName("BBC-News")).toBe("BBC-News");
  });

  it("still capitalises once there is positive evidence of a machine", () => {
    // A known TLD, or all-lower-case. Either is a thing a person does not type.
    expect(displayBusinessName("t-mobile")).toBe("T-Mobile");
    expect(displayBusinessName("IKEA-india.com")).toBe("IKEA-India.Com");
  });

  it("never destroys deliberate capitalisation inside a segment", () => {
    // Per SEGMENT: one that already carries a capital is left exactly as typed.
    expect(displayBusinessName("eBay-store.com")).toBe("eBay-Store.Com");
  });

  it("handles empty and missing input", () => {
    expect(displayBusinessName(null)).toBe("");
    expect(displayBusinessName(undefined)).toBe("");
    expect(displayBusinessName("   ")).toBe("");
  });
});

describe("greetingForHour", () => {
  it("splits the day at noon and six", () => {
    expect(greetingForHour(0)).toBe("Good morning");
    expect(greetingForHour(11)).toBe("Good morning");
    expect(greetingForHour(12)).toBe("Good afternoon");
    expect(greetingForHour(17)).toBe("Good afternoon");
    expect(greetingForHour(18)).toBe("Good evening");
    expect(greetingForHour(23)).toBe("Good evening");
  });
});
