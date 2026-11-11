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
import { INBOX_FIRST_VIEW } from "./nav-prefetch";
import { deskKeys } from "@/hooks/use-inbox-desk";
import { deskTagsQuery } from "./nav-queries";
import { removeScopedQueries } from "./auth-session";

const ctx = { orgId: "o1", businessId: "b1", isAuthenticated: true };

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
    const keys = INTENT_QUERIES["/dashboard/inbox"]({ ...ctx, businessId: undefined, orgId: undefined }).map((q) => q.queryKey);
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
    expect(INTENT_QUERIES["/dashboard/growth"]({ ...ctx, businessId: undefined })).toEqual([]);
    expect(INTENT_QUERIES["/dashboard/commerce"]({ ...ctx, businessId: undefined })).toEqual([]);
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
