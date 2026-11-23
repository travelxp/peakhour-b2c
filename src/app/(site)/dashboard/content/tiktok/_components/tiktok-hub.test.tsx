// @vitest-environment jsdom
/**
 * The TikTok page, driven as a person sees it: hidden unless the api says the row is available, the account and its posts when it is, and the
 * status of each post in words (never "Published" for a post TikTok has not taken).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

class FakeApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const h = vi.hoisted(() => ({ integrations: [] as unknown[], creatorInfo: vi.fn(), listItems: vi.fn(), search: "" }));
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(async () => ({ integrations: h.integrations })) },
  ApiError: FakeApiError,
  API_BASE_URL: "https://api.example",
}));
vi.mock("@/lib/api/tiktok-content", () => ({ tiktokContentApi: { creatorInfo: h.creatorInfo } }));
vi.mock("@/lib/scheduler/client", () => ({ scheduler: { listItems: h.listItems } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(h.search) }));
// The sheets are lazy in the page; here they are stood in for by markers, they have their own tests.
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => {
    const name = String(loader).includes("new-post") ? "new" : "post";
    return ({ item, open }: { item?: { _id: string } | null; open?: boolean }) =>
      name === "post" ? (item ? <div data-sheet="post" data-item={item._id} /> : null) : open ? <div data-sheet="new" /> : null;
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => ({ formatDate: (d: Date) => d.toISOString().slice(0, 10) }),
}));
vi.mock("@/components/integrations/oauth-connect-result", () => ({ OAuthConnectResult: () => null }));

const { TikTokHub } = await import("./tiktok-hub");
const { TikTokResults } = await import("@/components/tiktok/tiktok-results");
const { channelLinks, connectionsByProvider } = await import("../../create/channel-links");
const { CHANNELS } = await import("../../channels.config");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const AVAILABLE = { provider: "tiktok", availability: "available", connected: true, status: "active" };
const CREATOR = {
  nickname: "Acme Bakes",
  avatarUrl: null,
  privacyLevelOptions: ["PUBLIC_TO_EVERYONE"],
  commentDisabled: false,
  duetDisabled: false,
  stitchDisabled: false,
};
const item = (over: Record<string, unknown> = {}) => ({
  _id: "i1",
  channel: "tiktok",
  status: "queued",
  createdAt: "2026-11-23T10:00:00.000Z",
  payload: { text: "Fresh loaves today", mediaUrls: ["https://cdn/v.mp4"] },
  ...over,
});

let host: HTMLDivElement;
let root: Root;
const text = () => host.textContent ?? "";
const buttons = () => [...host.querySelectorAll("button")];

async function mount(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  });
  // the page reads in steps (integrations, then the account, then the posts): let each settle
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

beforeEach(() => {
  h.integrations = [AVAILABLE];
  h.search = "";
  h.creatorInfo.mockReset().mockResolvedValue(CREATOR);
  h.listItems.mockReset().mockResolvedValue({ items: [] });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("TikTok is hidden unless the row is available", () => {
  it("an org whose tiktok row is coming_soon sees the coming-soon message and nothing is read from TikTok", async () => {
    h.integrations = [{ provider: "tiktok", availability: "coming_soon" }];
    await mount(<TikTokHub />);
    expect(text()).toContain("TikTok is coming soon");
    expect(h.creatorInfo).not.toHaveBeenCalled();
    expect(h.listItems).not.toHaveBeenCalled();
  });

  it("Create does not link to TikTok for a connection that is not available, and does for one that is", () => {
    const tiktok = CHANNELS.find((c) => c.slug === "tiktok")!;
    const off = channelLinks([tiktok], connectionsByProvider([{ ...AVAILABLE, availability: "coming_soon" }]));
    expect(off).toEqual([]);
    const on = channelLinks([tiktok], connectionsByProvider([AVAILABLE]));
    expect(on.map((l) => l.href)).toEqual(["/dashboard/content/tiktok"]);
  });

  it("Results draws nothing for an org without TikTok, even if the scheduler holds a row", async () => {
    h.integrations = [{ provider: "tiktok", availability: "coming_soon" }];
    h.listItems.mockResolvedValue({ items: [item()] });
    await mount(<TikTokResults />);
    expect(text()).toBe("");
  });
});

describe("TikTok page", () => {
  it("shows the connected account and the empty state", async () => {
    await mount(<TikTokHub />);
    expect(text()).toContain("Acme Bakes");
    expect(text()).toContain("No TikTok posts yet");
    expect(text()).toContain("Posting to TikTok opens once TikTok approves Peakhour");
  });

  it("an approved item reads Approved and offers Post to TikTok, which opens the sheet", async () => {
    h.listItems.mockResolvedValue({ items: [item()] });
    await mount(<TikTokHub />);
    expect(host.querySelector('[data-testid="tiktok-status"]')?.textContent).toBe("Approved");
    await act(async () => {
      buttons().find((b) => b.textContent === "Post to TikTok")!.click();
    });
    expect(document.body.querySelector('[data-sheet="post"]')?.getAttribute("data-item")).toBe("i1");
  });

  it("an item parked as tiktok_coming_soon reads Waiting for TikTok approval, with no button, here and in Results", async () => {
    h.listItems.mockResolvedValue({ items: [item({ status: "needs_action", attempts: [{ errorCode: "tiktok_coming_soon" }] })] });
    await mount(<TikTokHub />);
    expect(host.querySelector('[data-testid="tiktok-status"]')?.textContent).toBe("Waiting for TikTok approval");
    expect(buttons().some((b) => b.textContent === "Post to TikTok" || b.textContent === "Open")).toBe(false);
    await act(async () => root.unmount());
    root = createRoot(host);
    await mount(<TikTokResults />);
    expect(host.querySelector('[data-testid="tiktok-status"]')?.textContent).toBe("Waiting for TikTok approval");
    expect(text()).not.toMatch(/published/i);
  });

  it("tiktok_privacy_required reads Choose who can watch it, with Open, which opens the sheet", async () => {
    h.listItems.mockResolvedValue({ items: [item({ status: "needs_action", attempts: [{ errorCode: "tiktok_privacy_required" }] })] });
    await mount(<TikTokHub />);
    expect(host.querySelector('[data-testid="tiktok-status"]')?.textContent).toBe("Choose who can watch it");
    await act(async () => {
      buttons().find((b) => b.textContent === "Open")!.click();
    });
    expect(document.body.querySelector('[data-sheet="post"]')?.getAttribute("data-item")).toBe("i1");
  });

  it("sending and retrying items offer no Post", async () => {
    h.listItems.mockResolvedValue({ items: [item({ _id: "a", status: "in_flight" }), item({ _id: "b", status: "awaiting_retry" })] });
    await mount(<TikTokHub />);
    expect([...host.querySelectorAll('[data-testid="tiktok-status"]')].map((e) => e.textContent)).toEqual(["Sending…", "Retrying"]);
    expect(buttons().some((b) => b.textContent === "Post to TikTok")).toBe(false);
  });

  it("opens the post sheet on ?post=<id> from Needs your OK", async () => {
    h.search = "post=i1";
    h.listItems.mockResolvedValue({ items: [item()] });
    await mount(<TikTokHub />);
    expect(document.body.querySelector('[data-sheet="post"]')?.getAttribute("data-item")).toBe("i1");
  });

  it("not connected offers Connect, expired offers Reconnect, an outage a plain retry", async () => {
    h.creatorInfo.mockRejectedValue(new FakeApiError("NOT_CONNECTED", "x", 409));
    await mount(<TikTokHub />);
    expect(host.querySelector("a")?.textContent).toBe("Connect TikTok");

    await act(async () => root.unmount());
    root = createRoot(host);
    h.creatorInfo.mockRejectedValue(new FakeApiError("NEEDS_REAUTH", "x", 409));
    await mount(<TikTokHub />);
    expect(host.querySelector("a")?.textContent).toBe("Reconnect TikTok");

    await act(async () => root.unmount());
    root = createRoot(host);
    h.creatorInfo.mockRejectedValue(new FakeApiError("TIKTOK_UNAVAILABLE", "x", 503));
    await mount(<TikTokHub />);
    expect(text()).toContain("We could not reach TikTok");
    expect(host.querySelector("a")).toBeNull();
    expect(buttons().some((b) => b.textContent === "Try again")).toBe(true);
  });
});
