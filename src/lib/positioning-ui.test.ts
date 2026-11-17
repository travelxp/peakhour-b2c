import { describe, it, expect } from "vitest";
import type { CorrectableFieldSpec, Positioning, PositioningOptions } from "@/lib/api/audiences";
import { correctionBlockedReason } from "./audience-profile-rules";
import { basisLine, choicesFor, listedLabel, positioningRows, sourceWords, valueLabel } from "./positioning-ui";

const OPTIONS: PositioningOptions = {
  category: "ecommerce",
  subCategories: [
    { slug: "apparel", label: "Apparel", styles: [{ slug: "streetwear", label: "Streetwear" }, { slug: "luxury", label: "Luxury" }] },
    { slug: "health_foods", label: "Health foods", styles: [{ slug: "keto", label: "Keto" }, { slug: "luxury", label: "Luxury" }] },
  ],
};
const spec = (over: Partial<CorrectableFieldSpec> & { field: string }): CorrectableFieldSpec => ({ shape: "scalar", maxLength: 64, ...over });

describe("words for a value", () => {
  it("every enum value has plain words, and an unknown value is shown as it is", () => {
    expect(valueLabel("classification.priceTier", "mid")).toBe("Mid-range");
    expect(valueLabel("classification.buyingPattern", "repeat")).toBe("Customers come back");
    expect(valueLabel("classification.salesChannels", "whatsapp")).toBe("WhatsApp");
    expect(valueLabel("classification.shopper.ageBands", "55_plus")).toBe("55 and over");
    expect(valueLabel("classification.shopper.genderLean", "all")).toBe("Everyone");
    expect(valueLabel("classification.shopper.spendingPower", "affluent")).toBe("Affluent");
    expect(valueLabel("classification.priceTier", "surprise")).toBe("surprise");
    expect(valueLabel("classification.styles", "keto")).toBe("keto");
  });

  it("never shows the engine's own words for a tier or a value", () => {
    const shown = ["budget", "mid", "premium", "luxury"].map((v) => valueLabel("classification.priceTier", v)).concat(["one_off", "repeat", "subscription"].map((v) => valueLabel("classification.buyingPattern", v)));
    for (const text of shown) expect(text).not.toMatch(/_/);
  });
});

describe("where a value came from, in plain words", () => {
  it("says who said it", () => {
    expect(sourceWords("stated", "classification.priceTier")).toBe("You told us");
    expect(sourceWords("inferred", "classification.priceTier")).toBe("Our best guess");
    expect(sourceWords("observed", "classification.buyingPattern")).toBe("Measured from your orders");
    expect(sourceWords("observed", "classification.salesChannels")).toBe("Measured from your store and orders");
    expect(sourceWords("observed", "classification.priceTier")).toBe("Measured from your data");
  });
});

describe("what a correction can be picked from", () => {
  it("an enum field offers its own values, labelled, and no typing", () => {
    const c = choicesFor(spec({ field: "classification.priceTier", values: ["budget", "mid", "premium", "luxury"] }), OPTIONS)!;
    expect(c.allowUnlisted).toBe(false);
    expect(c.choices.map((x) => x.label)).toEqual(["Budget", "Mid-range", "Premium", "Luxury"]);
    // with no category list at all an enum field still has its choices
    expect(choicesFor(spec({ field: "classification.salesChannels", shape: "list", values: ["own_site", "whatsapp"] }), null)?.choices.map((x) => x.label)).toEqual(["Your own website", "WhatsApp"]);
  });

  it("the sub-category comes from the category's list, and may be typed when the list lacks it", () => {
    const c = choicesFor(spec({ field: "classification.subIndustry", maxLength: 256 }), OPTIONS)!;
    expect(c.choices).toEqual([{ value: "apparel", label: "Apparel" }, { value: "health_foods", label: "Health foods" }]);
    expect(c.allowUnlisted).toBe(true);
  });

  it("styles come from the business's own sub-category, once each; with an unlisted or no sub-category, from every one", () => {
    const styles = spec({ field: "classification.styles", shape: "list", maxItems: 3 });
    expect(choicesFor(styles, OPTIONS, "apparel")!.choices.map((x) => x.value)).toEqual(["streetwear", "luxury"]);
    expect(choicesFor(styles, OPTIONS, "health_foods")!.choices.map((x) => x.value)).toEqual(["keto", "luxury"]);
    expect(choicesFor(styles, OPTIONS, "maternity wear")!.choices.map((x) => x.value)).toEqual(["streetwear", "luxury", "keto"]);
    expect(choicesFor(styles, OPTIONS)!.allowUnlisted).toBe(true);
  });

  it("a category with no list leaves the sub-category and styles as typed text", () => {
    expect(choicesFor(spec({ field: "classification.subIndustry" }), null)).toBeNull();
    expect(choicesFor(spec({ field: "classification.styles", shape: "list" }), null)).toBeNull();
  });

  it("market type is not a positioning field: the panel keeps its own select for it", () => {
    expect(choicesFor(spec({ field: "classification.marketType", maxLength: 16, values: ["b2b", "b2c"] }), OPTIONS)).toBeNull();
  });

  it("a field that is not positioning is free text", () => {
    expect(choicesFor(spec({ field: "classification.lifecycleStage" }), OPTIONS)).toBeNull();
    expect(choicesFor(spec({ field: "icp", shape: "list" }), OPTIONS)).toBeNull();
  });

  it("listedLabel shows the list's name for a slug and the words for anything else", () => {
    const choices = choicesFor(spec({ field: "classification.subIndustry" }), OPTIONS)!.choices;
    expect(listedLabel(choices, "health_foods")).toBe("Health foods");
    expect(listedLabel(choices, "maternity wear")).toBe("maternity wear");
    expect(listedLabel(undefined, "x")).toBe("x");
  });
});

