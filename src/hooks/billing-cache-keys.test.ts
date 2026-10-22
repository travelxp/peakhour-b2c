import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/v1/dashboard/org`, `/v1/billing/summary` (api#1510) and `/v1/billing/orders`
 * (api#1553, mongodb migration 406) answer for the signed-in BUSINESS, so
 * their caches are keyed by business (P4.3b): the key
 * names whose answer an entry is (`switchBusiness` also clears the cache).
 *
 * The hooks call `useQuery` with the options under test, so `useQuery` is
 * replaced by a recorder and `useAuth` by a fixed session.
 */

type QueryOptions = { queryKey: readonly unknown[]; enabled?: boolean };
const recorded: QueryOptions[] = [];
const session: {
  org: { _id: string } | null;
  business: { _id: string } | null;
  isAuthenticated: boolean;
} = { org: null, business: null, isAuthenticated: true };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
    recorded.push(options);
    return { data: undefined };
  },
  useMutation: () => ({}),
  useQueryClient: () => ({}),
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => session }));
vi.mock("@/lib/api", () => ({ api: { get: async () => undefined, post: async () => undefined }, ApiError: class {} }));

const { useDashboardOrg, dashboardOrgKey, DASHBOARD_ORG_KEY } = await import("./use-dashboard-org");
const { useBillingSummary, billingSummaryKey, BILLING_SUMMARY_KEY, useBillingOrders, billingOrdersKey, BILLING_ORDERS_KEY } = await import(
  "./use-billing-summary"
);

function optionsOf(hook: () => unknown): QueryOptions {
  recorded.length = 0;
  hook();
  expect(recorded).toHaveLength(1);
  return recorded[0]!;
}

const hooks = [
  { name: "useDashboardOrg", hook: useDashboardOrg, prefix: DASHBOARD_ORG_KEY, keyOf: dashboardOrgKey },
  { name: "useBillingSummary", hook: useBillingSummary, prefix: BILLING_SUMMARY_KEY, keyOf: billingSummaryKey },
  // The order confirmations are the signed-in business's too (mongodb migration 406).
  { name: "useBillingOrders", hook: useBillingOrders, prefix: BILLING_ORDERS_KEY, keyOf: billingOrdersKey },
] as const;

for (const { name, hook, prefix, keyOf } of hooks) describe(`${name}: one cache entry per business (P4.3b)`, () => {
  beforeEach(() => {
    session.org = { _id: "org_1" };
    session.business = { _id: "biz_a" };
    session.isAuthenticated = true;
  });

  it("★two businesses of one org read two cache entries", () => {
    const a = optionsOf(hook).queryKey;
    session.business = { _id: "biz_b" };
    const b = optionsOf(hook).queryKey;
    expect(a).toEqual([prefix, "org_1", "biz_a"]);
    expect(b).toEqual([prefix, "org_1", "biz_b"]);
    expect(a).not.toEqual(b);
  });

  it("the key keeps its path first, so a prefix invalidation still reaches every business", () => {
    expect(optionsOf(hook).queryKey[0]).toBe(prefix);
    expect(keyOf("org_1", "biz_a")).toEqual([prefix, "org_1", "biz_a"]);
    expect(keyOf(undefined, null)).toEqual([prefix, null, null]);
  });

  it("★does not fetch until /me names a business", () => {
    expect(optionsOf(hook).enabled).toBe(true);
    session.business = null;
    expect(optionsOf(hook).enabled).toBe(false);
    session.business = { _id: "biz_a" };
    session.org = null;
    expect(optionsOf(hook).enabled).toBe(false);
    session.org = { _id: "org_1" };
    session.isAuthenticated = false;
    expect(optionsOf(hook).enabled).toBe(false);
  });
});
