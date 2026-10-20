import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WA T4 follow-up (api#1530): what `useWaResume` sends and what it re-reads.
 * `useMutation` is replaced by a recorder of its options, `useQueryClient` by
 * a recorder of invalidations, `useAuth` by a fixed session, and `api.post` by
 * a recorder of the path and body.
 */

type MutationOptions = {
  mutationFn: (vars: { threadId: string; thread?: { statusVersion?: unknown } | null }) => Promise<unknown>;
  onSuccess?: (data: unknown, vars: { threadId: string }) => void;
  onSettled?: (data: unknown, error: unknown, vars: { threadId: string }) => void;
};
const recorded: MutationOptions[] = [];
const invalidated: unknown[][] = [];
const posts: { path: string; body: unknown }[] = [];

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: MutationOptions) => {
    recorded.push(options);
    return {};
  },
  useQuery: () => ({}),
  useQueryClient: () => ({
    invalidateQueries: (f: { queryKey: unknown[] }) => {
      invalidated.push(f.queryKey);
    },
  }),
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "biz_a" } }) }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import("@/lib/api")>()).ApiError,
  api: {
    post: async (path: string, body?: unknown) => {
      posts.push({ path, body });
      return { ok: true };
    },
  },
}));
const { ApiError } = await import("@/lib/api");
const { useWaResume } = await import("./use-wa-conversations");

// Called through a plain reference: the recorder stands in for React here.
const hook: () => unknown = useWaResume;

function options(): MutationOptions {
  recorded.length = 0;
  hook();
  expect(recorded).toHaveLength(1);
  return recorded[0]!;
}

/** What the mutation runs after an answer, in react-query's order. */
function settle(o: MutationOptions, outcome: { data: unknown } | { error: unknown }, vars: { threadId: string }) {
  if ("data" in outcome) o.onSuccess?.(outcome.data, vars);
  o.onSettled?.("data" in outcome ? outcome.data : undefined, "error" in outcome ? outcome.error : null, vars);
}

const T = "whatsapp:pn1:919800000000";
const THREAD_KEY = ["wa-thread", "biz_a", T];

describe("useWaResume", () => {
  beforeEach(() => {
    invalidated.length = 0;
    posts.length = 0;
  });

  it("[SF14] resume sends the rendered status version, zero included", async () => {
    await options().mutationFn({ threadId: T, thread: { statusVersion: 0 } });
    expect(posts).toEqual([
      { path: `/v1/meta/whatsapp/conversations/${encodeURIComponent(T)}/resume`, body: { statusVersion: 0 } },
    ]);
  });
  it("[SF15] a stale resume's 409 re-reads the thread", () => {
    settle(options(), { error: new ApiError("STATUS_CHANGED", "changed", 409) }, { threadId: T });
    expect(invalidated).toContainEqual(THREAD_KEY);
  });
  it("[SF16] a resume that lands re-reads the thread and the list once each", () => {
    settle(options(), { data: { ok: true } }, { threadId: T });
    expect(invalidated).toHaveLength(2);
    expect(invalidated).toContainEqual(["wa-conversations", "biz_a"]);
    expect(invalidated).toContainEqual(THREAD_KEY);
  });
});
