import { describe, it, expect } from "vitest";
import {
  INSIGHT_FILTERS,
  actionFor,
  chipCount,
  closedItems,
  conversationsHref,
  countLine,
  expiredNote,
  insightFilterFromParam,
  insightFilterFromSearch,
  insightsBadge,
  insightsHref,
  insightsState,
  itemsForFilter,
  searchWithTopic,
  shopOf,
  stateOfError,
  topicFromParam,
  type Insight,
  type InsightsResponse,
} from "./insights";

const item = (over: Partial<Insight> = {}): Insight => ({
  key: "delivery-times",
  type: "missing_store_info",
  title: "Customers can't get delivery times",
  count: 14,
  shopperDays: 6,
  trend: "up",
  why: "Shoppers ask when an order arrives and the assistant has no answer.",
  nextStep: { label: "Add shipping details", kind: "knowledge" },
  status: "open",
  evidence: { available: 9, expired: 5 },
  surfaces: ["storefront"],
  lastAskedAt: "2026-11-05T09:00:00.000Z",
  ...over,
});
const response = (items: Insight[], over: Partial<InsightsResponse> = {}): InsightsResponse => ({
  windowDays: 30,
  since: "2026-10-07T00:00:00.000Z",
  needsAction: items.filter((i) => i.status === "open").length,
  counts: { product_demand: 0, missing_product_info: 0, missing_store_info: 0, purchase_concern: 0, support_issue: 0, top_question: 0 },
  quietCount: 0,
  items,
  ...over,
});

describe("insightFilterFromParam / insightFilterFromSearch", () => {
  it("reads each chip by name and the api's own type names", () => {
    expect(insightFilterFromParam("product_demand")).toBe("product_demand");
    expect(insightFilterFromParam("missing_info")).toBe("missing_info");
    expect(insightFilterFromParam("missing_product_info")).toBe("missing_info");
    expect(insightFilterFromParam("missing_store_info")).toBe("missing_info");
    expect(insightFilterFromParam("support_issue")).toBe("support_issue");
  });
  it("anything else is Needs action, never an error", () => {
    for (const v of [null, undefined, "", "nonsense", "needs_action", "__proto__"]) expect(insightFilterFromParam(v)).toBe("needs_action");
  });
  it("the old ?tab=questions with no type lands on missing info; an explicit type wins", () => {
    expect(insightFilterFromSearch("questions", null)).toBe("missing_info");
    expect(insightFilterFromSearch("questions", "support_issue")).toBe("support_issue");
    expect(insightFilterFromSearch("insights", null)).toBe("needs_action");
  });
  it("has the six chips in the briefed order", () => {
    expect(INSIGHT_FILTERS.map((f) => f.label)).toEqual(["Needs action", "Product demand", "Missing info", "Purchase concerns", "Support issues", "Top questions"]);
  });
});

describe("filtering and counts", () => {
  const items = [
    item({ key: "a", type: "product_demand" }),
    item({ key: "b", type: "missing_product_info" }),
    item({ key: "c", type: "missing_store_info" }),
    item({ key: "d", type: "purchase_concern" }),
    item({ key: "e", type: "support_issue" }),
    item({ key: "f", type: "top_question" }),
    item({ key: "g", type: "product_demand", status: "closed", closedNote: "Now in stock" }),
    item({ key: "h", type: "missing_store_info", status: "dismissed" }),
  ];
  it("Needs action is the actionable types, open only", () => {
    expect(itemsForFilter(items, "needs_action").map((i) => i.key)).toEqual(["a", "b", "c"]);
  });
  it("Missing info joins product and store info", () => {
    expect(itemsForFilter(items, "missing_info").map((i) => i.key)).toEqual(["b", "c"]);
  });
  it("closed and dismissed items are in no chip; closed ones are Recently fixed", () => {
    for (const f of INSIGHT_FILTERS) expect(itemsForFilter(items, f.value).map((i) => i.key)).not.toContain("g");
    expect(closedItems(items).map((i) => i.key)).toEqual(["g"]);
  });
  it("Needs action shows the api's needsAction; other chips count what they show", () => {
    expect(chipCount({ items, needsAction: 7 }, "needs_action")).toBe(7);
    expect(chipCount({ items, needsAction: 7 }, "missing_info")).toBe(2);
    expect(chipCount({ items, needsAction: 7 }, "top_question")).toBe(1);
  });
  it("the tab badge is needsAction, and nothing at zero or while unknown", () => {
    expect(insightsBadge(response(items, { needsAction: 4 }))).toBe(4);
    expect(insightsBadge(response(items, { needsAction: 0 }))).toBe(0);
    expect(insightsBadge(undefined)).toBe(0);
    expect(insightsBadge({ nonsense: true })).toBe(0);
  });
});

