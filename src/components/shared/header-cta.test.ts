import { describe, expect, it } from "vitest";
import { PAGES } from "@/lib/seo/pages";
import { headerCtaForPage } from "./header";

const WAITLIST = { label: "Join the waitlist", href: "/auth?intent=waitlist" };

describe("the header CTA on a Shopify page", () => {
  it("says Install on Shopify when the hero does, so the two never disagree", () => {
    const shopify = PAGES.filter((p) => p.scope === "shopify" && p.primaryCta.kind === "install");
    expect(shopify.length).toBeGreaterThan(5);
    for (const p of shopify) expect(headerCtaForPage(p, WAITLIST), p.pageId).toEqual({ label: "Install on Shopify", href: "/shopify" });
  });

  it("leaves every other page on the platform's own signup CTA", () => {
    for (const p of PAGES.filter((q) => q.scope !== "shopify" || q.primaryCta.kind !== "install")) {
      expect(headerCtaForPage(p, WAITLIST), p.pageId).toBe(WAITLIST);
    }
    expect(headerCtaForPage(undefined, WAITLIST)).toBe(WAITLIST);
  });
});
