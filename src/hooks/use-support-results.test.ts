import { beforeEach, describe, expect, it, vi } from "vitest";

/** I3c: what the support results hooks read, key and invalidate. `useQuery`/`useMutation` are recorders; `api` records paths. */

type Opts = { queryKey?: unknown[]; queryFn?: () => Promise<unknown>; enabled?: boolean; placeholderData?: (prev: unknown, q: { queryKey: unknown[] }) => unknown; mutationFn?: (v: boolean) => Promise<unknown>; onSettled?: () => void };
const recorded: Opts[] = [];
const invalidated: unknown[][] = [];
const calls: { method: string; path: string; body?: unknown }[] = [];
let business: { _id: string } | null = { _id: "biz_a" };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (o: Opts) => (recorded.push(o), {}),
  useMutation: (o: Opts) => (recorded.push(o), {}),
  useQueryClient: () => ({ invalidateQueries: (f: { queryKey: unknown[] }) => void invalidated.push(f.queryKey) }),
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business }) }));
vi.mock("@/lib/api", () => ({
  api: {
    get: async (path: string) => (calls.push({ method: "GET", path }), {}),
    patch: async (path: string, body?: unknown) => (calls.push({ method: "PATCH", path, body }), { enabled: true }),
  },
}));
const { useSupportResults, useCsatSetting, supportResultsKey } = await import("./use-support-results");
const params = { from: "2026-11-01", to: "2026-11-03", channel: "whatsapp" as const, timeZone: "Asia/Kolkata" };
const last = () => recorded[recorded.length - 1]!;

beforeEach(() => {
  recorded.length = 0;
  invalidated.length = 0;
  calls.length = 0;
  business = { _id: "biz_a" };
});

describe("useSupportResults", () => {
  it("keys on the business and every filter, and reads the one endpoint", async () => {
    (useSupportResults as (p: typeof params) => unknown)(params);
    expect(last().queryKey).toEqual(supportResultsKey("biz_a", params));
    expect(last().queryKey).toEqual(["support-results", "biz_a", "2026-11-01", "2026-11-03", "whatsapp", "Asia/Kolkata"]);
    await last().queryFn!();
    expect(calls[0]!.path).toBe("/v1/meta/whatsapp/support-analytics?from=2026-11-01&to=2026-11-03&channel=whatsapp&tz=Asia%2FKolkata");
  });

  it("is off with no business or when the page says the range is not sendable", () => {
    business = null;
    (useSupportResults as (p: typeof params) => unknown)(params);
    expect(last().enabled).toBe(false);
    business = { _id: "biz_a" };
    (useSupportResults as (p: typeof params, e: boolean) => unknown)(params, false);
    expect(last().enabled).toBe(false);
    (useSupportResults as (p: typeof params, e: boolean) => unknown)(params, true);
    expect(last().enabled).toBe(true);
  });

  it("keeps the previous numbers only within one business", () => {
    (useSupportResults as (p: typeof params) => unknown)(params);
    const keep = last().placeholderData!;
    expect(keep("old", { queryKey: ["support-results", "biz_a"] })).toBe("old");
    expect(keep("old", { queryKey: ["support-results", "biz_b"] })).toBeUndefined();
  });
});

describe("useCsatSetting", () => {
  it("sends the switch and re-reads the results of this business", async () => {
    (useCsatSetting as () => unknown)();
    await last().mutationFn!(true);
    expect(calls[0]).toEqual({ method: "PATCH", path: "/v1/meta/whatsapp/csat-settings", body: { enabled: true } });
    last().onSettled!();
    expect(invalidated).toEqual([["support-results", "biz_a"]]);
  });
});
