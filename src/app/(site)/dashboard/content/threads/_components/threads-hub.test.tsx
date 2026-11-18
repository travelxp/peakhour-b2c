// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

/** The Threads hub, driven as a person sees it: profile, posts, "View on Threads", every empty and error state. */

class FakeApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
const threadsApi = vi.hoisted(() => ({ profile: vi.fn(), posts: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: {}, ApiError: FakeApiError, API_BASE_URL: "https://api.example" }));
vi.mock("@/lib/api/threads", () => ({ threadsApi, THREADS_PAGE_SIZE: 10 }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => ({ formatDate: (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "") }),
}));

const { ThreadsHub } = await import("./threads-hub");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PROFILE = {
  id: "1784",
  username: "acme",
  name: "Acme Co",
  pictureUrl: "https://cdn/p.jpg",
  profileUrl: "https://www.threads.com/@acme",
};
const POST = {
  id: "1",
  text: "Hello from Peakhour",
  permalink: "https://www.threads.com/@acme/post/ABC",
  timestamp: "2026-11-17T09:30:00+0000",
  mediaType: "TEXT_POST",
};

let host: HTMLDivElement;
let root: Root;

async function mount() {
  const client = new QueryClient();
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <ThreadsHub />
      </QueryClientProvider>,
    );
  });
  // The posts query only starts once the profile has answered, so settle twice.
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}
const text = () => host.textContent ?? "";
const hrefs = () => [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  threadsApi.profile.mockReset();
  threadsApi.posts.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("ThreadsHub", () => {
  it("shows the profile and the posts with a View on Threads link each", async () => {
    threadsApi.profile.mockResolvedValue({ profile: PROFILE });
    threadsApi.posts.mockResolvedValue({ posts: [POST], nextCursor: null });
    await mount();
    expect(text()).toContain("Acme Co");
    expect(text()).toContain("@acme");
    expect(text()).toContain("Hello from Peakhour");
    expect(text()).toContain("2026-11-17");
    expect(hrefs()).toContain("https://www.threads.com/@acme");
    expect(hrefs()).toContain("https://www.threads.com/@acme/post/ABC");
    expect(text()).not.toContain("Show more");
  });

  it("offers Show more only when there is a next page, and asks for that cursor", async () => {
    threadsApi.profile.mockResolvedValue({ profile: PROFILE });
    threadsApi.posts.mockResolvedValueOnce({ posts: [POST], nextCursor: "AFT" });
    threadsApi.posts.mockResolvedValueOnce({ posts: [{ ...POST, id: "2", text: "Second page" }], nextCursor: null });
    await mount();
    const more = [...host.querySelectorAll("button")].find((b) => b.textContent === "Show more")!;
    await act(async () => more.click());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(threadsApi.posts).toHaveBeenLastCalledWith("AFT");
    expect(text()).toContain("Second page");
    expect(text()).not.toContain("Show more");
  });

  it("an empty profile points to Compose new", async () => {
    threadsApi.profile.mockResolvedValue({ profile: PROFILE });
    threadsApi.posts.mockResolvedValue({ posts: [], nextCursor: null });
    await mount();
    expect(text()).toContain("No posts yet");
    expect(hrefs()).toContain("/dashboard/calendar?compose=1");
  });

  it("not connected offers Connect Threads, returning here", async () => {
    threadsApi.profile.mockRejectedValue(new FakeApiError(404, "THREADS_NOT_CONNECTED"));
    await mount();
    expect(text()).toContain("Connect Threads to see your profile");
    const href = hrefs().find((h) => h?.startsWith("/dashboard/integrations"))!;
    expect(decodeURIComponent(href)).toContain("returnTo=/dashboard/content/threads");
    expect(href).toContain("returnFor=threads");
    expect(threadsApi.posts).not.toHaveBeenCalled();
  });

  it("an expired connection offers Reconnect", async () => {
    threadsApi.profile.mockRejectedValue(new FakeApiError(409, "NEEDS_REAUTH"));
    await mount();
    expect(text()).toContain("Threads needs a quick reconnect");
    expect(text()).toContain("Reconnect Threads");
  });

  it("any other failure says so and offers Try again", async () => {
    threadsApi.profile.mockRejectedValue(new FakeApiError(502, "THREADS_UNAVAILABLE"));
    await mount();
    expect(text()).toContain("We could not reach Threads");
    expect(text()).toContain("Try again");
  });

  it("a posts failure keeps the profile and says the posts could not load", async () => {
    threadsApi.profile.mockResolvedValue({ profile: PROFILE });
    threadsApi.posts.mockRejectedValue(new FakeApiError(502, "THREADS_UNAVAILABLE"));
    await mount();
    expect(text()).toContain("Acme Co");
    expect(text()).toContain("We could not load your posts right now.");
  });
});
