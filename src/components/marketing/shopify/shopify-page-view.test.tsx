import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShopifyPageView } from "./shopify-page-view";
import { CHANNELS } from "@/lib/pricing-catalog";
import type { PricingEntry, PricingResponse, ResolvedProductTier } from "@/lib/pricing";
import type { SignupCta } from "@/lib/catalog";

/**
 * /shopify states a price, a trial, a credit allowance and an install link.
 * Each is read from the catalog fixture below, never from the page, so these
 * render it with numbers the page could not have invented.
 */

function entry(over: Partial<PricingEntry> = {}): PricingEntry {
  return {
    currency: "USD",
    monthly: 61,
    yearly: 611,
    trialDays: 9,
    monthlyDiscountPct: 0,
    yearlyDiscountPct: 0,
    monthlyCampaignLabel: null,
    yearlyCampaignLabel: null,
    billingProviderKey: "shopify",
    taxIncluded: false,
    gstApplicable: false,
    vatApplicable: false,
    displayPrefix: "$",
    ...over,
  };
}

function pricing(over: Partial<PricingEntry> = {}, peaksIncluded: number | undefined = 7777): PricingResponse {
  const tier: ResolvedProductTier = {
    key: "suite",
    name: "Peakhour Suite",
    features: [],
    limits: {},
    highlightAsRecommended: true,
    version: 1,
    pricing: entry(over),
    ...(peaksIncluded === undefined ? {} : { peaksIncluded }),
  };
  return {
    country: "US",
    products: [
      { key: "commerce", name: "Commerce", pillar: "commerce", status: "live", tiers: [tier] },
    ],
  };
}

const openSignup: SignupCta = { label: "Start your 9-day free trial", href: "/auth" };

function html(props: Partial<React.ComponentProps<typeof ShopifyPageView>> = {}) {
  return renderToStaticMarkup(
    <ShopifyPageView pricing={pricing()} comingSoon={false} signup={openSignup} {...props} />,
  );
}

