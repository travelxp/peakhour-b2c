import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import type { Insight, InsightsResponse, InsightsState } from "@/lib/insights";

// The view is pure; the hooks are replaced so nothing here reaches the api or the auth provider.
vi.mock("@/hooks/use-insights", () => ({
  useInsights: () => ({}),
  useInsightDismissal: () => ({ isPending: false, isError: false, mutate: () => {} }),
}));
vi.mock("@/hooks/use-knowledge-base", () => ({
  useKbRequests: () => ({
    isPending: false,
    isError: false,
    data: { requests: [{ id: "r1", question: "Do you ship to Goa?", timesAsked: 4, lastAskedAt: null, createdAt: null, status: "open", answeredEntryId: null }] },
  }),
  useAnswerKbRequest: () => ({ isPending: false, mutate: () => {} }),
  useDismissKbRequest: () => ({ isPending: false, mutate: () => {} }),
}));
vi.mock("@/hooks/use-commerce-stores", () => ({ useCommerceStores: () => ({ data: [] }) }));
vi.mock("@/components/inbox/support-results-panel", () => ({ SupportResultsPanel: () => null }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({}), usePathname: () => "/dashboard/inbox" }));

const { InsightsView, INSIGHTS_EMPTY, INSIGHTS_HEADING } = await import("./insights-pane");

const item = (over: Partial<Insight> = {}): Insight => ({
  key: "delivery-times",
  type: "missing_store_info",
  title: "Customers can't get delivery times",
  count: 14,
  shopperDays: 6,
  trend: "up",
  why: "Shoppers ask when an order arrives.",
  nextStep: { label: "Add shipping details", kind: "knowledge" },
  status: "open",
  evidence: { available: 9, expired: 0 },
  surfaces: ["storefront", "whatsapp"],
  lastAskedAt: "2026-11-05T09:00:00.000Z",
  ...over,
});
const data = (items: Insight[], over: Partial<InsightsResponse> = {}): InsightsResponse => ({
  windowDays: 30,
  since: "2026-10-07T00:00:00.000Z",
  needsAction: items.filter((i) => i.status === "open").length,
  counts: { product_demand: 0, missing_product_info: 0, missing_store_info: 0, purchase_concern: 0, support_issue: 0, top_question: 0 },
  quietCount: 0,
  items,
  ...over,
});
const html = (state: InsightsState, filter: Parameters<typeof InsightsView>[0]["filter"] = "needs_action", shop: string | null = "table-story.myshopify.com") =>
  renderToStaticMarkup(<InsightsView state={state} filter={filter} onPick={() => {}} onRetry={() => {}} shop={shop} />);

describe("the states are different sentences", () => {
  it("always carries the heading", () => {
    expect(html({ kind: "loading" })).toContain(INSIGHTS_HEADING);
    expect(INSIGHTS_HEADING).toBe("What customers are telling you");
  });
  it("loading is a skeleton and claims nothing", () => {
    const out = html({ kind: "loading" });
    expect(out).toContain('data-insights="loading"');
    expect(out).not.toContain("Nothing needs your attention");
    expect(out).not.toContain("Couldn&#x27;t load");
  });
  it("a failed read says it could not load and never the empty sentence", () => {
    const out = html({ kind: "error" });
    expect(out).toContain('data-insights="error"');
    expect(out).toContain("load");
    expect(out).toContain("Retry");
    expect(out).not.toContain("Nothing needs your attention");
  });
  it("empty uses the briefed words", () => {
    const out = html({ kind: "empty", data: data([]) });
    expect(out).toContain('data-insights="empty"');
    expect(out).toContain("Nothing needs your attention yet. Insights appear once several customers raise the same thing.");
    expect(INSIGHTS_EMPTY).toContain("Nothing needs your attention yet.");
  });
  it("a store with no assistant is its own state with a way forward", () => {
    const out = html({ kind: "no-assistant" });
    expect(out).toContain('data-insights="no-assistant"');
    expect(out).toContain("/dashboard/commerce/assistant");
    expect(out).not.toContain("Nothing needs your attention");
  });
});

