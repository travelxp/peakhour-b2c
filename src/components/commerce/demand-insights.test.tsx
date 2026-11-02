import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DemandInsights, DemandItem, DemandState } from "@/lib/demand-insights";

// The view is pure; the hook module is replaced so nothing here reaches the api or the auth provider.
vi.mock("@/hooks/use-demand-insights", () => ({ useDemandInsights: () => ({}) }));

const { DemandInsightsView } = await import("./demand-insights");

const html = (state: DemandState) => renderToStaticMarkup(<DemandInsightsView state={state} />);

const item = (over: Partial<DemandItem> = {}): DemandItem => ({
  key: "k1",
  label: "Maroon kanjivaram saree under Rs 8,000",
  timesAsked: 14,
  previous: 10,
  trend: "up",
  trendPct: 40,
  failedKind: "facet",
  failed: "no maroon variant in stock",
  action: { kind: "add_variant", text: "Add or restock a maroon option" },
  surfaces: ["storefront", "whatsapp"],
  lastAskedAt: "2026-10-29T09:00:00.000Z",
  status: "open",
  target: { kind: "product", adminPath: "/products/7002", label: "Open the product", productTitle: "Green Saree" },
  ...over,
});
const data = (items: DemandItem[], over: Partial<DemandInsights> = {}): DemandState => ({
  kind: "ready",
  data: { windowDays: 30, since: "2026-10-01T00:00:00.000Z", totalAsks: 14, items, shop: "table-story.myshopify.com", ...over },
});

describe("the five states are five different sentences", () => {
  it("loading is a skeleton, with no claim", () => {
    const out = html({ kind: "loading" });
    expect(out).not.toContain("No unmet requests");
    expect(out).not.toContain("could not be loaded");
  });

  it("★a failed read says it could not load and never 'no unmet requests'", () => {
    const out = html({ kind: "error" });
    expect(out).toContain('data-demand="error"');
    expect(out).toContain("could not be loaded");
    expect(out).not.toContain("No unmet requests");
  });

  it("no connected store has its own state and points at Channels", () => {
    const out = html({ kind: "no-store" });
    expect(out).toContain('data-demand="no-store"');
    expect(out).toContain("No Shopify store connected");
    expect(out).toContain('href="/dashboard/commerce/channels"');
    expect(out).not.toContain("could not be loaded");
  });

  it("an empty answer is honest good news", () => {
    const out = html(data([], { totalAsks: 0 }));
    expect(out).toContain('data-demand="empty"');
    expect(out).toContain("No unmet requests yet.");
    expect(out).not.toContain("data-demand-item");
  });

  it("PASS: a list shows each request with count, trend, why, suggestion, where, and the store it is for", () => {
    const out = html(data([item()]));
    expect(out).toContain('data-demand="list"');
    expect(out).toContain("Maroon kanjivaram saree under Rs 8,000");
    expect(out).toContain("Asked 14 times");
    expect(out).toContain("Up 40% on the month before");
    expect(out).toContain("Why it missed: no maroon variant in stock");
    expect(out).toContain("Suggested: Add or restock a maroon option");
    expect(out).toContain("Storefront chat, WhatsApp");
    expect(out).toContain("14 requests in all");
    expect(out).toContain("for table-story.myshopify.com");
  });
});

describe("one-tap actions", () => {
  it("an open row links its target to the Shopify admin in a new tab", () => {
    const out = html(data([item()]));
    expect(out).toContain('href="https://admin.shopify.com/store/table-story/products/7002"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain("Open the product: Green Saree");
  });

  it("★a target path that is not an admin products path draws no link, but the suggestion stays", () => {
    for (const bad of ["https://evil.example/x", "javascript:alert(1)", "/products/1/../x"]) {
      const out = html(data([item({ target: { kind: "products", adminPath: bad, label: "Open your products" } })]));
      expect(out).not.toContain("<a ");
      expect(out).not.toContain("evil.example");
      expect(out).not.toContain("javascript:");
      expect(out).toContain("Suggested: Add or restock a maroon option");
    }
  });

  it("★no store domain from the api means no link at all (never a guessed host)", () => {
    const out = html(data([item()], { shop: undefined }));
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("admin.shopify.com");
  });

  it("★a hostile store domain draws no link", () => {
    const out = html(data([item()], { shop: "evil.example" }));
    expect(out).not.toContain("<a ");
  });
});

describe("gap closed", () => {
  const closed = item({ status: "closed", closedBy: { title: "Maroon Saree", adminPath: "/products/8001", asksSince: 3 } });

  it("says what is now in stock, links it, counts asks since, and drops 'why it missed'", () => {
    const out = html(data([closed]));
    expect(out).toContain('data-demand-status="closed"');
    expect(out).toContain("Gap closed");
    expect(out).toContain("Now in stock: ");
    expect(out).toContain('href="https://admin.shopify.com/store/table-story/products/8001"');
    expect(out).toContain("Maroon Saree");
    expect(out).toContain("Asked 3 times since it was last updated.");
    expect(out).not.toContain("Why it missed");
    expect(out).not.toContain("Suggested:");
  });

  it("with no product id or day it still says it is in stock, without a link or a count", () => {
    const out = html(data([item({ status: "closed", closedBy: { title: "Maroon Saree", adminPath: null, asksSince: null } })]));
    expect(out).toContain("Now in stock: ");
    expect(out).toContain("Maroon Saree");
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("since it was last updated");
  });

  it("★a title is escaped as text", () => {
    const out = html(data([item({ status: "closed", closedBy: { title: "<img src=x onerror=a()>", adminPath: null, asksSince: null } })]));
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });

  it("an open and a closed row are marked differently", () => {
    const out = html(data([item({ key: "o" }), { ...closed, key: "c" }]));
    expect(out).toContain('data-demand-item="o" data-demand-status="open"');
    expect(out).toContain('data-demand-item="c" data-demand-status="closed"');
  });
});
