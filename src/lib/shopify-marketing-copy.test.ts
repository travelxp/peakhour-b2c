import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SHOPIFY_CLOSING,
  SHOPIFY_HERO,
  SHOPIFY_OWNER_WHATSAPP,
  SHOPIFY_SEO,
  shopifyFaq,
  shopifyHeroTicks,
  shopifyInstallCta,
  shopifyJsonLd,
} from "./shopify-features";
import { SITE } from "./utils";

vi.mock("@/lib/marketing-pages", () => ({ getMarketingSitemapEntries: async () => [] }));

/**
 * The Shopify launch page, its wiring, and the site copy that said more than
 * is live. Source files are read as text (comments stripped is not needed:
 * each check names a sentence or a word that only copy would hold).
 */
const SRC = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
/** JSX source flattened: tags dropped, entities decoded, whitespace collapsed (the policy wraps at ~90 cols). */
const flat = (s: string) =>
  s
    .replace(/<\/?strong>|<\/?em>|<\/?code>/g, "")
    .replace(/\{" "\}/g, " ")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ");

describe("the hero", () => {
  it("pins the headline and lede", () => {
    expect(`${SHOPIFY_HERO.headline} ${SHOPIFY_HERO.accent}`).toBe("Your store's AI team, right inside Shopify.");
    expect(SHOPIFY_HERO.lede).toBe(
      "Peakhour answers your shoppers from your real catalogue, builds the product shelves that sell, confirms COD orders on WhatsApp, and fixes product pages so Google can find them. It suggests; you approve. Almost everything it changes can be undone.",
    );
  });

  it("★says the trial only when the catalog gives one", () => {
    expect(shopifyHeroTicks(14)).toEqual(["14-day free trial", "Billed through Shopify", "Nothing changes without your OK"]);
    expect(shopifyHeroTicks(null)).toEqual(["Billed through Shopify", "Nothing changes without your OK"]);
    expect(shopifyHeroTicks(0)).not.toContain("0-day free trial");
    expect(shopifyHeroTicks(14, true)).toEqual(["14-day free trial", "Nothing changes without your OK"]);
  });

  it("pins the SEO title and description", () => {
    expect(SHOPIFY_SEO.title).toBe("Peakhour for Shopify — AI shopping assistant and store autopilot");
    expect(SHOPIFY_SEO.path).toBe("/shopify");
  });
});

describe("shopifyInstallCta", () => {
  const signup = { label: "Join the waitlist", href: "/auth?intent=waitlist" };
  it("PASS: install when the connector is open", () => {
    expect(shopifyInstallCta({ comingSoon: false, installHref: "https://apps.shopify.com/x", signup })).toEqual({
      kind: "install",
      label: "Install on Shopify",
      href: "https://apps.shopify.com/x",
    });
  });
  it("★the signup button when it is coming soon", () => {
    expect(shopifyInstallCta({ comingSoon: true, installHref: "https://apps.shopify.com/x", signup })).toEqual({
      kind: "soon",
      signup,
    });
  });
});

describe("shopifyFaq", () => {
  it("PASS: names the catalog's trial and allowance", () => {
    const faq = shopifyFaq({ trialDays: 9, peaksIncluded: "7,777" });
    const all = faq.map((f) => f.a).join(" ");
    expect(all).toContain("9 days");
    expect(all).toContain("7,777 a month");
    expect(all).toContain("top-ups on peakhour.ai");
  });
  it("promises no trial and no number the catalog does not give", () => {
    const all = shopifyFaq({ trialDays: null, peaksIncluded: null }).map((f) => f.a).join(" ");
    expect(all).not.toMatch(/\d+ days first/);
    expect(all).not.toMatch(/\d[\d,]* a month/);
  });
  it("coming soon: no question about Shopify billing", () => {
    const qs = shopifyFaq({ trialDays: 14, peaksIncluded: null, comingSoon: true }).map((f) => f.q);
    expect(qs).not.toContain("How am I billed?");
    expect(qs).toHaveLength(11);
  });
  it("answers the owner's ten questions plus the team's two, and never calls Peakhour a free plan", () => {
    const faq = shopifyFaq({ trialDays: 14, peaksIncluded: "5,000" });
    expect(faq).toHaveLength(12);
    expect(faq.map((f) => f.a).join(" ")).not.toMatch(/free (plan|tier)/i);
  });
  it("runs setup, WhatsApp, control, privacy, then pricing", () => {
    const qs = shopifyFaq({ trialDays: 14, peaksIncluded: null }).map((f) => f.q);
    const at = (q: string) => qs.indexOf(q);
    expect(at("Do I need to change my theme code?")).toBe(0);
    expect(at("Can I run my store from WhatsApp?")).toBeGreaterThan(at("What does WhatsApp cost?"));
    expect(at("Will Peakhour change my store without asking?")).toBeGreaterThan(at("Can I run my store from WhatsApp?"));
    expect(at("What happens to my shoppers' data?")).toBeGreaterThan(at("Will Peakhour change my store without asking?"));
    expect(at("Is Peakhour free?")).toBeGreaterThan(at("What happens to my shoppers' data?"));
  });
});

