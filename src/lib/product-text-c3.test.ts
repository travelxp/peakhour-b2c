import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { shopifyFaq } from "./shopify-features";

/**
 * C3: text that said more than the product does, pinned sentence by sentence. Each new sentence is present and the
 * sentence it replaced is gone. Source is read as text and flattened (JSX wraps at ~76 columns).
 */
const SRC = resolve(__dirname, "..");
const flat = (rel: string) =>
  readFileSync(join(SRC, rel), "utf8")
    .replace(/&rsquo;/g, "’")
    .replace(/\{" "\}/g, " ")
    .replace(/\s+/g, " ");

describe("Presence says what it does", () => {
  const home = flat("components/presence/presence-home.tsx");
  const card = flat("components/presence/gbp-connect-card.tsx");

  it("the header: what the page does today, and that edits are made on Google for now", () => {
    expect(home).toContain("See your Google listing, how customers use it, and your Google reviews. To change your listing, use Google for now.");
    expect(home).not.toContain("Connect your Google Business Profile listing and answer");
  });

  it("the header no longer says 'everywhere'", () => {
    expect(home).toContain("Your Google listing and reviews, in one place");
    expect(home).not.toContain("Be found, accurate");
  });

  it("no promise of an edit-once record, syncing to other networks, or a performance dashboard", () => {
    expect(home).not.toContain("One record you edit once");
    expect(home).not.toMatch(/synced across/i);
    expect(home).not.toContain("local performance in one dashboard");
  });

  it("the connect card promises reviews, not call and click figures nothing shows", () => {
    expect(card).toContain("Connect your listing to get your Google reviews in one inbox and reply to them there.");
    expect(card).toContain("Reconnect to resume your reviews.");
    expect(card).not.toContain("sync calls, direction requests and website clicks");
    expect(card).not.toContain("resume insights and reviews");
  });

  it("both 'coming' cards are built, so the heading and the promises are gone", () => {
    expect(home).not.toContain("Coming with Presence");
    expect(home).not.toContain("we keep them in sync across every network");
    expect(home).not.toContain("Explain this");
    expect(home).toContain("<ListingPanel location={location} />");
    expect(home).toContain("<InsightsPanel location={location} />");
  });
});

describe("the X page says what the composer does", () => {
  const x = flat("app/(site)/dashboard/content/x/page.tsx");
  it("threads and scheduling work; images are not in yet", () => {
    expect(x).toContain("Threads and scheduling work here. Images aren’t in the composer yet.");
    expect(x).not.toContain("Text-only for now");
    expect(x).not.toMatch(/threads, and scheduling are coming/);
  });
});

describe("Approve & publish says where the page goes", () => {
  const actions = flat("app/(site)/dashboard/pages/components/web-page-actions.tsx");
  it("on Peakhour's own site, not the merchant's website", () => {
    expect(actions).toContain(
      "This publishes the page on Peakhour’s own site, not on your website; connecting your own domain isn’t available yet.",
    );
    expect(actions).toContain("Published on Peakhour’s site at /${res.slug}");
  });
  it("no promise that it is live on the merchant's website", () => {
    expect(actions).not.toContain("live on your website");
    expect(actions).not.toContain("it's live at");
  });
});

describe("the emergency stop pauses automatic work, not everything", () => {
  const src = flat("lib/shopify-features.ts");
  it("the FAQ and the feature card", () => {
    const answer = shopifyFaq({ trialDays: 14, peaksIncluded: null }).find((f) => f.q === "Will Peakhour change my store without asking?")?.a;
    expect(answer).toBe(
      "It changes only what you switch on. Each change appears in your activity feed with an Undo, and the emergency stop pauses its automatic work.",
    );
    expect(src).toContain("You can pause its automatic work in a second.");
    expect(src).toContain("One button that pauses Peakhour's automatic work in your store.");
    expect(src).toContain("Peakhour pauses its automatic work.");
    expect(src).not.toContain("stops Peakhour from making changes");
    expect(src).not.toMatch(/pauses? everything/i);
  });
});
