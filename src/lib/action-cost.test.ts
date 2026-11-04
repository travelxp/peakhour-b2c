import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { actionCost, actionCostSentence, actionCostShort, priceUseCases, type ActionCostKey } from "@/lib/action-cost";

/**
 * What a button says it will cost (F3). The number is the rate card's; these pin
 * the four states, the "one act, one charge" rule, and that the places that used
 * to say "Uses Peaks." now say a number.
 */
// Markup only: the rate card hook is replaced, so nothing here reaches the api or the auth provider.
const h = vi.hoisted(() => ({ card: { data: undefined as unknown, isError: false } }));
vi.mock("@/hooks/use-credits", () => ({ useCreditsRateCard: () => h.card }));
const { ActionCost } = await import("@/components/dashboard/action-cost");

const card = [
  { useCase: "ask_peakhour", creditMultiplier: 8, free: false },
  { useCase: "compose_web_page", creditMultiplier: 150, free: false },
  { useCase: "commerce.pricer.brief", creditMultiplier: 4, free: false },
  { useCase: "commerce.reputation.respond", creditMultiplier: 0, free: true },
  { useCase: "content_editor", creditMultiplier: 150, free: false },
] as const;

describe("actionCost", () => {
  it("reads the price off the rate card, not off a constant", () => {
    expect(actionCost(card, "ask")).toEqual({ state: "priced", peaks: 8, upTo: false });
    const repriced = card.map((r) => (r.useCase === "ask_peakhour" ? { ...r, creditMultiplier: 12 } : r));
    expect(actionCost(repriced, "ask")).toEqual({ state: "priced", peaks: 12, upTo: false });
  });

  it("a free row is Free, and a row the card lacks is NOT free", () => {
    expect(actionCost(card, "reviewReply")).toEqual({ state: "free" });
    expect(actionCost(card, "findSources")).toEqual({ state: "unknown" });
  });

  it("a card that has not arrived is loading; one that failed is unknown; neither is a price or Free", () => {
    expect(actionCost(undefined, "ask")).toEqual({ state: "loading" });
    expect(actionCost(undefined, "ask", true)).toEqual({ state: "unknown" });
    for (const c of [actionCost(undefined, "ask"), actionCost(undefined, "ask", true)]) {
      expect(actionCostSentence(c)).not.toMatch(/\d|free/i);
      expect(actionCostShort(c)).toBe("");
    }
  });

  it("a free row with a leftover multiplier is Free (the `free` flag is authoritative)", () => {
    const rows = [{ useCase: "commerce.reputation.respond", creditMultiplier: 4, free: true }];
    expect(actionCost(rows, "reviewReply")).toEqual({ state: "free" });
  });

  it("several rows: priced at the dearest, 'up to' only when they differ", () => {
    expect(priceUseCases(card, ["ask_peakhour", "compose_web_page"])).toEqual({ state: "priced", peaks: 150, upTo: true });
    expect(priceUseCases(card, ["content_editor", "content_editor"])).toEqual({ state: "priced", peaks: 150, upTo: false });
    // a free row beside a priced one does not lower or raise the price
    expect(priceUseCases(card, ["commerce.reputation.respond", "ask_peakhour"])).toEqual({ state: "priced", peaks: 8, upTo: false });
  });

  it("one missing row among several makes the whole action unknown (a quote that may be too low is worse than none)", () => {
    const partial = card.filter((r) => r.useCase !== "content_editor");
    expect(actionCost(partial, "composerRewrite")).toEqual({ state: "unknown" });
    expect(priceUseCases(card, ["ask_peakhour", "not_a_row"])).toEqual({ state: "unknown" });
  });
});

describe("the words", () => {
  it("says the number with the unit, a per-item unit, and Free", () => {
    expect(actionCostSentence({ state: "priced", peaks: 8, upTo: false })).toBe("Costs 8 Peaks.");
    expect(actionCostSentence({ state: "priced", peaks: 1500, upTo: false })).toBe("Costs 1,500 Peaks.");
    expect(actionCostSentence({ state: "priced", peaks: 150, upTo: false }, "for each page")).toBe("Costs 150 Peaks for each page.");
    expect(actionCostSentence({ state: "priced", peaks: 150, upTo: true })).toBe("Costs up to 150 Peaks.");
    expect(actionCostSentence({ state: "free" })).toBe("Free — you are never charged for this.");
    expect(actionCostSentence({ state: "free" }, "for each page")).toBe("Free — you are never charged for this.");
    expect(actionCostSentence({ state: "loading" })).toBe("Checking the price…");
    expect(actionCostSentence({ state: "unknown" })).toBe("The price is on your Peaks page.");
  });

  it("never says AI credits on peakhour.ai", () => {
    for (const c of [{ state: "priced", peaks: 8, upTo: false }, { state: "free" }, { state: "loading" }, { state: "unknown" }] as const) {
      expect(actionCostSentence(c)).not.toMatch(/AI credit/i);
    }
  });
});