describe("the list", () => {
  it("draws the six chips with counts", () => {
    const out = html({ kind: "ready", data: data([item(), item({ key: "b", type: "product_demand" })]) });
    for (const label of ["Needs action", "Product demand", "Missing info", "Purchase concerns", "Support issues", "Top questions"]) expect(out).toContain(label);
    expect(out).toContain('data-chip-count="needs_action"');
    expect(out).toContain('aria-pressed="true"');
  });
  it("a card shows title, type pill, count and window, why, next step, See conversations and Dismiss", () => {
    const out = html({ kind: "ready", data: data([item()]) });
    expect(out).toContain('data-insight-key="delivery-times"');
    expect(out).toContain("Customers can&#x27;t get delivery times");
    expect(out).toContain("Missing store info");
    expect(out).toContain("Asked 14 times on 6 shopper-days, last 30 days");
    expect(out).toContain("Why it matters");
    expect(out).toContain("Shoppers ask when an order arrives.");
    expect(out).toContain("Next step");
    expect(out).toContain('href="/dashboard/commerce/knowledge"');
    expect(out).toContain("See conversations");
    expect(out).toContain('href="/dashboard/inbox?tab=conversations&amp;topic=delivery-times"');
    expect(out).toContain("Dismiss");
  });
  it("says how many conversations aged out only when some did", () => {
    expect(html({ kind: "ready", data: data([item({ evidence: { available: 3, expired: 5 } })]) })).toContain("5 conversations have aged out");
    expect(html({ kind: "ready", data: data([item()]) })).not.toContain("aged out");
  });
  it("an answer step answers inline with the knowledge base's own card", () => {
    const out = html({ kind: "ready", data: data([item({ nextStep: { label: "Answer once", kind: "answer", requestIds: ["r1"] } })]) });
    expect(out).not.toContain("Do you ship to Goa?");
    expect(out).toContain("Customers can&#x27;t get delivery times");
    expect(out).toContain("Write the answer your assistant should give");
  });
  it("a product step links into the Shopify admin only through the allow-list", () => {
    const good = html({ kind: "ready", data: data([item({ type: "product_demand", nextStep: { label: "Open the product", kind: "product", adminPath: "/products/7002" } })]) });
    expect(good).toContain('href="https://admin.shopify.com/store/table-story/products/7002"');
    expect(good).toContain('rel="noopener noreferrer"');
    const bad = html({ kind: "ready", data: data([item({ type: "product_demand", nextStep: { label: "Open the product", kind: "product", adminPath: "/orders/1" } })]) });
    expect(bad).not.toContain("admin.shopify.com");
    const noShop = html({ kind: "ready", data: data([item({ type: "product_demand", nextStep: { label: "Open the product", kind: "product", adminPath: "/products/1" } })]) }, "needs_action", null);
    expect(noShop).not.toContain("admin.shopify.com");
  });
  it("a conversations step is one button, not two to the same place", () => {
    const out = html({ kind: "ready", data: data([item({ nextStep: { label: "Look at them", kind: "conversations" } })]) });
    expect(out).toContain("Look at them");
    expect(out).not.toContain("See conversations");
    expect(out.match(/topic=delivery-times/g)).toHaveLength(1);
  });
  it("a read that has not been asked draws the heading and no body", () => {
    const out = html({ kind: "waiting" });
    expect(out).toContain(INSIGHTS_HEADING);
    expect(out).not.toContain('data-insights=');
  });
  it("closed items sit in a collapsed Recently fixed, not among the cards", () => {
    const out = html({ kind: "ready", data: data([item(), item({ key: "done", title: "Maroon sarees", status: "closed", closedNote: "Now in stock" })]) });
    expect(out).toContain("Recently fixed");
    expect(out).toContain('aria-expanded="false"');
    expect(out).not.toContain("Maroon sarees");
  });
  it("a chip with nothing in it says so, and is not the all-clear sentence", () => {
    const out = html({ kind: "ready", data: data([item()]) }, "top_question");
    expect(out).toContain('data-insights="chip-empty"');
    expect(out).toContain("Nothing here right now.");
    expect(out).not.toContain("Nothing needs your attention");
  });
});

