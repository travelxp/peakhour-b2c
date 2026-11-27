// @vitest-environment jsdom
/**
 * The LinkedIn Refresh button — on the Library AND the Feed — asks the API to run the post sync for
 * this business now. Until it existed the panels only re-read what the twice-daily sync had stored,
 * so a new comment could wait twelve hours with nothing a merchant could press.
 *
 * ★One sync writes both pages' data (posts + interactions), so a refresh from either page must
 * re-read both. The first version re-read only the Library's key and left the Feed on old rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  syncNow: vi.fn(),
  feed: vi.fn(),
  interactions: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: h.toastSuccess, info: h.toastInfo, error: h.toastError },
}));
vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => ({ formatRelativeTime: () => "now", formatDate: () => "", formatNumber: (n: number) => String(n) }),
}));
vi.mock("@/lib/api/linkedin-content", async (orig) => ({
  ...((await orig()) as object),
  linkedInContentApi: {
    syncNow: h.syncNow,
    feed: h.feed,
    interactions: h.interactions,
    markInteractionsSeen: vi.fn(async () => ({ marked: 0 })),
  },
}));

const { LibraryPanel } = await import("./library-panel");
const { CommunityFeedPanel } = await import("./community-feed-panel");
const { ApiError } = await import("@/lib/api");

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;

beforeEach(() => {
  h.syncNow.mockReset();
  h.feed.mockReset().mockResolvedValue({ posts: [], nextCursor: null });
  h.interactions.mockReset().mockResolvedValue({
    rows: [],
    nextCursor: null,
    counts: { needsReply: 0, unseen: 0, mentions: 0, reposts: 0, oldestUnansweredMs: null },
  });
  h.toastSuccess.mockReset();
  h.toastInfo.mockReset();
  h.toastError.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount(which: "library" | "feed" = "library") {
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        {which === "library" ? <LibraryPanel /> : <CommunityFeedPanel author={null} />}
      </QueryClientProvider>,
    );
  });
}
const button = () =>
  [...container.querySelectorAll("button")].find((b) => /Refresh/.test(b.textContent ?? "")) as HTMLButtonElement;
const click = async () => {
  await act(async () => {
    button().click();
  });
};

describe("LinkedInRefreshButton", () => {
  it("is offered even when nothing has synced yet", async () => {
    await mount();
    expect(button()).toBeTruthy();
    // The feed query resolves after mount; wait for its empty state.
    await vi.waitFor(() => expect(container.textContent).toContain("No synced posts yet"));
  });

  it("asks the API to sync now and says so", async () => {
    h.syncNow.mockResolvedValue({ jobId: "j1", status: "pending" });
    await mount();
    const feedCalls = h.feed.mock.calls.length;
    await click();
    expect(h.syncNow).toHaveBeenCalledTimes(1);
    expect(h.toastSuccess).toHaveBeenCalledWith("Refreshing from LinkedIn", expect.anything());
    // The feed is re-read straight away, not left showing the old rows.
    expect(h.feed.mock.calls.length).toBeGreaterThan(feedCalls);
  });

  it("re-reads the feed again at 20s and 60s, and stops when the panel goes away", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      h.syncNow.mockResolvedValue({ jobId: "j1", status: "pending" });
      await mount();
      await click();
      const afterClick = h.feed.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      expect(h.feed.mock.calls.length).toBeGreaterThan(afterClick);
      const after20 = h.feed.mock.calls.length;
      // Unmounting cancels the 60s re-read.
      act(() => root.unmount());
      await vi.advanceTimersByTimeAsync(60_000);
      expect(h.feed.mock.calls.length).toBe(after20);
      // afterEach unmounts again; give it a live root.
      root = createRoot(container);
    } finally {
      vi.useRealTimers();
    }
  });

  it("the Feed has the same button, and a refresh there re-reads the Feed", async () => {
    h.syncNow.mockResolvedValue({ jobId: "j2", status: "pending" });
    await mount("feed");
    await vi.waitFor(() => expect(h.interactions).toHaveBeenCalled());
    const before = h.interactions.mock.calls.length;
    await click();
    expect(h.syncNow).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(h.interactions.mock.calls.length).toBeGreaterThan(before));
  });

  it("the Feed's button survives the panel finishing loading (a remount would cancel its timers)", async () => {
    let finish!: (v: unknown) => void;
    h.interactions.mockReset().mockReturnValue(new Promise((r) => (finish = r)));
    await mount("feed");
    const whileLoading = button();
    expect(whileLoading).toBeTruthy();
    await act(async () => {
      finish({ rows: [], nextCursor: null, counts: { needsReply: 0, unseen: 0, mentions: 0, reposts: 0, oldestUnansweredMs: null } });
    });
    await vi.waitFor(() => expect(container.textContent).toContain("Nothing waiting on you"));
    expect(button()).toBe(whileLoading);
  });

  it.each(["library", "feed"] as const)(
    "a refresh from the %s marks BOTH pages' queries stale — one sync writes both",
    async (which) => {
      h.syncNow.mockResolvedValue({ jobId: "j3", status: "pending" });
      // Both pages' data is already in the cache, as after visiting both tabs.
      qc.setQueryData(["linkedin-feed", "all"], { pages: [], pageParams: [] });
      qc.setQueryData(["linkedin-interactions", "needs_reply"], { pages: [], pageParams: [] });
      await mount(which);
      await click();
      await vi.waitFor(() => {
        // Not the open page's own key (it refetched at once, so it is fresh again): the OTHER
        // page's, which nothing is observing and which only invalidation can reach.
        const other = which === "library" ? ["linkedin-interactions", "needs_reply"] : ["linkedin-feed", "all"];
        expect(qc.getQueryState(other)?.isInvalidated).toBe(true);
      });
    },
  );

  it("a refresh inside the cooldown is a quiet note, not an error", async () => {
    h.syncNow.mockRejectedValue(new ApiError("SYNC_TOO_SOON", "too soon", 429));
    await mount();
    await click();
    expect(h.toastInfo).toHaveBeenCalledWith("Already refreshed a moment ago", expect.anything());
    expect(h.toastError).not.toHaveBeenCalled();
  });

  it("a disconnected LinkedIn points to reconnecting", async () => {
    h.syncNow.mockRejectedValue(new ApiError("NOT_CONNECTED", "no", 404));
    await mount();
    await click();
    expect(h.toastError).toHaveBeenCalledWith("LinkedIn isn't connected", expect.anything());
  });
});
