import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseShopperCapInput, shopperCapStatus, SHOPPER_CAP_KEY } from "./shopper-cap";

describe("parseShopperCapInput", () => {
  it("empty switches the cap off", () => {
    expect(parseShopperCapInput("")).toEqual({ ok: true, cap: null });
    expect(parseShopperCapInput("  ")).toEqual({ ok: true, cap: null });
  });
  it("a whole number is the cap, commas and spaces ignored", () => {
    expect(parseShopperCapInput("2000")).toEqual({ ok: true, cap: 2000 });
    expect(parseShopperCapInput("12,500")).toEqual({ ok: true, cap: 12500 });
  });
  it("refuses malformed separators instead of reading them as another number", () => {
    for (const bad of ["1 2 3", "1,2,,3", "12,50", ",500"]) expect(parseShopperCapInput(bad).ok, bad).toBe(false);
  });
  it("refuses zero, negatives, decimals, words and too-large numbers, saying what to enter", () => {
    for (const bad of ["0", "-5", "1.5", "lots", "1e3", "999999999999"]) {
      const r = parseShopperCapInput(bad);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/Enter a (whole )?number/);
    }
  });
});

describe("the words (Peaks, as on peakhour.ai)", () => {
  it("no cap", () => {
    expect(shopperCapStatus({ cap: null, used: 0, reached: false })).toBe("No limit. Shopper chats can use any of your Peaks.");
  });
  it("below the cap", () => {
    expect(shopperCapStatus({ cap: 2000, used: 640.4, reached: false })).toBe(
      "Shopper chats have used 640 of 2,000 Peaks this month. When they reach the limit, your store's assistant stops answering shoppers and their messages go to your team.",
    );
  });
  it("at the cap", () => {
    const s = shopperCapStatus({ cap: 2000, used: 2000, reached: true });
    expect(s).toContain("your store's assistant is not answering shoppers");
    expect(s).toContain("starts answering again when your Peaks renew, or if you raise the limit");
  });
});

describe("the Peaks page", () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
  it("shows the card, and the card talks to the api route the api serves", () => {
    expect(read("../app/(site)/dashboard/peaks/page.tsx")).toContain("<ShopperCapCard />");
    expect(SHOPPER_CAP_KEY).toBe("/v1/dashboard/credits/shopper-cap");
    const card = read("../components/dashboard/shopper-cap-card.tsx");
    expect(card).toContain("api.put<ShopperCap>(SHOPPER_CAP_KEY, { cap })");
    expect(card).toContain("Only an owner or admin can change this limit.");
  });
});
