import { describe, expect, it } from "vitest";
import { PAGES } from "./pages";
import { cardLabel } from "./labels";

describe("cardLabel", () => {
  it("never leaks a pipe, a site suffix or a strapline onto a card", () => {
    for (const p of PAGES) {
      const label = cardLabel(p);
      expect(label, p.pageId).not.toMatch(/[|:]/);
      expect(label, p.pageId).not.toMatch(/\bPeakhour(\.ai)?\s*$/i);
      expect(label.length, p.pageId).toBeGreaterThan(0);
      expect(label.length, p.pageId).toBeLessThanOrEqual(40);
    }
  });

  it("names the integrations and features the way a merchant does", () => {
    const label = (id: string) => cardLabel(PAGES.find((p) => p.pageId === id)!);
    expect(label("integrations.meta.ads")).toBe("Meta Ads");
    expect(label("integrations.whatsapp")).toBe("WhatsApp Business");
    expect(label("features.brand.voice")).toBe("Brand voice");
  });
});
