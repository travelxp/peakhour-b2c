// @vitest-environment jsdom
/**
 * The TikTok tracking card (TT-PX): the pixel picker (empty, listing, choosing), each reason the api gives for sending nothing, the
 * permission refusal, and the catalog feed (off, created with the URL shown once, rotate, turn off, hidden on a 404).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { get: h.get, post: h.post, put: h.put, delete: h.del }, API_BASE_URL: "https://api.example" }));

const { TikTokTrackingCard } = await import("./tiktok-tracking-card");
const { tiktokAdvertisers } = await import("@/lib/tiktok-tracking");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADV = [{ id: "7000000000001", name: "Shop ads" }];
const apiError = (status: number, code: string, message = "x") => Object.assign(new Error(message), { status, code });

interface World {
  selected?: unknown;
  selectedError?: unknown;
  pixels?: unknown;
  pixelsError?: unknown;
  feed?: unknown;
  feedError?: unknown;
  members?: unknown;
}

let root: Root;
let host: HTMLElement;
let reconnect: ReturnType<typeof vi.fn<() => void>>;

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  h.get.mockReset();
  h.post.mockReset();
  h.put.mockReset();
  h.del.mockReset();
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
async function settle(times = 5) {
  for (let i = 0; i < times; i++) await flush();
}

async function mount(world: World, advertisers = ADV) {
  h.get.mockImplementation(async (path: string) => {
    if (path.startsWith("/v1/tiktok/ads/pixels/selected")) {
      if (world.selectedError) throw world.selectedError;
      return world.selected;
    }
    if (path.startsWith("/v1/tiktok/ads/pixels")) {
      if (world.pixelsError) throw world.pixelsError;
      return world.pixels;
    }
    if (path.startsWith("/v1/tiktok/ads/catalog-feed")) {
      if (world.feedError) throw world.feedError;
      return world.feed;
    }
    if (path.startsWith("/v1/auth/team/members")) return world.members ?? { members: [] };
    throw new Error(`unexpected GET ${path}`);
  });
  reconnect = vi.fn<() => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <TikTokTrackingCard advertisers={advertisers} onReconnect={reconnect} />
      </QueryClientProvider>,
    );
  });
  await settle();
}

const text = () => host.textContent ?? "";
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement | undefined;
async function click(el: Element | undefined | null) {
  expect(el).toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
  });
  await settle();
}
async function pick(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}
const feedOff = { enabled: false, url: null, createdAt: null, rotatedAt: null, lastFetchedAt: null };

describe("pixel status", () => {
  it("nothing chosen: shows the api's sentence verbatim and offers to choose", async () => {
    const message = "No TikTok pixel is chosen, so no purchases are sent to TikTok. Choose the pixel your ads should learn from.";
    await mount({ selected: { sending: false, reason: "no_pixel_selected", message }, feedError: apiError(404, "NOT_FOUND") });
    expect(host.querySelector('[data-testid="tiktok-not-sending"]')?.textContent).toBe(message);
    expect(text()).toContain("TikTok tracking");
    expect(text()).toContain("Until you choose one, Peakhour sends nothing to TikTok.");
    expect(button("Choose a pixel")).toBeTruthy();
    expect(button("Choose again")).toBeUndefined();
  });

  it.each(["pixel_advertiser_gone", "pixel_refused"])("%s: api message verbatim plus Choose again", async (reason) => {
    const message = `api sentence for ${reason}`;
    await mount({
      selected: { sending: false, reason, message, pixel: { code: "PX1", advertiserId: ADV[0]!.id } },
      feedError: apiError(404, "NOT_FOUND"),
    });
    expect(host.querySelector('[data-testid="tiktok-not-sending"]')?.textContent).toBe(message);
    expect(button("Choose again")).toBeTruthy();
  });

  it("sending: names the pixel and who chose it, resolved from the team, with the date", async () => {
    await mount({
      selected: { sending: true, pixel: { code: "PX1", name: "Main pixel", advertiserId: ADV[0]!.id, selectedBy: "u1", selectedAt: "2026-11-20T10:00:00.000Z" } },
      members: { members: [{ userId: "u1", name: "Asha Rao", email: "asha@example.com", role: "admin", lastLoginAt: null, isOwner: false }] },
      feedError: apiError(404, "NOT_FOUND"),
    });
    const line = host.querySelector('[data-testid="tiktok-sending"]')?.textContent;
    expect(line).toContain("Main pixel");
    expect(line).toContain("chosen by Asha Rao on 2026-11-20");
    expect(button("Change pixel")).toBeTruthy();
  });

  it("a chooser who is not in the member list reads as a team member", async () => {
    await mount({
      selected: { sending: true, pixel: { code: "PX1", advertiserId: ADV[0]!.id, selectedBy: "gone", selectedAt: "2026-11-20T10:00:00.000Z" } },
      feedError: apiError(404, "NOT_FOUND"),
    });
    expect(text()).toContain("chosen by a team member");
  });

  it("permission error: the fixed sentence and a Reconnect action that calls the page's reconnect", async () => {
    await mount({ selectedError: apiError(409, "TIKTOK_PERMISSION", "raw api words"), feedError: apiError(404, "NOT_FOUND") });
    expect(text()).toContain("Your TikTok connection is missing a permission. Reconnect TikTok, or contact support if this keeps happening.");
    expect(text()).not.toContain("raw api words");
    await click(button("Reconnect TikTok"));
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it("any other read failure is a plain sentence, not the api's words", async () => {
    await mount({ selectedError: apiError(502, "PIXEL_READ_FAILED", "relay hop"), feedError: apiError(404, "NOT_FOUND") });
    expect(text()).toContain("We could not read your TikTok pixel choice.");
    expect(text()).not.toContain("relay hop");
  });
});

describe("pixel picker", () => {
  const nothing = { sending: false, reason: "no_pixel_selected", message: "none" };

  it("empty: an advertiser with no pixels says so", async () => {
    await mount({ selected: nothing, pixels: { pixels: [], truncated: false }, feedError: apiError(404, "NOT_FOUND") });
    await click(button("Choose a pixel"));
    expect(text()).toContain("This advertiser has no pixels.");
    expect(h.get).toHaveBeenCalledWith(`/v1/tiktok/ads/pixels?advertiserId=${ADV[0]!.id}`);
  });

  it("no advertiser on the grant: says so and calls nothing", async () => {
    await mount({ selected: nothing, feedError: apiError(404, "NOT_FOUND") }, []);
    await click(button("Choose a pixel"));
    expect(text()).toContain("No TikTok advertiser account is on this connection");
    expect(h.get.mock.calls.some(([p]) => String(p).startsWith("/v1/tiktok/ads/pixels?"))).toBe(false);
  });

  it("listing and choosing: lists the pixels, saves the pick, then re-reads the status", async () => {
    let saved = false;
    const world: World = {
      selected: nothing,
      pixels: { pixels: [{ code: "PX1", name: "Main pixel" }, { code: "PX2" }], truncated: false },
      feedError: apiError(404, "NOT_FOUND"),
    };
    await mount(world);
    h.put.mockImplementation(async () => {
      saved = true;
      world.selected = { sending: true, pixel: { code: "PX2", advertiserId: ADV[0]!.id } };
      return world.selected;
    });
    await click(button("Choose a pixel"));
    const select = host.querySelector('select[aria-label="TikTok pixel"]') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(["Choose a pixel", "Main pixel (PX1)", "PX2"]);
    expect(button("Save choice")?.disabled).toBe(true);
    await pick(select, "PX2");
    await click(button("Save choice"));
    expect(h.put).toHaveBeenCalledWith("/v1/tiktok/ads/pixels/selected", { advertiserId: ADV[0]!.id, pixelCode: "PX2" });
    expect(saved).toBe(true);
    expect(host.querySelector('[data-testid="tiktok-sending"]')?.textContent).toContain("PX2");
    expect(host.querySelector('[data-testid="tiktok-pixel-picker"]')).toBeNull();
  });

  it("several advertisers: offers a picker for them", async () => {
    await mount(
      { selected: nothing, pixels: { pixels: [], truncated: false }, feedError: apiError(404, "NOT_FOUND") },
      [...ADV, { id: "7000000000002", name: "Other ads" }],
    );
    await click(button("Choose a pixel"));
    const adv = host.querySelector('select[aria-label="TikTok advertiser"]') as HTMLSelectElement;
    expect([...adv.options].map((o) => o.textContent)).toEqual(["Shop ads", "Other ads"]);
    await pick(adv, "7000000000002");
    expect(h.get).toHaveBeenCalledWith("/v1/tiktok/ads/pixels?advertiserId=7000000000002");
  });

  it("a refused save shows the api's sentence and keeps the picker open", async () => {
    await mount({ selected: nothing, pixels: { pixels: [{ code: "PX1" }], truncated: false }, feedError: apiError(404, "NOT_FOUND") });
    h.put.mockRejectedValue(apiError(400, "PIXEL_NOT_FOUND", "That pixel does not belong to this advertiser."));
    await click(button("Choose a pixel"));
    await pick(host.querySelector('select[aria-label="TikTok pixel"]') as HTMLSelectElement, "PX1");
    await click(button("Save choice"));
    expect(host.querySelector('[data-testid="tiktok-save-error"]')?.textContent).toBe("That pixel does not belong to this advertiser.");
    expect(host.querySelector('[data-testid="tiktok-pixel-picker"]')).not.toBeNull();
  });

  it("permission error while listing: the fixed sentence and Reconnect", async () => {
    await mount({ selected: nothing, pixelsError: apiError(409, "TIKTOK_PERMISSION"), feedError: apiError(404, "NOT_FOUND") });
    await click(button("Choose a pixel"));
    expect(host.querySelector('[data-testid="tiktok-permission"]')?.textContent).toContain("missing a permission");
    await click(button("Reconnect TikTok"));
    expect(reconnect).toHaveBeenCalledTimes(1);
  });
});

describe("catalog feed", () => {
  const nothing = { sending: false, reason: "no_pixel_selected", message: "none" };
  const feedSection = () => host.querySelector('[data-testid="tiktok-feed"]');

  it("off: offers Create feed URL, and creating shows the URL with Copy", async () => {
    const world: World = { selected: nothing, feed: feedOff };
    await mount(world);
    expect(feedSection()?.textContent).toContain("Product feed for TikTok catalog ads");
    expect(feedSection()?.textContent).toContain("TikTok Catalog Manager");
    h.post.mockImplementation(async () => {
      world.feed = { enabled: true, url: null, createdAt: "2026-11-21T00:00:00.000Z", rotatedAt: null, lastFetchedAt: null, itemCount: 12 };
      return { enabled: true, url: "https://feeds.example/t/abc123", createdAt: "2026-11-21T00:00:00.000Z" };
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await click(button("Create feed URL"));
    expect((host.querySelector('[data-testid="tiktok-feed-url"]') as HTMLInputElement).value).toBe("https://feeds.example/t/abc123");
    expect(button("Rotate URL")).toBeTruthy();
    expect(button("Turn off")).toBeTruthy();
    expect(feedSection()?.textContent).toContain("12 products in the feed");
    await click(button("Copy"));
    expect(writeText).toHaveBeenCalledWith("https://feeds.example/t/abc123");
    expect(button("Copied")).toBeTruthy();
  });

  it("copy without clipboard access falls back to selecting the text", async () => {
    await mount({ selected: nothing, feed: feedOff });
    h.post.mockResolvedValue({ enabled: true, url: "https://feeds.example/t/zzz" });
    h.get.mockImplementation(async (p: string) => (p.includes("catalog-feed") ? { enabled: true, url: null } : p.includes("selected") ? nothing : { members: [] }));
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    await click(button("Create feed URL"));
    await click(button("Copy"));
    expect(feedSection()?.textContent).toContain("Copy failed. Select the link and copy it yourself.");
  });

  it("the URL is shown once: a re-read never brings it back", async () => {
    await mount({ selected: nothing, feed: { enabled: true, url: null, itemCount: 3 } });
    expect(host.querySelector('[data-testid="tiktok-feed-url"]')).toBeNull();
    expect(feedSection()?.textContent).toContain("Rotate the URL to get a new one.");
  });

  it("rotate: shows the new URL and says the old one stops working", async () => {
    await mount({ selected: nothing, feed: { enabled: true, url: null } });
    h.post.mockResolvedValue({ enabled: true, url: "https://feeds.example/t/new" });
    expect(feedSection()?.textContent).toContain("The old one stops working");
    await click(button("Rotate URL"));
    expect((host.querySelector('[data-testid="tiktok-feed-url"]') as HTMLInputElement).value).toBe("https://feeds.example/t/new");
    expect(h.post).toHaveBeenCalledWith("/v1/tiktok/ads/catalog-feed", {});
  });

  it("turn off: calls DELETE, drops the URL and goes back to Create", async () => {
    const world: World = { selected: nothing, feed: { enabled: true, url: null } };
    await mount(world);
    h.post.mockResolvedValue({ enabled: true, url: "https://feeds.example/t/new" });
    await click(button("Rotate URL"));
    h.del.mockImplementation(async () => {
      world.feed = feedOff;
      return {};
    });
    await click(button("Turn off"));
    expect(h.del).toHaveBeenCalledWith("/v1/tiktok/ads/catalog-feed");
    expect(host.querySelector('[data-testid="tiktok-feed-url"]')).toBeNull();
    expect(button("Create feed URL")).toBeTruthy();
  });

  it("a failed change says so in plain words", async () => {
    await mount({ selected: nothing, feed: feedOff });
    h.post.mockRejectedValue(apiError(500, "X", "stack trace"));
    await click(button("Create feed URL"));
    expect(feedSection()?.textContent).toContain("We could not change the feed. Try again.");
    expect(feedSection()?.textContent).not.toContain("stack trace");
  });

  it("hidden quietly when the route 404s (api not deployed), and the pixel part still works", async () => {
    await mount({ selected: nothing, feedError: apiError(404, "NOT_FOUND") });
    expect(feedSection()).toBeNull();
    expect(text()).not.toContain("Product feed");
    expect(button("Choose a pixel")).toBeTruthy();
    // a 404 is not retried
    expect(h.get.mock.calls.filter(([p]) => String(p).includes("catalog-feed")).length).toBe(1);
  });
});

describe("tiktokAdvertisers", () => {
  it("reads the grant's ad accounts from the integration row, falling back to the id as the name", () => {
    expect(tiktokAdvertisers({ adAccounts: [{ id: 1, name: "A" }, { id: "2" }, { name: "no id" }] })).toEqual([
      { id: "1", name: "A" },
      { id: "2", name: "2" },
    ]);
    expect(tiktokAdvertisers(undefined)).toEqual([]);
  });
});