describe("actionFor: the primary action by nextStep.kind", () => {
  const shop = "table-story.myshopify.com";
  it("answer carries the request ids; with none it is no button", () => {
    expect(actionFor(item({ nextStep: { label: "Answer", kind: "answer", requestIds: ["r1", "r2"] } }), shop)).toEqual({ kind: "answer", label: "Answer", requestIds: ["r1", "r2"] });
    expect(actionFor(item({ nextStep: { label: "Answer", kind: "answer", requestIds: [] } }), shop)).toEqual({ kind: "none" });
    expect(actionFor(item({ nextStep: { label: "Answer", kind: "answer" } }), shop)).toEqual({ kind: "none" });
  });
  it("knowledge goes to the Knowledge base", () => {
    expect(actionFor(item(), shop)).toEqual({ kind: "link", label: "Add shipping details", href: "/dashboard/commerce/knowledge", external: false });
  });
  it("product kinds use the admin allow-list and the store's own handle", () => {
    const a = actionFor(item({ nextStep: { label: "Open the product", kind: "product", adminPath: "/products/7002" } }), shop);
    expect(a).toEqual({ kind: "link", label: "Open the product", href: "https://admin.shopify.com/store/table-story/products/7002", external: true });
    expect(actionFor(item({ nextStep: { label: "Add it", kind: "add_product", adminPath: "/products/new" } }), shop)).toMatchObject({ kind: "link", external: true });
    expect(actionFor(item({ nextStep: { label: "See", kind: "products", adminPath: "/products" } }), shop)).toMatchObject({ kind: "link", external: true });
  });
  it("a path outside the allow-list, or no known store, is no link", () => {
    for (const adminPath of ["/orders/1", "https://evil.example/products", "/products/12/../../x", "javascript:alert(1)", undefined]) {
      expect(actionFor(item({ nextStep: { label: "x", kind: "product", adminPath } }), shop)).toEqual({ kind: "none" });
    }
    expect(actionFor(item({ nextStep: { label: "x", kind: "product", adminPath: "/products/1" } }), null)).toEqual({ kind: "none" });
    expect(actionFor(item({ nextStep: { label: "x", kind: "product", adminPath: "/products/1" } }), "evil.example.com")).toEqual({ kind: "none" });
  });
  it("conversations opens the topic filter; none is nothing", () => {
    expect(actionFor(item({ key: "k1", nextStep: { label: "Look", kind: "conversations" } }), shop)).toEqual({ kind: "conversations", label: "Look", href: "/dashboard/inbox?tab=conversations&topic=k1" });
    expect(actionFor(item({ nextStep: { label: "x", kind: "none" } }), shop)).toEqual({ kind: "none" });
  });
});

describe("the topic filter", () => {
  it("reads a plausible key and refuses the rest", () => {
    expect(topicFromParam("delivery-times")).toBe("delivery-times");
    expect(topicFromParam("a:b.c_d")).toBe("a:b.c_d");
    for (const v of [null, "", "  ", "a".repeat(201), "a" + String.fromCharCode(0) + "b", "a" + String.fromCharCode(10) + "b"]) expect(topicFromParam(v)).toBeNull();
  });
  it("a key with a slash, a space or an accent still filters (the api's key is only sent back to it)", () => {
    for (const v of ["shoes/size 9", "café", "a&b=1"]) expect(topicFromParam(v)).toBe(v);
    expect(topicFromParam("a".repeat(200))).toBe("a".repeat(200));
    // verbatim: the api matches the key exactly
    expect(topicFromParam(" x ")).toBe(" x ");
  });
  it("conversationsHref and searchWithTopic round-trip and keep the other keys", () => {
    expect(conversationsHref("delivery-times")).toBe("/dashboard/inbox?tab=conversations&topic=delivery-times");
    expect(searchWithTopic("tab=conversations&topic=x&assignee=mine", null)).toBe("tab=conversations&assignee=mine");
    expect(searchWithTopic("tab=conversations", "y")).toBe("tab=conversations&topic=y");
  });
  it("says how many conversations aged out, and nothing when none did", () => {
    expect(expiredNote(0)).toBeNull();
    expect(expiredNote(-1)).toBeNull();
    expect(expiredNote(1)).toBe("1 conversation has aged out and is no longer kept.");
    expect(expiredNote(5)).toBe("5 conversations have aged out and are no longer kept.");
  });
});