describe("the component", () => {
  const html = (action: ActionCostKey, unit?: string) => renderToStaticMarkup(ActionCost({ action, unit }));

  it("renders the rate card's number beside the button", () => {
    h.card = { data: { useCases: [...card] }, isError: false };
    expect(html("ask")).toContain("Costs 8 Peaks.");
    expect(html("ask")).toContain('data-cost-state="priced"');
  });

  it("passes a per-item unit through to the sentence", () => {
    h.card = { data: { useCases: [...card] }, isError: false };
    expect(html("webPages", "for each page")).toContain("Costs 150 Peaks for each page.");
  });

  it("renders Free for a free task and the loading line before the card arrives", () => {
    h.card = { data: { useCases: [...card] }, isError: false };
    expect(html("reviewReply")).toContain("Free — you are never charged for this.");
    h.card = { data: undefined, isError: false };
    expect(html("ask")).toContain("Checking the price…");
  });
});

describe("the places that said 'Uses Peaks.'", () => {
  const read = (p: string) => readFileSync(resolve(import.meta.dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

  it("no longer say it, and carry the price instead", () => {
    const pricing = read("components/commerce/pricing.tsx");
    const replenisher = read("components/commerce/replenisher-panel.tsx");
    const reviews = read("components/commerce/reviews.tsx");
    const inventory = read("components/commerce/inventory-panel.tsx");
    for (const t of [pricing, replenisher, reviews, inventory]) expect(t).not.toMatch(/Uses Peaks|uses Peaks/);
    expect(pricing).toContain('<ActionCost action="pricerBrief" />');
    expect(replenisher).toContain('<ActionCost action="replenisherBrief" />');
    expect(reviews).toContain('<ActionCost action="reviewReply" />');
    expect(reviews).toContain('<ActionCost action="reviewAnalysis"');
  });

  it("the Ask page, Generate pages, Find sources, the Strategist and the LinkedIn composer show a price", () => {
    expect(read("components/ask/ask-conversation.tsx")).toContain('<ActionCost action="ask"');
    expect(read("app/(site)/dashboard/pages/page.tsx")).toContain('<ActionCost action="webPages" unit="for each page"');
    expect(read("app/(site)/dashboard/pages/components/generate-pages-dialog.tsx")).toContain('<ActionCost action="webPages" unit="for each page"');
    expect(read("app/(site)/dashboard/content/sources/components/add-source-drawer.tsx")).toContain('<ActionCost action="findSources" />');
    expect(read("app/(site)/dashboard/strategist/[id]/page.tsx")).toContain('<ActionCost action="contentBrief"');
    expect(read("app/(site)/dashboard/strategist/[id]/page.tsx")).toContain('<ActionCost action="contentDraft"');
    expect(read("app/(site)/dashboard/content/linkedin/_components/post-composer.tsx")).toContain('<ActionCost action="linkedinRewrite"');
    expect(read("app/(site)/dashboard/content/linkedin/_components/engage-shared.tsx")).toContain('<ActionCost action="linkedinReply"');
    expect(read("components/composer/ai-compose-toolbar.tsx")).toContain("actionCostSentence(cost)");
    expect(read("app/(site)/dashboard/strategist/page.tsx")).toContain('<ActionCost action="contentIdeas"');
    expect(read("app/(site)/dashboard/content/linkedin/_components/post-composer.tsx")).toContain('<ActionCost action="linkedinCarousel"');
    expect(read("components/repurpose/repurpose-sheet.tsx")).toContain('<ActionCost action="repurpose"');
    expect(read("app/(site)/dashboard/content/x/_components/mentions-list.tsx")).toContain('<ActionCost action="xReply"');
  });
});

describe("the shown prices are the ones the routes bill", () => {
  // The api's test (tests/unit/shown-price-matches-billing.test.ts) proves each row is billed by the
  // route the button reaches; this proves the catalog here is exactly the one it proved.
  it("ACTION_USE_CASES equals the shared table, key for key", async () => {
    const { ACTION_USE_CASES } = await import("@/lib/action-cost");
    const shared = (await import("./shown-price-actions.fixture.json")).default as { b2c: Record<string, string[]> };
    expect(Object.fromEntries(Object.entries(ACTION_USE_CASES).map(([k, v]) => [k, [...v]]))).toEqual(shared.b2c);
  });
});
