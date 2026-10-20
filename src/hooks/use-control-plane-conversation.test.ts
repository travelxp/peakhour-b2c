import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WA M6: the options `useConversation` hands to `useInfiniteQuery`, and the
 * request `getConversation` sends. `useInfiniteQuery` is replaced by a recorder,
 * `useAuth` by a fixed session, and `api.get` by a recorder of the path.
 */

type InfiniteOptions = {
  queryKey: readonly unknown[];
  enabled?: boolean;
  queryFn: (ctx: { pageParam: string | null }) => Promise<unknown>;
  getNextPageParam: (last: unknown) => unknown;
  initialPageParam: unknown;
  refetchInterval?: unknown;
  refetchOnWindowFocus?: unknown;
  retry?: unknown;
};
const recorded: InfiniteOptions[] = [];
const session: {
  org: { _id: string } | null;
  business: { _id: string } | null;
  user: { _id: string } | null;
  isAuthenticated: boolean;
} = { org: null, business: null, user: null, isAuthenticated: true };

const paths: string[] = [];
let answer: () => Promise<unknown> = async () => ({ messages: [], nextCursor: null });

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: InfiniteOptions) => {
    recorded.push(options);
    return { data: undefined };
  },
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => session }));
vi.mock("@/lib/api", () => ({
  api: {
    get: async (path: string) => {
      paths.push(path);
      return answer();
    },
  },
}));

const { useConversation } = await import("./use-control-plane-conversation");
const { CONTROL_PLANE_CONVERSATION_KEY, shouldRetryConversation, nextConversationCursor } =
  await import("@/lib/control-plane-conversation");

// Called through a plain reference: the recorder stands in for React here.
const hook: () => unknown = useConversation;

function options(): InfiniteOptions {
  recorded.length = 0;
  hook();
  expect(recorded).toHaveLength(1);
  return recorded[0]!;
}

describe("useConversation", () => {
  beforeEach(() => {
    session.org = { _id: "org_1" };
    session.business = { _id: "biz_a" };
    session.user = { _id: "u_me" };
    session.isAuthenticated = true;
    paths.length = 0;
    answer = async () => ({ messages: [], nextCursor: null });
  });

  it("[H01] two businesses, and two teammates on one business, read separate cache entries", () => {
    const a = options().queryKey;
    session.business = { _id: "biz_b" };
    const b = options().queryKey;
    session.business = { _id: "biz_a" };
    session.user = { _id: "u_teammate" };
    const t = options().queryKey;
    expect(a).toEqual([CONTROL_PLANE_CONVERSATION_KEY, "org_1", "biz_a", "u_me"]);
    expect(b).toEqual([CONTROL_PLANE_CONVERSATION_KEY, "org_1", "biz_b", "u_me"]);
    expect(t).toEqual([CONTROL_PLANE_CONVERSATION_KEY, "org_1", "biz_a", "u_teammate"]);
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
  });

  it("[H03] no polling and no refetch on focus; 4xx are not retried", () => {
    const o = options();
    expect(o.refetchInterval).toBeUndefined();
    expect(o.refetchOnWindowFocus).toBe(false);
    expect(o.retry).toBe(shouldRetryConversation);
    expect(o.getNextPageParam).toBe(nextConversationCursor);
    expect(o.initialPageParam).toBeNull();
  });

  it("[H04] the first page sends no query string at all", async () => {
    await options().queryFn({ pageParam: null });
    expect(paths).toEqual(["/v1/control-plane/conversation"]);
  });

  it("[H05] an older page sends the cursor and nothing else", async () => {
    await options().queryFn({ pageParam: "1760000000000.abcdef0123456789" });
    expect(paths).toEqual(["/v1/control-plane/conversation?cursor=1760000000000.abcdef0123456789"]);
    const url = new URL(`https://x${paths[0]}`);
    expect([...url.searchParams.keys()]).toEqual(["cursor"]);
  });

  it("[H06] a 403 from the api is cached as a refusal", async () => {
    answer = async () => {
      throw Object.assign(new Error("FORBIDDEN"), { status: 403, code: "FORBIDDEN" });
    };
    await expect(options().queryFn({ pageParam: null })).resolves.toEqual({ kind: "refused" });
  });
});
