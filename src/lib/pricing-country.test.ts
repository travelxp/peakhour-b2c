import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PRICE_MARKETS,
  hasCountryOverride,
  marketSelection,
  moduleBadge,
  priceScopeLine,
  resolveCountry,
  taxLabel,
  withCountry,
  type PricingEntry,
} from "./pricing";

function entry(over: Partial<PricingEntry> = {}): PricingEntry {
  return {
    currency: "USD",
    monthly: 59,
    yearly: 590,
    trialDays: 14,
    monthlyDiscountPct: 0,
    yearlyDiscountPct: 0,
    monthlyCampaignLabel: null,
    yearlyCampaignLabel: null,
    billingProviderKey: "stripe",
    taxIncluded: false,
    gstApplicable: false,
    vatApplicable: false,
    ...over,
  };
}

describe("resolveCountry", () => {
  it("a valid query beats the geo header", () => {
    expect(resolveCountry("gb", "IN")).toBe("GB");
  });
  it("an invalid query is ignored (header wins)", () => {
    for (const bad of ["", "USA", "1A", "G", "DEFAULT", "G B", "../"]) {
      expect(resolveCountry(bad, "in")).toBe("IN");
    }
  });
  it("takes the first of a repeated query", () => {
    expect(resolveCountry(["fr", "de"], null)).toBe("FR");
  });
  it("missing both falls to DEFAULT; invalid header too", () => {
    expect(resolveCountry(undefined, null)).toBe("DEFAULT");
    expect(resolveCountry("zzz", "XXX")).toBe("DEFAULT");
  });
  it("hasCountryOverride only for a valid query", () => {
    expect(hasCountryOverride("us")).toBe(true);
    expect(hasCountryOverride("usa")).toBe(false);
    expect(hasCountryOverride(undefined)).toBe(false);
  });
  it("withCountry carries the choice before the fragment", () => {
    expect(withCountry("/shopify", "GB")).toBe("/shopify?country=GB");
    expect(withCountry("/pricing#suite", "GB")).toBe("/pricing?country=GB#suite");
    expect(withCountry("/shopify", null)).toBe("/shopify");
  });
});

describe("taxLabel", () => {
  const f = (taxIncluded: boolean, gstApplicable: boolean, vatApplicable: boolean) =>
    taxLabel({ taxIncluded, gstApplicable, vatApplicable });
  it("one row per decision", () => {
    expect(f(true, true, false)).toBe("incl. GST");
    expect(f(true, false, true)).toBe("incl. VAT");
    expect(f(false, false, true)).toBe("VAT added at checkout");
    expect(f(true, false, false)).toBe("incl. tax");
    expect(f(false, false, false)).toBe("plus applicable tax");
    expect(f(false, true, false)).toBe("plus applicable tax");
  });
});

describe("priceScopeLine, the production country table", () => {
  const rows: Array<[string, Partial<PricingEntry>, string]> = [
    ["IN", { currency: "INR", gstApplicable: true, taxIncluded: true }, "Prices for India in INR · incl. GST"],
    ["US", {}, "Prices for United States in USD · plus applicable tax"],
    ["GB", { currency: "GBP", vatApplicable: true, taxIncluded: true }, "Prices for United Kingdom in GBP · incl. VAT"],
    ["DE", { currency: "EUR", vatApplicable: true }, "Prices for Germany in EUR · VAT added at checkout"],
    ["CA", { currency: "CAD" }, "Prices for Canada in CAD · plus applicable tax"],
    ["AU", { currency: "AUD" }, "Prices for Australia in AUD · plus applicable tax"],
    ["NZ", { currency: "NZD" }, "Prices for New Zealand in NZD · plus applicable tax"],
    ["AE", { currency: "AED" }, "Prices for United Arab Emirates in AED · plus applicable tax"],
    ["SG", { currency: "SGD" }, "Prices for Singapore in SGD · plus applicable tax"],
    ["SA", { currency: "SAR" }, "Prices for Saudi Arabia in SAR · plus applicable tax"],
    ["BR", { currency: "BRL" }, "Prices for Brazil in BRL · plus applicable tax"],
  ];
  it.each(rows)("%s", (country, over, line) => {
    expect(priceScopeLine(entry(over), country)).toBe(line);
  });
  it("unknown country falling back to USD names no country", () => {
    expect(priceScopeLine(entry(), "ZA")).toBe("Prices in USD · plus applicable tax");
    expect(priceScopeLine(entry(), "DEFAULT")).toBe("Prices in USD · plus applicable tax");
  });
  it("a code Intl does not know names no country", () => {
    expect(priceScopeLine(entry({ currency: "EUR" }), "ZZ")).toBe("Prices in EUR · plus applicable tax");
  });
  it("every switcher market resolves to itself, the fallback to ZZ", () => {
    expect(PRICE_MARKETS.map((m) => m.code)).toContain("ZZ");
    expect(marketSelection(entry(), "ZA")).toBe("ZZ");
    expect(marketSelection(entry({ currency: "INR" }), "IN")).toBe("IN");
    expect(marketSelection(entry({ currency: "EUR" }), "FR")).toBe("DE");
  });
});

describe("moduleBadge", () => {
  it("never says Soon when no Suite came back", () => {
    expect(moduleBadge(false, false)).toBeNull();
    expect(moduleBadge(false, true)).toBeNull();
  });
  it("with a Suite: Included or Soon", () => {
    expect(moduleBadge(true, true)).toBe("Included");
    expect(moduleBadge(true, false)).toBe("Soon");
  });
});

describe("getPricing cache is keyed by country", () => {
  beforeEach(() => vi.resetModules());
  it("two countries fetch twice; the same country once", async () => {
    // Stand-in for unstable_cache honouring its contract: results are keyed
    // by the call's arguments, so a country read from a closure would collapse.
    vi.doMock("next/cache", () => ({
      unstable_cache: (fn: (...a: string[]) => Promise<unknown>) => {
        const memo = new Map<string, Promise<unknown>>();
        return (...args: string[]) => {
          const k = JSON.stringify(args);
          if (!memo.has(k)) memo.set(k, fn(...args));
          return memo.get(k)!;
        };
      },
    }));
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ ok: true, data: { country: new URL(url).searchParams.get("country"), products: [] } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { getPricing } = await import("./pricing");
    const [a, b] = [await getPricing("IN"), await getPricing("US")];
    await getPricing("IN");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(a?.country).toBe("IN");
    expect(b?.country).toBe("US");
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
