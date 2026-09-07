import { describe, it, expect } from "vitest";
import { displayBusinessName, greetingForHour } from "./business-name";

/**
 * The prettifier's whole risk is over-reach: mangling a name a human typed is a
 * far louder failure than leaving a hostname alone, and it happens at the top of
 * the dashboard where everyone sees it. Most of these tests are about what it
 * must NOT touch.
 */
describe("displayBusinessName", () => {
  it("turns a hostname into a brand", () => {
    expect(displayBusinessName("quests.travel")).toBe("Quests");
    expect(displayBusinessName("bellas-boutique.com")).toBe("Bellas Boutique");
    expect(displayBusinessName("acme_co.io")).toBe("Acme Co");
  });

  it("strips a leading www", () => {
    expect(displayBusinessName("www.questsandtrails.com")).toBe("Questsandtrails");
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

  it("still prettifies once there is positive evidence of a machine", () => {
    // A known TLD, or all-lower-case. Either is a thing a person does not type.
    expect(displayBusinessName("t-mobile")).toBe("T Mobile");
    expect(displayBusinessName("eBay-store.com")).toBe("eBay Store");
    expect(displayBusinessName("IKEA-india.com")).toBe("IKEA India");
  });

  it("never strips the only word, however suffix-like", () => {
    expect(displayBusinessName("shop.com")).toBe("Shop");
    expect(displayBusinessName("io.net")).toBe("Io");
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
