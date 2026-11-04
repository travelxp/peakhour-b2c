import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHARGES_CSV_PATH, chargeAmount, chargeCount, chargeStatusText, chargeWhen, shopperChargesCopy, shopperReplyPeaks } from "@/lib/charge-record";

describe("chargeWhen", () => {
  it("prints a charge the same way whatever the host locale, in a zone that is named", () => {
    expect(chargeWhen("2026-11-04T10:02:00.000Z", "UTC")).toBe("4 Nov 2026, 10:02");
    expect(chargeWhen("2026-11-04T10:02:00.000Z", "Asia/Kolkata")).toBe("4 Nov 2026, 15:32");
  });
  it("with no zone named it is UTC and says so, to match the downloaded file", () => {
    expect(chargeWhen("2026-11-04T23:30:00.000Z")).toBe("4 Nov 2026, 23:30 UTC");
  });
  it("prints nothing for a date it cannot read, never 'Invalid Date'", () => {
    expect(chargeWhen("not a date")).toBe("");
  });
});

describe("chargeStatusText", () => {
  it("says Charged for a charge", () => {
    expect(chargeStatusText({ status: "charged" })).toBe("Charged");
  });
  it("says Refunded with the reason it was given back with", () => {
    expect(chargeStatusText({ status: "refunded", refund: { at: "x", reason: "The draft never arrived.", automatic: false } })).toBe("Refunded: The draft never arrived.");
  });
  it("says when the api gave it back by itself", () => {
    expect(chargeStatusText({ status: "refunded", refund: { at: "x", reason: "The task did not finish.", automatic: true } })).toBe("Refunded automatically: The task did not finish.");
  });
  it("a refunded charge with no reason on record still says Refunded", () => {
    expect(chargeStatusText({ status: "refunded" })).toBe("Refunded");
  });
});

describe("chargeCount", () => {
  it("is singular for one, and counts refunds apart from charges", () => {
    expect(chargeCount(1)).toBe("1 charge");
    expect(chargeCount(1200)).toBe("1,200 charges");
    expect(chargeCount(3, 1)).toBe("3 charges and 1 refund");
    expect(chargeCount(1, 2)).toBe("1 charge and 2 refunds");
  });

  it("writes credits given back with a minus sign and a charge as a plain figure", () => {
    expect(chargeAmount(25)).toBe("25");
    expect(chargeAmount(1500)).toBe("1,500");
    expect(chargeAmount(-25)).toBe("-25");
    expect(chargeAmount(-1500)).toBe("-1,500");
  });

  it("a refund line says which charge it is for, when it was made, and why", () => {
    const line = { status: "refund" as const, refundOf: { id: "r1", at: "2026-11-04T10:02:00.000Z" }, reason: "The draft never arrived.", automatic: false };
    expect(chargeStatusText(line, "UTC")).toBe("Given back for the charge of 4 Nov 2026, 10:02: The draft never arrived.");
    expect(chargeStatusText({ ...line, automatic: true, reason: "The task did not finish." }, "UTC")).toBe(
      "Given back automatically for the charge of 4 Nov 2026, 10:02: The task did not finish.",
    );
  });

  it("a refund line for a charge whose time is not on record says so, without inventing one", () => {
    expect(chargeStatusText({ status: "refund", refundOf: { id: "old", at: null }, reason: "Charged twice." })).toBe("Given back for an earlier charge: Charged twice.");
  });
});

describe("charges from shoppers", () => {
  it("states the per-reply number from the rate card", () => {
    const peaks = shopperReplyPeaks([{ useCase: "commerce.assistant", creditMultiplier: 5, free: false }]);
    expect(peaks).toBe(5);
    const c = shopperChargesCopy(peaks);
    expect(c.body).toContain("each reply it sends uses 5 Peaks");
    expect(c.body).toContain("not when you press a button");
    expect(c.control).toContain("To stop them, turn the storefront assistant off");
  });
  it("states no number the card does not carry", () => {
    expect(shopperReplyPeaks(undefined)).toBeNull();
    expect(shopperReplyPeaks([])).toBeNull();
    expect(shopperReplyPeaks([{ useCase: "commerce.assistant", creditMultiplier: 0, free: true }])).toBeNull();
    expect(shopperChargesCopy(null).body).not.toMatch(/\d/);
  });
  it("says Peaks and never AI credits on peakhour.ai", () => {
    const c = shopperChargesCopy(5);
    expect(`${c.heading} ${c.body} ${c.control}`).not.toMatch(/AI credit/);
  });
});

describe("the page", () => {
  it("shows the record and downloads from the dashboard route", () => {
    const here = (p: string) => readFileSync(resolve(import.meta.dirname, "..", p), "utf8");
    expect(CHARGES_CSV_PATH).toBe("/v1/dashboard/credits/charges.csv");
    expect(here("app/(site)/dashboard/peaks/page.tsx")).toContain("<ChargeRecordCard />");
    expect(here("hooks/use-credits.ts")).toContain('"/v1/dashboard/credits/charges"');
  });
});
