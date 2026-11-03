import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CustomerPanelData } from "@/lib/inbox-customer";

// Markup only: the hooks are replaced, so nothing here reaches the api, the router or the auth provider.
const h = vi.hoisted(() => ({
  panel: { isLoading: false, isError: false, data: undefined as unknown, refetch: () => {} },
  refresh: { isPending: false, mutate: () => {} },
}));
vi.mock("@/hooks/use-wa-conversations", () => ({
  useCustomerPanel: () => h.panel,
  useRefreshSummary: () => h.refresh,
}));

const { CustomerPanel } = await import("./customer-panel");

const base = (over: Partial<CustomerPanelData> = {}): CustomerPanelData => ({
  channel: "whatsapp",
  anonymous: false,
  contact: { name: "Asha Rao", phone: "••••4321", locale: "hi", firstSeenAt: "2026-01-02T12:00:00Z", conversationCount: 1 },
  summary: { text: "Wants a size exchange.", sentiment: "negative", topics: ["exchange"], updatedAt: "2026-11-01T00:00:00Z" },
  orders: {
    state: "ok",
    items: [
      {
        orderId: "9001",
        name: "#1001",
        createdAt: "2019-03-01T10:00:00Z",
        financialStatus: "PAID",
        fulfillmentStatus: "FULFILLED",
        total: { amount: "1499.00", currency: "INR" },
        tracking: [{ company: "Delhivery", number: "DL1", url: "https://track.example/DL1" }],
        cod: { isCod: true, state: "confirmed" },
      },
    ],
    nextCursor: "CUR1",
    lifetime: { orderCount: 7, amountSpent: { amount: "5400.00", currency: "INR" } },
    windowLimited: false,
  },
  prices: { customerSummary: 10 },
  ...over,
});
const html = (role: string | null = "editor") => renderToStaticMarkup(<CustomerPanel threadId="whatsapp:1:a" role={role} />);

beforeEach(() => {
  h.panel = { isLoading: false, isError: false, data: base(), refetch: () => {} };
  h.refresh = { isPending: false, mutate: () => {} };
});

describe("the customer panel", () => {
  it("shows who they are, with the number masked, and what they want", () => {
    const m = html();
    expect(m).toContain("Asha Rao");
    expect(m).toContain("••••4321");
    expect(m).toContain("hi");
    expect(m).toContain("Wants a size exchange.");
    expect(m).toContain("Unhappy lately");
    expect(m).toContain("Topics: exchange");
    expect(m).not.toContain("919800004321");
  });
  it("lists the orders with date, total, status, the cash-on-delivery outcome and the tracking link, newest first as the api sends them", () => {
    const m = html();
    expect(m).toContain("#1001");
    expect(m).toContain("1 Mar 2019");
    expect(m).toContain("1,499.00");
    expect(m).toContain("Paid · Fulfilled");
    expect(m).toContain("Cash on delivery · customer confirmed");
    expect(m).toContain('href="https://track.example/DL1"');
    expect(m).toContain('rel="noreferrer noopener"');
    expect(m).toContain("7 orders");
    expect(m).toContain("Show older orders");
  });
  it("no older page, no 'Show older orders'", () => {
    h.panel.data = base({ orders: { ...base().orders!, nextCursor: null } });
    expect(html()).not.toContain("Show older orders");
  });
  it("the Refresh summary button carries its price before it is pressed, and says it only runs when pressed", () => {
    const m = html();
    expect(m).toContain("Refresh summary · 10 AI credits");
    expect(m).toContain("Only runs when you press it.");
  });
  it("no price row: the button is off and says why", () => {
    h.panel.data = base({ prices: { customerSummary: null } });
    const m = html();
    expect(m).toMatch(/<button[^>]*disabled[^>]*>Refresh summary<\/button>/);
    expect(m).toContain("Refreshing the summary isn&#x27;t available right now.");
  });
  it("a viewer sees no Refresh summary button (it is an editor's act)", () => {
    expect(html("viewer")).not.toContain("Refresh summary");
  });
  it("a viewer's panel has no name and no number, and says contact details are hidden", () => {
    h.panel.data = base({ contact: { locale: "hi", firstSeenAt: null, conversationCount: 1 } });
    const m = html("viewer");
    expect(m).toContain("Contact details are hidden for your role.");
    expect(m).not.toContain("Asha");
    expect(m).not.toContain("4321");
    expect(m).toContain("#1001"); // the history is still there
  });
  it("an anonymous storefront visitor gets the sentence and nothing else", () => {
    h.panel.data = { channel: "storefront", anonymous: true, message: "Storefront visitor — no customer details", prices: { customerSummary: null } };
    const m = html();
    expect(m).toContain("Storefront visitor — no customer details");
    expect(m).not.toContain("Orders");
    expect(m).not.toContain("Refresh summary");
  });
  it("each orders state says what it is; none reads as 'no orders'", () => {
    for (const [state, text] of [
      ["no_customer", "No matching customer was found in your store"],
      ["no_store", "Connect your Shopify store"],
      ["unavailable", "Orders could not be loaded just now"],
    ] as const) {
      h.panel.data = base({ orders: { state, items: [], nextCursor: null, lifetime: null, windowLimited: false } });
      const m = html();
      expect(m, state).toContain(text);
      expect(m, state).not.toContain("No orders yet");
    }
  });
  it("a customer with no orders says so only when the orders loaded", () => {
    h.panel.data = base({ orders: { state: "ok", items: [], nextCursor: null, lifetime: null, windowLimited: false } });
    expect(html()).toContain("No orders yet for this customer.");
  });
  it("says when the store has not approved full order history, as that store's limit", () => {
    h.panel.data = base({ orders: { ...base().orders!, windowLimited: true } });
    expect(html()).toContain("This store hasn’t approved full order history yet, so Shopify only shares the last 60 days of orders.");
    h.panel.data = base();
    expect(html()).not.toContain("only shares the last 60 days");
  });
  it("a failed load says it failed and offers a retry (never an empty panel)", () => {
    h.panel = { isLoading: false, isError: true, data: undefined, refetch: () => {} };
    const m = html();
    expect(m).toContain("Couldn&#x27;t load the customer details");
    expect(m).toContain("Try again");
  });
  it("while it loads it shows placeholders, not a claim", () => {
    h.panel = { isLoading: true, isError: false, data: undefined, refetch: () => {} };
    const m = html();
    expect(m).not.toContain("No orders");
    expect(m).not.toContain("Customer");
  });
});
