import { describe, it, expect } from "vitest";
import { bestValueKey, perThousandLabel, pricePerThousand, type PackForUnitPrice } from "./peaks-pack-unit-price";

/**
 * The per-1,000-Peaks line on every pack, and the "Best value" badge derived
 * from it. Prices are the live catalogue's (dev and prod, 2026-11-12).
 */

const pack = (key: string, amount: string, credits: number, currency = "USD"): PackForUnitPrice => ({
  key,
  amount,
  credits,
  currency,
});

const USD = [
  pack("addon.peaks.boost", "5.00", 5000),
  pack("addon.peaks.value", "18.00", 20000),
  pack("addon.peaks.pro", "80.00", 100000),
];
const INR = [
  pack("addon.peaks.boost", "399.00", 5000, "INR"),
  pack("addon.peaks.value", "1499.00", 20000, "INR"),
  pack("addon.peaks.pro", "6499.00", 100000, "INR"),
];

describe("perThousandLabel", () => {
  it("prints the live packs' unit prices, always to two decimals", () => {
    expect(USD.map((p) => perThousandLabel(p, "$"))).toEqual([
      "$1.00 per 1,000 Peaks",
      "$0.90 per 1,000 Peaks",
      "$0.80 per 1,000 Peaks",
    ]);
    expect(INR.map((p) => perThousandLabel(p, "₹"))).toEqual([
      "₹79.80 per 1,000 Peaks",
      "₹74.95 per 1,000 Peaks",
      "₹64.99 per 1,000 Peaks",
    ]);
  });

  it("says nothing rather than a wrong number for a pack it can't divide", () => {
    expect(perThousandLabel(pack("a", "", 5000), "$")).toBeNull();
    expect(perThousandLabel(pack("a", " ", 5000), "$")).toBeNull();
    expect(perThousandLabel(pack("a", "abc", 5000), "$")).toBeNull();
    expect(perThousandLabel(pack("a", "0.00", 5000), "$")).toBeNull();
    expect(perThousandLabel(pack("a", "5.00", 0), "$")).toBeNull();
  });
});

describe("pricePerThousand", () => {
  it("is the pack price scaled to 1,000 Peaks", () => {
    expect(pricePerThousand(pack("a", "18.00", 20000))).toBeCloseTo(0.9);
    expect(pricePerThousand(pack("a", "129.00", 100000))).toBeCloseTo(1.29);
  });
});

describe("bestValueKey", () => {
  it("is the pack with the lowest price per 1,000: Pro, not the Value pack the stored flag picked", () => {
    expect(bestValueKey(USD)).toBe("addon.peaks.pro");
    expect(bestValueKey(INR)).toBe("addon.peaks.pro");
  });

  it("does not depend on the order the packs arrive in", () => {
    expect(bestValueKey([...USD].reverse())).toBe("addon.peaks.pro");
  });

  it("gives no badge to a single pack, a tie, or packs in different currencies", () => {
    expect(bestValueKey([USD[0]])).toBeNull();
    expect(bestValueKey([pack("a", "5.00", 5000), pack("b", "10.00", 10000)])).toBeNull();
    expect(bestValueKey([USD[0], INR[2]])).toBeNull();
  });

  it("treats two packs that print the same price as a tie", () => {
    // $0.80 and $0.8004 both print "$0.80 per 1,000 Peaks".
    expect(bestValueKey([pack("a", "80.00", 100000), pack("b", "80.04", 100000)])).toBeNull();
  });

  it("ignores a pack it cannot price instead of crowning it", () => {
    expect(bestValueKey([pack("broken", "", 100000), ...USD])).toBe("addon.peaks.pro");
  });
});
