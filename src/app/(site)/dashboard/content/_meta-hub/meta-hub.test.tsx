// @vitest-environment jsdom
/** The Facebook and Instagram hubs: the New post button opens the sheet on THIS hub's channel, and an empty Posts tab offers Create a post. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

const api = vi.hoisted(() => ({
  pages: vi.fn(),
  instagramAccounts: vi.fn(),
  pageInsights: vi.fn(),
  igInsights: vi.fn(),
  pagePosts: vi.fn(),
  igMedia: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: {}, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));
vi.mock("@/lib/api/meta-content", () => ({ metaContentApi: new Proxy(api, { get: (t, k) => (t as Record<string, unknown>)[k as string] ?? vi.fn(() => new Promise(() => {})) }) }));
vi.mock("@/components/compose/compose-sheet-provider", () => ({
  ComposeSheetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// The Repurpose sheet has its own tests; here only what the hub hands it matters: whether it is open and the source it was given.
// The hub loads it with next/dynamic (first use only), so the stub stands in for the dynamic import.
vi.mock("next/dynamic", () => ({
  default: () =>
    function RepurposeSheetStub({ open, source }: { open: boolean; source: unknown }) {
      return <div data-repurpose-sheet data-open={String(open)} data-source={JSON.stringify(source)} />;
    },
}));
vi.mock("@/components/compose/new-post-button", () => ({
  NewPostButton: ({ channel, label, disabled }: { channel?: string; label?: string; disabled?: boolean }) => (
    <button type="button" data-new-post={channel ?? ""} disabled={disabled}>
      {label ?? "New post"}
    </button>
  ),
}));
// Radix Select needs pointer capture jsdom lacks; a plain stand-in that calls onValueChange is what the hub depends on.
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  const Ctx = React.createContext<(v: string) => void>(() => {});
  return {
    Select: ({ onValueChange, children }: { onValueChange: (v: string) => void; children: React.ReactNode }) => (
      <Ctx.Provider value={onValueChange}>{children}</Ctx.Provider>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const on = React.useContext(Ctx);
      return (
        <button type="button" data-option={value} onClick={() => on(value)}>
          {children}
        </button>
      );
    },
  };
});
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/hooks/use-locale", () => ({ useLocale: () => ({ formatDate: () => "" }) }));
vi.mock("@/components/viz/delta-chip", () => ({ DeltaChip: () => null }));

const { MetaHub } = await import("./meta-hub");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

async function mount(channel: "facebook" | "instagram") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MetaHub channel={channel} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
const newPostButtons = () => [...host.querySelectorAll("button[data-new-post]")];

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.pages.mockResolvedValue({ pages: [{ id: "p1", name: "Acme" }], activePageId: "p1" });
  api.instagramAccounts.mockResolvedValue({ accounts: [{ id: "i1", username: "acme" }], activeAccountId: "i1" });
  api.pagePosts.mockResolvedValue({ posts: [] });
  api.igMedia.mockResolvedValue({ media: [] });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function openPostsTab() {
  const tab = [...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === "Posts")!;
  await act(async () => {
    tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("MetaHub New post goes to the saved Page", () => {
  const TWO_PAGES = [
    { id: "p1", name: "Acme Bakery" },
    { id: "p2", name: "Acme Cafe" },
  ];
  async function selectSecond() {
    const option = host.querySelector('[data-option="p2"]')!;
    await act(async () => (option as HTMLElement).click());
  }

  it("when the Page on screen is the saved one, the buttons work and no note is shown", async () => {
    api.pages.mockResolvedValue({ pages: TWO_PAGES, activePageId: "p1" });
    await mount("facebook");
    const btn = newPostButtons().find((b) => b.textContent === "New post") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(host.textContent).not.toContain("New posts go to");
  });

  it("when another Page is selected, New post and Create a post are disabled and one line says where posts go", async () => {
    api.pages.mockResolvedValue({ pages: TWO_PAGES, activePageId: "p1" });
    await mount("facebook");
    await selectSecond();
    const btn = newPostButtons().find((b) => b.textContent === "New post") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(host.textContent).toContain("New posts go to Acme Bakery. To post as Acme Cafe, make it your Page under");
    expect(host.querySelector('a[href="/dashboard/integrations"]')).not.toBeNull();
    await openPostsTab();
    const create = newPostButtons().find((b) => b.textContent === "Create a post") as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    expect(host.textContent!.match(/New posts go to/g)!.length).toBe(1);
  });
});

describe("MetaHub New post", () => {
  it.each(["facebook", "instagram"] as const)("the %s hub's New post opens the sheet on %s", async (channel) => {
    await mount(channel);
    const btn = newPostButtons().find((b) => b.textContent === "New post")!;
    expect(btn.getAttribute("data-new-post")).toBe(channel);
  });

  it("the Facebook Posts tab, empty, offers Create a post for Facebook", async () => {
    await mount("facebook");
    const tab = [...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === "Posts")!;
    await act(async () => {
      tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(host.textContent).toContain("No posts yet");
    const create = newPostButtons().find((b) => b.textContent === "Create a post")!;
    expect(create.getAttribute("data-new-post")).toBe("facebook");
  });
});

describe("MetaHub: turn a post into posts for other channels", () => {
  const TURN = "Turn into posts for other channels";
  const turnButtons = () => [...host.querySelectorAll("button")].filter((b) => b.textContent?.includes(TURN)) as HTMLButtonElement[];
  const sheet = () => host.querySelector("[data-repurpose-sheet]") as HTMLElement;

  it("every Facebook post row has the action, and it opens the sheet on THAT post", async () => {
    api.pagePosts.mockResolvedValue({
      posts: [
        { id: "p1_100", message: "Autumn tea is back", createdTime: "2026-11-01T08:00:00+0000" },
        { id: "p1_101", message: "Closed on Sunday", createdTime: "2026-11-02T08:00:00+0000" },
      ],
    });
    await mount("facebook");
    await openPostsTab();
    expect(turnButtons()).toHaveLength(2);
    expect(sheet().dataset.open).toBe("false");
    await act(async () => turnButtons()[1]!.click());
    expect(sheet().dataset.open).toBe("true");
    expect(JSON.parse(sheet().dataset.source!)).toEqual({ type: "facebook_post", postId: "p1_101" });
  });

  it("an Instagram media row names the account it is on (a media id does not)", async () => {
    api.igMedia.mockResolvedValue({
      media: [{ id: "9001", caption: "Tea time", mediaType: "IMAGE", timestamp: "2026-11-01T08:00:00+0000" }],
    });
    await mount("instagram");
    await openPostsTab();
    await act(async () => turnButtons()[0]!.click());
    expect(JSON.parse(sheet().dataset.source!)).toEqual({ type: "instagram_media", mediaId: "9001", igUserId: "i1" });
  });

  it("the sheet is not part of the list, so a posts refetch that fails cannot unmount it mid-flow", async () => {
    api.pagePosts.mockRejectedValue(new Error("graph down"));
    await mount("facebook");
    await openPostsTab();
    expect(host.textContent).toContain("We could not load your posts right now");
    expect(sheet()).not.toBeNull();
  });

  it("a post with no words cannot be turned into posts (nothing to write from), and the button says why", async () => {
    api.pagePosts.mockResolvedValue({ posts: [{ id: "p1_100", createdTime: "2026-11-01T08:00:00+0000", fullPicture: "https://cdn.test/a.jpg" }] });
    await mount("facebook");
    await openPostsTab();
    const [btn] = turnButtons();
    expect(btn!.disabled).toBe(true);
    expect(btn!.title).toBe("This post has no text to write from.");
  });
});