describe("addresses and lines", () => {
  it("insightsHref leaves the default chip out", () => {
    expect(insightsHref()).toBe("/dashboard/inbox?tab=insights");
    expect(insightsHref("missing_info")).toBe("/dashboard/inbox?tab=insights&type=missing_info");
  });
  it("countLine names asks and shopper-days", () => {
    expect(countLine({ count: 14, shopperDays: 6 }, 30)).toBe("Asked 14 times on 6 shopper-days, last 30 days");
    expect(countLine({ count: 1, shopperDays: 1 }, 7)).toBe("Asked once on 1 shopper-day, last 7 days");
  });
  it("shopOf prefers the primary Shopify store and ignores other platforms", () => {
    expect(
      shopOf([
        { platform: "woocommerce", shopDomain: "w.example.com", primary: true },
        { platform: "shopify", shopDomain: "a.myshopify.com", primary: false },
        { platform: "shopify", shopDomain: "b.myshopify.com", primary: true },
      ]),
    ).toBe("b.myshopify.com");
    expect(shopOf([{ platform: "woocommerce", shopDomain: "w.example.com", primary: true }])).toBeNull();
    expect(shopOf(undefined)).toBeNull();
  });
});

describe("insightsState: a failed read is never an empty list", () => {
  const ok = response([item()]);
  it("pending is loading", () => {
    expect(insightsState({ isPending: true, isError: false, error: null, data: undefined })).toEqual({ kind: "loading" });
  });
  it("a disabled query (nothing asked) waits instead of spinning, and an offline one claims nothing", () => {
    expect(insightsState({ isPending: true, isError: false, error: null, data: undefined, fetchStatus: "idle" })).toEqual({ kind: "waiting" });
    expect(insightsState({ isPending: true, isError: false, error: null, data: undefined, fetchStatus: "paused" })).toEqual({ kind: "error" });
    expect(insightsState({ isPending: true, isError: false, error: null, data: undefined, fetchStatus: "fetching" })).toEqual({ kind: "loading" });
  });
  it("a 404 or any error with nothing to show is an error", () => {
    expect(insightsState({ isPending: false, isError: true, error: { status: 404 }, data: undefined })).toEqual({ kind: "error" });
    expect(insightsState({ isPending: false, isError: true, error: new Error("boom"), data: undefined })).toEqual({ kind: "error" });
    expect(stateOfError({ status: 500, code: "NO_ASSISTANT" })).toEqual({ kind: "error" });
  });
  it("a named no-assistant 404 is its own state", () => {
    expect(stateOfError({ status: 404, code: "NO_ASSISTANT" })).toEqual({ kind: "no-assistant" });
    expect(stateOfError({ status: 404, code: "NO_STORE" })).toEqual({ kind: "no-assistant" });
  });
  it("an answer that is not the contract's shape is an error, not empty", () => {
    for (const data of [{}, { items: "x" }, null, [], { windowDays: 30, items: [] }]) expect(insightsState({ isPending: false, isError: false, error: null, data })).toEqual({ kind: "error" });
  });
  it("items: [] is empty; items is ready", () => {
    expect(insightsState({ isPending: false, isError: false, error: null, data: response([]) }).kind).toBe("empty");
    expect(insightsState({ isPending: false, isError: false, error: null, data: ok }).kind).toBe("ready");
  });
  it("a failed refresh keeps the rows it already has", () => {
    expect(insightsState({ isPending: false, isError: true, error: new Error("x"), data: ok }).kind).toBe("ready");
  });
});