/** The page's text with tags dropped and entities decoded, so a sentence can be matched whole. */
function text(markup: string) {
  return markup
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("the install button", () => {
  it("PASS: sends the visitor to the App Store listing, in a new tab", () => {
    const out = html();
    const m = out.match(/<a href="([^"]*)"[^>]*target="_blank"[^>]*>Install on Shopify/);
    expect(m?.[1]).toBe(CHANNELS.shopify.href);
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("★while the catalog marks the connector coming soon: a chip and the signup button, and NO link to the listing", () => {
    const out = html({ comingSoon: true });
    expect(out).toContain("Coming soon");
    expect(out).toContain("Start your 9-day free trial");
    expect(out).not.toContain(">Install on Shopify");
    expect(out).not.toContain(`href="${CHANNELS.shopify.href}"`);
  });

  it("coming soon with signup closed: the chip alone, no button at all", () => {
    const out = html({ comingSoon: true, signup: { label: "Launching soon", href: "/auth", disabled: true } });
    expect(out).toContain("Coming soon");
    expect(out).not.toContain("Install on Shopify");
    // The pricing card says why there is no button; the hero adds none.
    expect(out.match(/Launching soon/g)).toHaveLength(1);
  });
});

describe("★coming soon: nothing on the page assumes an App Store install or Shopify billing", () => {
  it("PASS: with the connector open the page says both", () => {
    const t = text(html());
    expect(t).toContain("Install from the Shopify App Store");
    expect(t).toContain("One plan, billed through Shopify.");
  });

  it("drops the install claim, the Shopify-billing claims and the Shopify variant of the card", () => {
    const t = text(html({ comingSoon: true }));
    expect(t).not.toMatch(/Install from the Shopify App Store/);
    expect(t).not.toMatch(/billed through Shopify/i);
    expect(t).not.toMatch(/invoice through Shopify/i);
    // The signup trial collects no card, so the plain card's note is the true one.
    expect(t).toContain("9-day free trial · no card to start");
  });
});

describe("price, trial and credits come from the catalog", () => {
  it("PASS: the hero tick and the card show the fixture's trial, price and allowance", () => {
    const t = text(html());
    expect(t).toContain("9-day free trial");
    expect(t).toContain("9-day free trial · billed through Shopify");
    expect(t).toContain("$61");
    expect(t).toContain("7,777");
    expect(t).toContain("AI credits (Peaks) a month");
  });

  it("★never says 'No card to start' (the trial is billed through Shopify)", () => {
    expect(text(html())).not.toMatch(/no card to start/i);
  });

  it("with no trial in the catalog the page promises none", () => {
    const t = text(html({ pricing: pricing({ trialDays: 0 }) }));
    expect(t).not.toMatch(/\d+-day free trial/);
    expect(t).toContain("Billed through Shopify");
  });

  it("with no Suite in the catalog the page names no price", () => {
    const t = text(html({ pricing: null }));
    expect(t).toContain("You'll see your price for your country at sign-up.");
    expect(t).not.toContain("Check back soon");
    expect(t).not.toContain("$61");
  });

  it("states the country, currency and tax under the price, with a labelled switcher", () => {
    const out = html({ country: "US" });
    const t = text(out);
    expect(t).toContain("Prices for United States in USD · plus applicable tax");
    expect(t).toContain("Not in United States? Change");
    expect(out).toContain('action="/shopify#pricing"');
    expect(out).toMatch(/<label[^>]*for="country-[^"]*"[^>]*>Show prices for<\/label>/);
    expect(out).toContain('<option value="ZZ">Other (USD)</option>');
  });

  it("a code the API priced in USD as a fallback names no country", () => {
    const t = text(html({ country: "ZA" }));
    expect(t).toContain("Prices in USD · plus applicable tax");
    expect(t).not.toContain("South Africa");
  });

  it("a live campaign is shown by the catalog's own label", () => {
    const t = text(
      html({
        pricing: pricing({ monthlyDiscountPct: 50, monthlyCampaignLabel: "Founding price: Peakhour Suite" }),
      }),
    );
    expect(t).toContain("Founding price: Peakhour Suite · 50% off monthly");
  });
});

describe("structured data", () => {
  function graphs(markup: string) {
    return [...markup.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (m) => JSON.parse(m[1].replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\u0026/g, "&")),
    );
  }

  it("PASS: a FAQPage and a SoftwareApplication are present", () => {
    const g = graphs(html());
    expect(g.map((x) => x["@type"]).sort()).toEqual(["FAQPage", "SoftwareApplication"]);
    expect(g.find((x) => x["@type"] === "FAQPage").mainEntity.length).toBeGreaterThanOrEqual(8);
  });

  it("the SoftwareApplication offer is the price the card shows, campaign included", () => {
    const app = (p: PricingResponse) =>
      graphs(html({ pricing: p })).find((x) => x["@type"] === "SoftwareApplication");
    expect(app(pricing()).offers.price).toBe("61");
    expect(app(pricing({ monthlyDiscountPct: 50, monthlyCampaignLabel: "x" })).offers.price).toBe("30");
  });

  it("★carries no rating and no review", () => {
    const raw = html();
    for (const g of graphs(raw)) {
      const s = JSON.stringify(g);
      expect(s).not.toMatch(/aggregateRating|ratingValue|reviewCount|"review"|"@type":"Review"/);
    }
  });
});

describe("the page reads as the owner decided", () => {
  it("has the six groups with jump links", () => {
    const out = html();
    for (const id of ["sell", "shelves", "run", "catalogue", "content", "control"]) {
      expect(out).toContain(`href="#${id}"`);
      expect(out).toContain(`id="${id}"`);
    }
  });

  it("never shows a retired name", () => {
    const t = text(html());
    expect(t).not.toMatch(/Growth Council|Commerce Assistant|Content Assistant|Commerce Insights|\bLens\b/);
  });
});