describe("SA-16: a card says what happened, why, the impact and the next step", () => {
  const rich = (over: Partial<Insight> = {}) =>
    item({
      summary: "2 customers asked how long delivery takes to Delhi, and the assistant couldn't answer.",
      impact: { basis: "conversations", customers: 2, asks: 3, line: "2 customers" },
      cause: { kind: "missing_store_info", reason: "Nothing written in your store information answers this." },
      nextStep: { label: "Review shipping details", kind: "admin", adminPath: "/settings", where: "Open Settings, then Shipping and delivery." },
      secondStep: { label: "Answer it here", kind: "answer", requestIds: ["r1"] },
      conversations: { count: 2, linkable: true },
      priority: { blocked: true, top: true },
      ...over,
    });
  it("shows the four parts, the cause, where to click, and the second option", () => {
    const out = html({ kind: "ready", data: data([rich()]) });
    expect(out).toContain("2 customers asked how long delivery takes to Delhi");
    expect(out).toContain("2 customers, last 30 days");
    expect(out).toContain("Missing store info. Nothing written in your store information answers this.");
    expect(out).toContain('href="https://admin.shopify.com/store/table-story/settings"');
    expect(out).toContain("Open Settings, then Shipping and delivery.");
    expect(out).toContain("Or answer it here:");
    // the stored question is never printed: the card is headed with the insight's own title
    expect(out).not.toContain("Do you ship to Goa?");
    expect(out).toContain("Write the answer your assistant should give");
    expect(out).toContain("A shopper left after this");
    expect(out).toContain("See conversations");
  });
  it("Top priorities lead the default view and are drawn once", () => {
    const a = rich({ key: "a", title: "Alpha topic" });
    const b = item({ key: "b", title: "Beta topic" });
    const out = html({ kind: "ready", data: data([a, b], { topPriorities: ["a"] }) });
    expect(out).toContain("Top priorities");
    expect(out.indexOf("Alpha topic")).toBeLessThan(out.indexOf("Beta topic"));
    expect(out.match(/data-insight-key="a"/g)).toHaveLength(1);
    // another chip has no such group
    expect(html({ kind: "ready", data: data([a, b], { topPriorities: ["a"] }) }, "missing_info")).not.toContain("Top priorities");
  });
  it("a second step that reads the conversations is the one See conversations button, not words that go nowhere", () => {
    const out = html({ kind: "ready", data: data([rich({ secondStep: { label: "Read the conversations", kind: "conversations" } })]) });
    expect(out).not.toContain("Or: Read the conversations");
    expect(out.match(/See conversations/g)).toHaveLength(1);
  });
  it("a cause kind this page does not know is named plainly, never printed as undefined", () => {
    const out = html({ kind: "ready", data: data([rich({ cause: { kind: "policy_gap" as never, reason: "Something new." } })]) });
    expect(out).not.toContain("undefined");
    expect(out).toContain("Something new.");
  });
  it("an item with no conversation to open says why instead of linking to an empty list", () => {
    const out = html({ kind: "ready", data: data([rich({ conversations: { count: 0, linkable: false, reason: "This question was logged without its conversation, so there is nothing to open." } })]) });
    expect(out).not.toContain("See conversations");
    expect(out).toContain("logged without its conversation");
  });
  it("the assistant's mistakes are one quiet line, never a card", () => {
    const out = html({ kind: "ready", data: data([rich()], { assistantMistakes: { count: 2, line: "2 questions were our assistant's mistake. We're fixing these." } }) });
    expect(out).toContain("2 questions were our assistant&#x27;s mistake. We&#x27;re fixing these.");
    expect(out.match(/data-insight-key=/g)).toHaveLength(1);
    expect(html({ kind: "ready", data: data([rich()]) })).not.toContain("assistant-mistakes");
  });
  it("the 'new questions' line is a plain line with an answer box", () => {
    const out = html({ kind: "ready", data: data([item({ key: "new_questions", title: "3 new questions, sorted within a few hours", summary: "3 new questions, sorted within a few hours.", nextStep: { label: "Answer them here", kind: "answer", requestIds: ["r1"] }, conversations: { count: 0, linkable: false, reason: "This question was logged without its conversation, so there is nothing to open." } })]) });
    expect(out).toContain("3 new questions, sorted within a few hours");
    expect(out).toContain("Write the answer your assistant should give");
    expect(out).not.toContain("Do you ship to Goa?");
  });
  it("an older api that sends none of the new fields still draws the card as before", () => {
    const out = html({ kind: "ready", data: data([item()]) });
    expect(out).toContain("Asked 14 times on 6 shopper-days, last 30 days");
    expect(out).not.toContain("Top priorities");
    expect(out).toContain("See conversations");
  });
});

describe("the old Questions lane is gone", () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(/\s+/g, " ");
  const PAGE = read("../../app/(site)/dashboard/inbox/page.tsx");
  it("the inbox tabs are Conversations, Insights, Leads, Reviews, Ask your inbox, in that order", () => {
    const order = ["conversations", "insights", "leads", "reviews", "ask"].map((v) => PAGE.indexOf(`<TabsTrigger value="${v}"`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(PAGE).not.toContain('<TabsTrigger value="questions"');
    expect(PAGE).not.toContain("QuestionsPane");
  });
  it("the waiting badge is the Insights tab's and counts needsAction", () => {
    expect(PAGE).toMatch(/<TabsTrigger value="insights"> Insights \{waiting > 0/);
    expect(PAGE).toContain("insightsBadge(insights.data)");
  });
  it("choosing a lane by hand drops a topic filter, so Conversations starts from the whole list", () => {
    expect(PAGE).toContain('search.delete("topic")');
  });
  it("Commerce no longer lists What shoppers asked for", () => {
    const LAYOUT = read("../../app/(site)/dashboard/layout.tsx");
    expect(LAYOUT).not.toContain("What shoppers asked for");
    expect(LAYOUT).not.toContain("/dashboard/commerce/demand");
    expect(LAYOUT).toContain("/dashboard/commerce/knowledge");
  });
});