describe("Peakhour on WhatsApp (the merchant's own line)", () => {
  const all = [
    SHOPIFY_OWNER_WHATSAPP.lede,
    SHOPIFY_OWNER_WHATSAPP.note,
    ...SHOPIFY_OWNER_WHATSAPP.points.flatMap((p) => [p.title, p.body]),
  ].join(" ");
  it("says what the api enforces: CONFIRM before spend or publish, verified numbers only", () => {
    expect(all).toContain("Nothing spends or publishes without CONFIRM");
    expect(all).toContain("Only numbers you have verified can give it instructions");
  });
  it("★claims no store action WhatsApp has no command for", () => {
    expect(all).not.toMatch(/restock|reorder|mark ?down|change (a |the )?price|edit (a |the )?post/i);
  });
  it("★never says WhatsApp can switch Peakhour back on", () => {
    expect(all).toContain("Switching it back on is done in the app.");
    expect(all).not.toMatch(/\bRESUME\b|turn (it )?(back )?on from WhatsApp/i);
  });
});

describe("the closing band", () => {
  it("names the difference from a chatbot, and keeps the undo claim to 'almost'", () => {
    expect(SHOPIFY_CLOSING.headline).toBe("Chatbots answer. Peakhour does the work.");
    expect(SHOPIFY_CLOSING.body).toContain("almost everything can be undone");
    expect(SHOPIFY_CLOSING.body).not.toMatch(/\bevery change\b|never wrong/i);
  });
});

describe("shopifyJsonLd", () => {
  const faqs = shopifyFaq({ trialDays: 14, peaksIncluded: null });
  it("★has no rating or review, with or without an offer", () => {
    for (const offer of [null, { price: 59, currency: "USD" }]) {
      const s = JSON.stringify(shopifyJsonLd({ url: "https://peakhour.ai/shopify", faqs, offer }));
      expect(s).not.toMatch(/aggregateRating|ratingValue|reviewCount|"review"|"@type":"Review"/i);
    }
  });
  it("PASS: the offer is the catalog's list price", () => {
    const [, app] = shopifyJsonLd({ url: "u", faqs, offer: { price: 59, currency: "USD" } });
    expect(app.offers).toEqual({ "@type": "Offer", price: "59", priceCurrency: "USD" });
    const [, bare] = shopifyJsonLd({ url: "u", faqs, offer: null });
    expect(bare.offers).toBeUndefined();
  });
});

