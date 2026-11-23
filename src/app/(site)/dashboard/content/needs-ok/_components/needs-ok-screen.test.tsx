// @vitest-environment jsdom
/**
 * Needs your OK: groups with counts, each row opens the existing approve screen, an unreadable group is named (never silently dropped),
 * and the empty state says nothing is waiting and links to "Post something".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { NeedsOk, NeedsOkGroup, NeedsOkItem } from "@/hooks/use-needs-ok";

const h = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api", () => ({ api: { get: h.get }, API_BASE_URL: "https://api.example" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { NeedsOkScreen, POST_SOMETHING_HREF } = await import("./needs-ok-screen");

const item = (over: Partial<NeedsOkItem> & Pick<NeedsOkItem, "id" | "title" | "href">): NeedsOkItem => ({
  source: "scheduled_posts",
  holdsWork: true,
  why: "Waiting for you.",
  createdAt: null,
  channel: "",
  ...over,
});
const group = (over: Partial<NeedsOkGroup> & Pick<NeedsOkGroup, "source" | "label">): NeedsOkGroup => ({
  holdsWork: true,
  count: over.items?.length ?? 0,
  items: [],
  failed: false,
  ...over,
});
const answer = (sources: NeedsOkGroup[]): NeedsOk => ({
  total: sources.reduce((n, s) => n + s.count, 0),
  workTotal: sources.filter((s) => s.holdsWork).reduce((n, s) => n + s.count, 0),
  sources,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  h.get.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <NeedsOkScreen />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("NeedsOkScreen", () => {
  it("renders the api's two TikTok groups: choices as work, waiting as a suggestion, and merges nothing of its own", async () => {
    h.get.mockResolvedValue(
      answer([
        group({ source: "tiktok_choices", label: "Choose how to post on TikTok", items: [item({ id: "c1", source: "tiktok_choices", title: "Fresh loaves", why: "Choose who can watch it.", href: "/dashboard/content/tiktok?post=c1" })] }),
        group({ source: "tiktok_waiting", label: "Waiting for TikTok approval", holdsWork: false, items: [item({ id: "w1", source: "tiktok_waiting", holdsWork: false, title: "Sourdough", why: "Saved. Waiting for TikTok.", href: "/dashboard/content/tiktok?post=w1" })] }),
      ]),
    );
    await mount();
    expect([...container.querySelectorAll("h2, h3")].map((e) => e.textContent)).toEqual([
      "Choose how to post on TikTok (1)",
      "Suggestions",
      "Waiting for TikTok approval (1)",
    ]);
    expect([...container.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["/dashboard/content/tiktok?post=c1", "/dashboard/content/tiktok?post=w1"]);
    expect(h.get).toHaveBeenCalledTimes(1);
  });

  it("names an unread TikTok group instead of saying nothing is waiting", async () => {
    h.get.mockResolvedValue(answer([group({ source: "tiktok_choices", label: "Choose how to post on TikTok", failed: true })]));
    await mount();
    expect(container.textContent).toContain("Choose how to post on TikTok");
    expect(container.textContent).toContain("not counted here");
    expect(container.textContent).not.toContain("Nothing is waiting for your OK");
  });

  it("groups rows by source with a count, and each row links to the screen that approves it", async () => {
    h.get.mockResolvedValue(
      answer([
        group({ source: "scheduled_posts", label: "Posts to approve", items: [item({ id: "1", title: "Launch day", href: "/dashboard/content/linkedin" })] }),
        group({ source: "web_pages", label: "Web pages", items: [item({ id: "2", source: "web_pages", title: "For plumbers", href: "/dashboard/pages/2" })] }),
        group({ source: "news", label: "News drafts" }),
      ]),
    );
    await mount();
    const headings = [...container.querySelectorAll("h2")].map((e) => e.textContent);
    expect(headings).toEqual(["Posts to approve (1)", "Web pages (1)"]); // an empty group is not drawn
    const links = [...container.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links[0][1]).toBe("/dashboard/content/linkedin");
    expect(links[1][1]).toBe("/dashboard/pages/2");
    expect(container.textContent).toContain("2 things are waiting for you");
  });

  it("shows a parked post under Needs a fix, with what is needed", async () => {
    h.get.mockResolvedValue(
      answer([
        group({
          source: "scheduled_posts",
          label: "Needs a fix",
          items: [item({ id: "9", title: "Launch day", why: "Reconnect X, then retry this post.", href: "/dashboard/content/x" })],
        }),
      ]),
    );
    await mount();
    expect([...container.querySelectorAll("h2")].map((e) => e.textContent)).toEqual(["Needs a fix (1)"]);
    expect(container.textContent).toContain("Reconnect X, then retry this post.");
  });

  it("puts suggestions in a group of their own, headed Suggestions, after the work, and does not count them as waiting", async () => {
    h.get.mockResolvedValue(
      answer([
        group({ source: "linkedin_drafts", label: "LinkedIn post suggestions", holdsWork: false, items: [item({ id: "4", source: "linkedin_drafts", holdsWork: false, title: "Hook", href: "/dashboard/content/linkedin" })] }),
        group({ source: "plans", label: "Planned posts", items: [item({ id: "5", source: "plans", title: "Friday plan", href: "/dashboard/calendar" })] }),
      ]),
    );
    await mount();
    const headings = [...container.querySelectorAll("h2, h3")].map((e) => [e.tagName, e.textContent]);
    expect(headings).toEqual([
      ["H2", "Planned posts (1)"],
      ["H2", "Suggestions"],
      ["H3", "LinkedIn post suggestions (1)"],
    ]);
    expect(container.textContent).toContain("1 thing is waiting for you"); // the work, not the suggestion
    const labels = [...container.querySelectorAll("a")].map((a) => a.textContent ?? "");
    expect(labels[0]).toContain("Open");
    expect(labels[1]).toContain("See");
  });

  it("says nothing is stuck when only suggestions exist", async () => {
    h.get.mockResolvedValue(answer([group({ source: "studio_shortlist", label: "Designs you liked", holdsWork: false, items: [item({ id: "6", source: "studio_shortlist", holdsWork: false, title: "Heart", href: "/dashboard/studio/shortlist" })] })]));
    await mount();
    expect(container.textContent).toContain("Nothing is stuck waiting for you");
    expect(container.textContent).not.toContain("Nothing is waiting for your OK");
  });

  it("says nothing is waiting and links to Post something when every group is empty", async () => {
    h.get.mockResolvedValue(answer([group({ source: "scheduled_posts", label: "Posts to approve" })]));
    await mount();
    expect(container.textContent).toContain("Nothing is waiting for your OK");
    const post = [...container.querySelectorAll("a")].find((a) => a.textContent === "Post something");
    expect(post?.getAttribute("href")).toBe("/dashboard/calendar?compose=1"); // the calendar composer, pinned literally
    expect(POST_SOMETHING_HREF).toBe("/dashboard/calendar?compose=1");
  });

  it("names a group it could not read instead of dropping it", async () => {
    h.get.mockResolvedValue(
      answer([
        group({ source: "plans", label: "Planned posts", failed: true }),
        group({ source: "news", label: "News drafts", items: [item({ id: "3", source: "news", title: "Rates held", href: "/dashboard/content/news" })] }),
      ]),
    );
    await mount();
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Planned posts");
    expect(container.textContent).toContain("Rates held");
  });

  it("does not call a failed read an empty list", async () => {
    h.get.mockResolvedValue(answer([group({ source: "plans", label: "Planned posts", failed: true })]));
    await mount();
    // nothing waits that we could count, but one source is unreadable: say so, and make no claim that nothing waits
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Planned posts");
    expect(container.textContent).not.toContain("Nothing is waiting");
  });

  it("shows a retry when the page itself fails to load", async () => {
    h.get.mockRejectedValue(new Error("boom"));
    await mount();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Nothing is waiting");
  });

  it("Show more asks the api for the next page of that source only", async () => {
    const first = Array.from({ length: 2 }, (_, i) => item({ id: `a${i}`, title: `Post ${i}`, href: "/dashboard/content/x" }));
    h.get.mockResolvedValueOnce({ total: 3, workTotal: 3, sources: [{ ...group({ source: "scheduled_posts", label: "Posts to approve", items: first }), count: 3 }] });
    await mount();
    h.get.mockResolvedValueOnce({
      total: 3,
      workTotal: 3,
      sources: [{ ...group({ source: "scheduled_posts", label: "Posts to approve", items: [item({ id: "a1", title: "Post 1", href: "/dashboard/content/x" }), item({ id: "a2", title: "Post 2", href: "/dashboard/content/x" })] }), count: 3 }],
    });
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Show"));
    expect(button?.textContent).toBe("Show 1 more");
    await act(async () => {
      button!.click();
    });
    expect(h.get).toHaveBeenLastCalledWith("/v1/content/needs-ok", { source: "scheduled_posts", skip: "2", limit: "20" });
    expect(container.textContent).toContain("Post 2");
    // a row the poll already brought in is never listed twice
    expect(container.querySelectorAll("a")).toHaveLength(3);
    expect([...container.querySelectorAll("button")].some((b) => b.textContent?.startsWith("Show"))).toBe(false);
  });
});
