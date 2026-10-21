import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WA M6: the options `useConversation` hands to `useInfiniteQuery`, and the
 * request `getConversation` sends. `useInfiniteQuery` is replaced by a recorder,
 * `useAuth` by a fixed session, and `api.get` by a recorder of the path.
 */

type InfiniteOptions = {
  queryKey: readonly unknown[];
  enabled?: boolean;
  queryFn: (ctx: { pageParam: unknown }) => Promise<unknown>;
  getNextPageParam: (last: unknown) => unknown;
  getPreviousPageParam?: (first: unknown) => unknown;
  initialPageParam: unknown;
  refetchInterval?: unknown;
  refetchOnWindowFocus?: unknown;
  refetchOnReconnect?: unknown;
  retry?: unknown;
};
const recorded: InfiniteOptions[] = [];
const session: {
  org: { _id: string } | null;
  business: { _id: string } | null;
  user: { _id: string } | null;
  isAuthenticated: boolean;
} = { org: null, business: null, user: null, isAuthenticated: true };

const calls: { path: string; params: Record<string, string> | undefined }[] = [];
let answer: () => Promise<unknown> = async () => ({ messages: [], nextCursor: null, newerCursor: null });

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: InfiniteOptions) => {
    recorded.push(options);
    return { data: undefined };
  },
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => session }));
vi.mock("@/lib/api", async (importOriginal) => ({
  // The real ApiError, so the refusal is classified exactly as in the app.
  ApiError: (await importOriginal<typeof import("@/lib/api")>()).ApiError,
  api: {
    get: async (path: string, params?: Record<string, string>) => {
      calls.push({ path, params });
      return answer();
    },
  },
}));
const { ApiError } = await import("@/lib/api");

const { useConversation } = await import("./use-control-plane-conversation");
const {
  CONTROL_PLANE_CONVERSATION_KEY,
  latestAnchor,
  dayKeyIn,
  shouldRetryConversation,
  olderConversationParam,
  newerConversationParam,
} = await import("@/lib/control-plane-conversation");
type Anchor = Parameters<typeof useConversation>[0];

// Called through a plain reference: the recorder stands in for React here.
const hook: (anchor: Anchor) => unknown = useConversation;

const LATEST = latestAnchor("Asia/Kolkata");
function options(anchor: Anchor = LATEST): InfiniteOptions {
  recorded.length = 0;
  hook(anchor);
  expect(recorded).toHaveLength(1);
  return recorded[0]!;
}

describe("useConversation", () => {
  beforeEach(() => {
    session.org = { _id: "org_1" };
    session.business = { _id: "biz_a" };
    session.user = { _id: "u_me" };
    session.isAuthenticated = true;
    calls.length = 0;
    answer = async () => ({ messages: [], nextCursor: null, newerCursor: null });
  });

  it("[H01] two businesses, and two teammates on one business, read separate cache entries", () => {
    const a = options().queryKey;
    session.business = { _id: "biz_b" };
    const b = options().queryKey;
    session.business = { _id: "biz_a" };
    session.user = { _id: "u_teammate" };
    const t = options().queryKey;
    expect(a).toEqual([CONTROL_PLANE_CONVERSATION_KEY, "org_1", "biz_a", "u_me", "latest@Asia/Kolkata"]);
    expect(b).toEqual([CONTROL_PLANE_CONVERSATION_KEY, "org_1", "biz_b", "u_me", "latest@Asia/Kolkata"]);
    expect(t).toEqual([CONTROL_PLANE_CONVERSATION_KEY, "org_1", "biz_a", "u_teammate", "latest@Asia/Kolkata"]);
  });

  it("[H02] does not fetch until the session names an org, a business and a user", () => {
    expect(options().enabled).toBe(true);
    session.business = null;
    expect(options().enabled).toBe(false);
    session.business = { _id: "biz_a" };
    session.org = null;
    expect(options().enabled).toBe(false);
    session.org = { _id: "org_1" };
    session.user = null;
    expect(options().enabled).toBe(false);
    session.user = { _id: "u_me" };
    session.isAuthenticated = false;
    expect(options().enabled).toBe(false);
    // ★Nor before the display zone is known (no anchor yet).
    session.isAuthenticated = true;
    expect(options(null).enabled).toBe(false);
  });

  it("[H03] no polling and no refetch on focus or reconnect; 4xx are not retried", () => {
    const o = options();
    expect(o.refetchInterval).toBeUndefined();
    expect(o.refetchOnWindowFocus).toBe(false);
    expect(o.refetchOnReconnect).toBe(false);
    expect(o.retry).toBe(shouldRetryConversation);
    expect(o.getNextPageParam).toBe(olderConversationParam);
    expect(o.getPreviousPageParam).toBe(newerConversationParam);
    expect(o.initialPageParam).toEqual({ kind: "recent", timeZone: "Asia/Kolkata" });
  });

  it("[H04] the first page asks for the last 3 calendar days in the zone and nothing else", async () => {
    const o = options();
    await o.queryFn({ pageParam: o.initialPageParam });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.path).toBe("/v1/control-plane/conversation");
    expect(Object.keys(calls[0]!.params ?? {})).toEqual(["since"]);
    const since = Date.parse(calls[0]!.params!.since!);
    const z = "Asia/Kolkata";
    // A local midnight, two calendar days before today in that zone.
    const today = dayKeyIn(Date.now(), z);
    const d = (k: string) => Date.parse(`${k}T00:00:00Z`);
    expect((d(today) - d(dayKeyIn(since, z))) / 86_400_000).toBe(2);
    expect(dayKeyIn(since - 1, z)).not.toBe(dayKeyIn(since, z));
  });

  it("[H05] an older page sends the cursor and nothing else", async () => {
    await options().queryFn({ pageParam: { kind: "older", cursor: "1760000000000.abcdef0123456789" } });
    expect(calls).toEqual([
      { path: "/v1/control-plane/conversation", params: { cursor: "1760000000000.abcdef0123456789" } },
    ]);
  });

  it("[H07] a newer page sends after and nothing else", async () => {
    await options().queryFn({ pageParam: { kind: "newer", after: "1760000000000.abcdef0123456789" } });
    expect(calls).toEqual([
      { path: "/v1/control-plane/conversation", params: { after: "1760000000000.abcdef0123456789" } },
    ]);
  });

  it("[H08] a jump to a day is its own cache entry and asks for that day in its zone, half-open", async () => {
    const anchor = { kind: "day" as const, day: "2026-10-12", timeZone: "Asia/Kolkata" };
    const o = options(anchor);
    expect(o.queryKey).toEqual([CONTROL_PLANE_CONVERSATION_KEY, "org_1", "biz_a", "u_me", "day:2026-10-12@Asia/Kolkata"]);
    await o.queryFn({ pageParam: o.initialPageParam });
    expect(calls).toEqual([
      {
        path: "/v1/control-plane/conversation",
        params: { since: "2026-10-11T18:30:00.000Z", until: "2026-10-12T18:30:00.000Z" },
      },
    ]);
  });

  it("[H06] a 403 from the api is cached as a refusal", async () => {
    answer = async () => {
      throw new ApiError("FORBIDDEN", "Forbidden", 403);
    };
    await expect(options().queryFn({ pageParam: { kind: "recent", timeZone: "UTC" } })).resolves.toEqual({
      kind: "refused",
      reason: "forbidden",
    });
  });
});