describe("wiring", () => {
  it("lists /shopify in the sitemap", async () => {
    const { default: sitemap } = await import("../app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`${SITE.url.replace(/\/$/, "")}/shopify`);
  });
  it("lets /shopify through the coming-soon gate, and keeps /shopify/connect", () => {
    const mw = read("middleware.ts");
    expect(mw).toMatch(/PUBLIC_PATHS = \[[\s\S]*?"\/shopify",[\s\S]*?"\/shopify\/connect",[\s\S]*?\];/);
  });
  it("footer has a Works with group naming Shopify and WordPress", () => {
    const f = read("components/shared/footer.tsx");
    expect(f).toMatch(/heading: "Works with",\s*links: \[\s*\{ href: "\/shopify", label: "Shopify" \},\s*\{ href: "\/content", label: "WordPress" \},/);
  });
  it("/commerce links to /shopify and the pricing strip's Shopify card links there too", () => {
    expect(flat(read("app/(site)/commerce/page.tsx"))).toContain("Using Shopify? <Link href=\"/shopify\"");
    expect(read("lib/pricing-catalog.ts")).toMatch(/href: SHOPIFY_APP_STORE_URL,\s*pageHref: "\/shopify"/);
  });
});

describe("privacy policy", () => {
  const policy = flat(read("app/(site)/privacy-policy/page.tsx"));
  it("pins the new how-far-back paragraph", () => {
    expect(policy).toContain(
      "How far back we look. Shopify has approved Peakhour to read your store's full order history, not only the most recent 60 days. Each store confirms this permission when it installs or updates the app; until your store has confirmed it, Shopify limits us to your last 60 days of orders, and the app tells you so.",
    );
  });
  it("pins the three purposes", () => {
    expect(policy).toContain(
      "We use older orders for three purposes only. Merchandising: from older orders we read line items, dates and order status (never the shopper's name, phone number, email address or postcode) to tell seasonal patterns from real changes in demand, and slow-moving stock from stock that has stopped selling. Order status: when a signed-in shopper asks the storefront assistant about their own order, we look up that shopper's orders of any age and show the status, delivery estimate and tracking to that shopper only. The reply is kept only as part of the conversation, which is deleted 180 days after its last message, and it is never used for advertising, sale or profiling. Customer support: when someone on your team opens a conversation in the Peakhour Inbox, we show that customer's orders with your store, of any age, so the person answering knows the customer's history. This is shown only to your team, inside your own Peakhour account, and is never used for advertising, sale or profiling.",
    );
  });
  it("★no longer says the permission is not granted or only requested", () => {
    expect(policy).not.toMatch(/not granted today|we have prepared a request|If it is approved/i);
  });
  it("the stamp moved to the date of this change", () => {
    expect(SITE.legalLastUpdated).toBe("November 3, 2026");
  });
});

describe("retired names and over-claims are gone", () => {
  const files = [
    "app/(site)/coming-soon/page.tsx",
    "app/(site)/launch-partner/page.tsx",
    "app/(site)/launch-partner/launch-partner-form.tsx",
    "lib/pillars.ts",
    "lib/pricing-catalog.ts",
    "components/marketing/pricing/pricing-faq.tsx",
    "app/(site)/pricing/teams/page.tsx",
    "app/(site)/growth/page.tsx",
    "lib/how-it-works.ts",
    "components/marketing/pillar-page.tsx",
  ];
  const body = (f: string) =>
    flat(
      read(f)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n"),
    );
  const banned: [string, RegExp][] = [
    ["Peakhour Commerce / Peakhour Marketing", /Peakhour (Commerce|Marketing)\b/],
    ["recover carts", /recover\s+carts|carts, re-engage/i],
    ["zero agent time", /zero agent time/i],
    ["hourly optimiser", /\bhourly\b/i],
    ["around the clock (Growth)", /around the clock. Growth/i],
    ["every lead from every channel", /every lead from every channel/i],
    ["Ads on autopilot", /on autopilot/i],
    ["AI-drafted review replies", /AI-drafted responses|fix it in a tap/i],
    ["found on AI search", /found on[^.]*AI search|Get found on Google, Maps/i],
    ["DMs in the inbox promise", /email, chat, WhatsApp, DMs/],
    ["surprise paywall", /surprise paywall/i],
    ["SSO", /\bSSO\b/],
    ["five pillars", /five pillars/i],
    ["catalog-grounded", /catalog-grounded/i],
  ];
  for (const f of files) {
    it(`${f} has none of them`, () => {
      const b = body(f);
      for (const [name, re] of banned) {
        expect(b.match(re), `${f}: ${name}`).toBeNull();
      }
    });
  }

  it("the new live copy is there", () => {
    expect(flat(read("lib/pillars.ts"))).toContain("AI replies instantly and shares a checkout link; you step in when needed.");
    expect(flat(read("lib/pricing-catalog.ts"))).toContain("Your AI team inside Shopify: assistant, Smart Rails, COD confirmation and more.");
    expect(flat(read("components/marketing/pricing/pricing-faq.tsx"))).toContain(
      "Install the Shopify app and the assistant, Smart Rails, COD confirmation, catalogue fixes and more run inside your Shopify admin; the rest of Peakhour is in your peakhour.ai dashboard.",
    );
    expect(flat(read("lib/how-it-works.ts"))).toContain("WooCommerce connects with an API key");
    expect(flat(read("app/(site)/launch-partner/launch-partner-form.tsx"))).toContain('shopify: "Peakhour for Shopify"');
    expect(flat(read("app/(site)/coming-soon/page.tsx"))).toContain("Commerce, Content, Growth, Support and Presence");
  });
});