describe("the closed list is enforced before the server has to", () => {
  const channels = spec({ field: "classification.salesChannels", shape: "list", maxLength: 32, maxItems: 6, values: ["own_site", "whatsapp", "social"] });
  it("a value outside it is blocked, a value inside it and the empty list are not", () => {
    expect(correctionBlockedReason(channels, { value: "", list: ["own_site", "tv"] })).toBe("Choose from the options.");
    expect(correctionBlockedReason(channels, { value: "", list: ["own_site", "whatsapp"] })).toBeUndefined();
    expect(correctionBlockedReason(channels, { value: "", list: [] })).toBeUndefined();
  });
  it("a free-text list (styles) is not held to a vocabulary", () => {
    expect(correctionBlockedReason(spec({ field: "classification.styles", shape: "list", maxItems: 3 }), { value: "", list: ["anything I like"] })).toBeUndefined();
    expect(correctionBlockedReason(spec({ field: "classification.styles", shape: "list", maxItems: 3 }), { value: "", list: ["a", "b", "c", "d"] })).toMatch(/only store 3/);
  });
});

describe("the block's rows", () => {
  const empty: Positioning = { category: "ecommerce", subCategory: null, styles: [], priceTier: null, buyingPattern: null, salesChannels: [], shopper: null };

  it("an empty profile still has every row, each with nothing known", () => {
    const rows = positioningRows(empty);
    expect(rows.map((r) => r.field)).toEqual([
      "classification.subIndustry",
      "classification.styles",
      "classification.priceTier",
      "classification.buyingPattern",
      "classification.salesChannels",
      "classification.shopper.ageBands",
      "classification.shopper.genderLean",
      "classification.shopper.spendingPower",
    ]);
    expect(rows.every((r) => r.values.length === 0)).toBe(true);
  });

  it("carries words and tiers through", () => {
    const rows = positioningRows({
      category: "ecommerce",
      subCategory: { slug: null, label: "maternity wear", tier: "stated" },
      styles: [{ slug: "streetwear", label: "Streetwear", tier: "inferred" }],
      priceTier: { value: "premium", tier: "inferred" },
      buyingPattern: { value: "repeat", tier: "observed" },
      salesChannels: [{ value: "own_site", tier: "observed" }, { value: "whatsapp", tier: "stated" }],
      shopper: { ageBands: [{ value: "25_34", tier: "inferred" }], genderLean: { value: "women", tier: "stated" }, spendingPower: null },
    });
    const by = Object.fromEntries(rows.map((r) => [r.field, r.values]));
    expect(by["classification.subIndustry"]).toEqual([{ text: "maternity wear", tier: "stated" }]);
    expect(by["classification.styles"]).toEqual([{ text: "Streetwear", tier: "inferred" }]);
    expect(by["classification.priceTier"]).toEqual([{ text: "Premium", tier: "inferred" }]);
    expect(by["classification.buyingPattern"]).toEqual([{ text: "Customers come back", tier: "observed" }]);
    expect(by["classification.salesChannels"]).toEqual([{ text: "Your own website", tier: "observed" }, { text: "WhatsApp", tier: "stated" }]);
    expect(by["classification.shopper.ageBands"]).toEqual([{ text: "25 to 34", tier: "inferred" }]);
    expect(by["classification.shopper.genderLean"]).toEqual([{ text: "Mostly women", tier: "stated" }]);
    expect(by["classification.shopper.spendingPower"]).toEqual([]);
  });
});

describe("what a measured value rests on", () => {
  it("says how many customers came back", () => {
    expect(basisLine("classification.buyingPattern", { customers: 130, repeatCustomerShare: 0.323, windowDays: 365 } as never)).toBe("42 of 130 customers bought more than once in the last year.");
  });
  it("names the window the api measured, not always a year", () => {
    expect(basisLine("classification.buyingPattern", { customers: 100, repeatCustomerShare: 0.3, windowDays: 90 })).toBe("30 of 100 customers bought more than once in the last 90 days.");
  });
  it("one product is not a median, and a large figure is grouped", () => {
    expect(basisLine("classification.priceTier", { ownMedianPrice: 1, currency: "INR", sampleSize: 1 })).toBe("Your one active product is priced at 1 INR.");
    expect(basisLine("classification.priceTier", { ownMedianPrice: 1234.5, currency: "INR", sampleSize: 8 })).toBe("Your 8 active products have a median price of 1,234.5 INR.");
  });
  it("says what the catalogue median is", () => {
    expect(basisLine("classification.priceTier", { ownMedianPrice: 799, currency: "INR", sampleSize: 40 })).toBe("Your 40 active products have a median price of 799 INR.");
  });
  it("says nothing when there is nothing", () => {
    expect(basisLine("classification.buyingPattern", undefined)).toBeUndefined();
    expect(basisLine("classification.priceTier", { ownMedianPrice: 799 })).toBeUndefined();
    expect(basisLine("classification.buyingPattern", { customers: 10 })).toBeUndefined();
    expect(basisLine("classification.shopper.genderLean", { customers: 10, repeatCustomerShare: 0.5 })).toBeUndefined();
  });
});
