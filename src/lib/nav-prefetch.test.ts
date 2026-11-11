import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const get = vi.fn(async () => ({ rows: [] }));
vi.mock("@/lib/api", () => ({ api: { get: (...a: unknown[]) => get(...(a as [])) }, ApiError: class extends Error {} }));

import {
  createIntentScheduler,
  INTENT_DELAY_MS,
  INTENT_QUERIES,
  prefetchDestinationData,
  shouldSkipPrefetch,
} from "./nav-prefetch";
import { jobsListQuery } from "@/hooks/use-jobs";
import { storefrontChatsOptions, waConversationsOptions } from "@/lib/inbox-list-queries";
import { INBOX_FIRST_VIEW, inboxViewFromParams } from "./nav-prefetch";
import { readFileSync } from "node:fs";
import path from "node:path";
import { conversationsHref, insightsHref } from "./insights";
import { INBOX_REVIEWS_HREF } from "./review-summary";
import { deskViewFromParams } from "./desk-list-params";
import { deskKeys } from "@/hooks/use-inbox-desk";
import { deskTagsQuery } from "./nav-queries";
import { removeScopedQueries } from "./auth-session";

const ctx = { orgId: "o1", businessId: "b1", isAuthenticated: true };
const none = new URLSearchParams();

beforeEach(() => {
  vi.useFakeTimers();
  get.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("createIntentScheduler", () => {
  it("fires once after the delay, however often the pointer re-enters", () => {
    const run = vi.fn();
    const s = createIntentScheduler(run, () => false);
    s.schedule("/dashboard/inbox");
    vi.advanceTimersByTime(INTENT_DELAY_MS - 10);
    s.schedule("/dashboard/inbox");
    vi.advanceTimersByTime(INTENT_DELAY_MS - 10);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("/dashboard/inbox");
  });

  it("a pointer sweeping past fetches nothing", () => {
    const run = vi.fn();
    const s = createIntentScheduler(run, () => false);
    s.schedule("/dashboard/content");
    s.cancel("/dashboard/content");
    vi.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
  });

  it("is skipped on saveData", () => {
    const run = vi.fn();
    const s = createIntentScheduler(run, () => shouldSkipPrefetch({ saveData: true }));
    s.schedule("/dashboard/tasks");
    vi.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("shouldSkipPrefetch", () => {
  it.each([
    [{ saveData: true }, true],
    [{ effectiveType: "2g" }, true],
    [{ effectiveType: "slow-2g" }, true],
    [{ effectiveType: "3g" }, false],
    [{ effectiveType: "4g", saveData: false }, false],
    [undefined, false],
  ])("%j -> %s", (conn, expected) => {
    // an explicit undefined must not fall back to the real navigator
    expect(shouldSkipPrefetch(conn ?? {})).toBe(expected);
  });
});

describe("prefetchDestinationData", () => {
  it("warms the page's key, and a second call inside staleTime does not refetch", async () => {
    const qc = new QueryClient();
    prefetchDestinationData(qc, "/dashboard/tasks", ctx);
    await vi.waitFor(() => expect(qc.getQueryData(jobsListQuery("recent").queryKey)).toBeDefined());
    prefetchDestinationData(qc, "/dashboard/tasks", ctx);
    prefetchDestinationData(qc, "/dashboard/tasks", ctx);
    await Promise.resolve();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("Inbox warms the Conversations lane (both paged lists, tags, insights) under the keys the pane reads", async () => {
    // the app's own default (providers/query-provider.tsx): the paged lists set no staleTime of their own
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
    prefetchDestinationData(qc, "/dashboard/inbox", ctx);
    const wa = waConversationsOptions("b1", INBOX_FIRST_VIEW).queryKey;
    const sf = storefrontChatsOptions("b1", INBOX_FIRST_VIEW).queryKey;
    await vi.waitFor(() => {
      expect(qc.getQueryData(wa)).toBeDefined();
      expect(qc.getQueryData(sf)).toBeDefined();
      expect(qc.getQueryData(["inbox-desk", "tags", "b1"])).toBeDefined();
      expect(qc.getQueryData(["insights", "o1", "b1", 30])).toBeDefined();
      expect(qc.getQueryData(["inbox-reviews"])).toBeDefined();
    });
    // the first render of the pane is a cache hit, not a request
    const calls = get.mock.calls.length;
    prefetchDestinationData(qc, "/dashboard/inbox", ctx);
    await Promise.resolve();
    expect(get.mock.calls.length).toBe(calls);
    // the keys are the ones the pane builds from its default state
    expect(wa).toEqual(["wa-conversations", "b1", "all", "open", "", "all", "", "", "all"]);
    expect(sf).toEqual(["storefront-chats", "b1", "all", "open", "all", "", "", "all"]);
  });

  it("the prefetched tag key is the key the desk invalidates", () => {
    expect(deskTagsQuery("b1").queryKey).toEqual(deskKeys.tags("b1"));
  });

  it("Inbox without a business warms only what needs none", () => {
    const keys = INTENT_QUERIES["/dashboard/inbox"]({ ...ctx, businessId: undefined, orgId: undefined }, none).map((q) => q.queryKey);
    expect(keys).toEqual([["inbox-reviews"]]);
  });

  it("a scope switch clears what a prefetch put in the cache", async () => {
    const qc = new QueryClient();
    prefetchDestinationData(qc, "/dashboard/inbox", ctx);
    await vi.waitFor(() => expect(qc.getQueryData(["inbox-reviews"])).toBeDefined());
    removeScopedQueries(qc);
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
  });

  it("does nothing signed out, or for a link with no registered query", () => {
    const qc = new QueryClient();
    prefetchDestinationData(qc, "/dashboard/tasks", { ...ctx, isAuthenticated: false });
    prefetchDestinationData(qc, "/dashboard/settings", ctx);
    expect(get).not.toHaveBeenCalled();
  });

  it("business-scoped destinations wait for a business", () => {
    expect(INTENT_QUERIES["/dashboard/growth"]({ ...ctx, businessId: undefined }, none)).toEqual([]);
    expect(INTENT_QUERIES["/dashboard/commerce"]({ ...ctx, businessId: undefined }, none)).toEqual([]);
  });

  it("registers the seven data destinations (Home is route-only)", () => {
    expect(Object.keys(INTENT_QUERIES).sort()).toMatchInlineSnapshot(`
      [
        "/dashboard/commerce",
        "/dashboard/content",
        "/dashboard/growth",
        "/dashboard/inbox",
        "/dashboard/integrations",
        "/dashboard/strategist",
        "/dashboard/tasks",
      ]
    `);
  });
});

// ── a link that carries a filter or a lane ────────────────────────────────────────────────────────────────────────────

/** What ConversationsPane passes useWaConversations / useStorefrontChats on its first render for an address (status and expiring are its own state, at their defaults). */
function paneView(search: string) {
  const { assignee, tag, priority, topic } = deskViewFromParams(new URLSearchParams(search));
  return { expiringOnly: false, status: "open" as const, assignee, tag, priority, topic };
}
const keysOf = (href: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  const wanted: unknown[][] = [];
  const spy = vi.spyOn(qc, "prefetchInfiniteQuery").mockImplementation(((o: { queryKey: unknown[] }) => (wanted.push(o.queryKey), Promise.resolve())) as never);
  const spy2 = vi.spyOn(qc, "prefetchQuery").mockImplementation(((o: { queryKey: unknown[] }) => (wanted.push(o.queryKey), Promise.resolve())) as never);
  prefetchDestinationData(qc, href, ctx);
  spy.mockRestore();
  spy2.mockRestore();
  return wanted;
};

describe("a filtered Inbox link warms the view the page builds for that address", () => {
  // every in-app Inbox link that carries a query string, built by the same helpers the components use (plus the Shopify app's own)
  const FILTERED = [
    ["Insights card: See conversations", conversationsHref("delivery-times")],
    ["Insights card: a topic key with a slash and a space", conversationsHref("shoes/size 9")],
    ["a desk filter in the address", "/dashboard/inbox?tab=conversations&assignee=mine&tag=t_1&priority=high"],
    ["a topic and a desk filter", "/dashboard/inbox?assignee=unassigned&topic=sizing#x"],
  ] as const;

  it.each(FILTERED)("%s: the lists are warmed under the pane's keys", (_name, href) => {
    const search = href.split("#")[0]!.split("?")[1]!;
    const view = paneView(search);
    const keys = keysOf(href);
    expect(keys).toContainEqual(waConversationsOptions("b1", view).queryKey);
    expect(keys).toContainEqual(storefrontChatsOptions("b1", view).queryKey);
    expect(keys).toContainEqual(["inbox-desk", "tags", "b1"]);
    // and a filtered view is not the unfiltered one (else this test proves nothing)
    expect(keys).not.toContainEqual(waConversationsOptions("b1", INBOX_FIRST_VIEW).queryKey);
  });

  it("a topic reaches the key and the request, verbatim", async () => {
    const view = inboxViewFromParams(new URLSearchParams(conversationsHref("shoes/size 9").split("?")[1]));
    expect(view.topic).toBe("shoes/size 9");
    const qc = new QueryClient();
    prefetchDestinationData(qc, conversationsHref("shoes/size 9"), ctx);
    await vi.waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls.some((c) => JSON.stringify(c).includes('"topic":"shoes/size 9"'))).toBe(true);
  });

  it.each([
    ["Insights", insightsHref()],
    ["Insights on a chip", insightsHref("missing_info")],
    ["the Shopify app's link", "/dashboard/inbox?tab=insights&type=product_demand"],
    ["the old Questions lane", "/dashboard/inbox?tab=questions"],
    ["Reviews", INBOX_REVIEWS_HREF],
    ["Leads", "/dashboard/inbox?tab=leads"],
  ])("%s: only the tab badges the page always reads, never the Conversations lists", (_name, href) => {
    const keys = keysOf(href);
    expect(keys).toEqual([["inbox-reviews"], ["insights", "o1", "b1", 30]]);
  });

  it("the bare link and `?tab=conversations` warm the same first view", () => {
    expect(keysOf("/dashboard/inbox?tab=conversations")).toEqual(keysOf("/dashboard/inbox"));
    expect(keysOf("/dashboard/inbox")).toContainEqual(waConversationsOptions("b1", INBOX_FIRST_VIEW).queryKey);
  });

  it("an unknown or malformed value is the default, as on the page", () => {
    expect(keysOf("/dashboard/inbox?assignee=everyone&priority=low&tag=a%20b")).toEqual(keysOf("/dashboard/inbox"));
  });

  it("another destination with a query string still resolves by its path", () => {
    expect(keysOf("/dashboard/tasks?x=1")).toEqual([jobsListQuery("recent").queryKey]);
  });
});

describe("one parser, and the filtered links use it", () => {
  const SRC = path.resolve(__dirname, "..");
  const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

  it("the pane reads the address with deskViewFromParams, not its own copy", () => {
    const pane = read("components/inbox/conversations-pane.tsx");
    expect(pane).toContain("deskViewFromParams(params)");
    expect(pane).not.toContain('params.get("topic")');
    expect(pane).not.toContain('params.get("assignee")');
  });

  it.each([
    "components/inbox/insights-pane.tsx",
    "components/commerce/knowledge-base.tsx",
    "components/presence/review-places-card.tsx",
  ])("%s spreads the intent handlers on its Inbox links", (rel) => {
    const src = read(rel);
    expect(src).toContain("useNavIntent()");
    expect(src).toContain("{...intent(");
  });
});
