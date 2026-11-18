// @vitest-environment jsdom
/**
 * Posting to X in Peaks (MR-X1): the X card shows both prices from the api, the "Posts with links" switch starts off, turning it ON asks
 * first (Yes / No) and turning it OFF does not; the composer's price line and the held post's two choices.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import type { XPostingStatus } from "@/lib/x-posting";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { get: h.get, post: h.post, put: h.put }, API_BASE_URL: "https://api.example" }));
vi.mock("@/lib/scheduler/client", () => ({ scheduler: { resolveXLink: h.resolve } }));

const { XPostingCard } = await import("./x-posting-card");
const { XLinkHeldView, isHeldForLink } = await import("@/components/scheduler/x-link-held");
const lib = await import("@/lib/x-posting");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const status = (over: Partial<XPostingStatus> = {}): XPostingStatus => ({
  connected: true,
  connectionId: "c1",
  prices: { plain: 20, link: 240 },
  linksEnabled: false,
  ...over,
});

let root: Root;
let host: HTMLElement;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  h.get.mockReset();
  h.put.mockReset();
  h.resolve.mockReset();
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
async function settle(times = 4) {
  for (let i = 0; i < times; i++) await flush();
}

async function mount(initial: XPostingStatus) {
  let current = initial;
  h.get.mockImplementation(async () => current);
  h.put.mockImplementation(async (_url: string, body: { enabled: boolean }) => {
    current = { ...current, linksEnabled: body.enabled };
    return current;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <XPostingCard />
      </QueryClientProvider>,
    );
  });
  await settle();
}
const sw = () => host.querySelector<HTMLButtonElement>("#x-post-links")!;
const dialog = () => document.body.querySelector<HTMLElement>('[data-testid="x-links-confirm"]');
const button = (label: string) => [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label);
const click = async (el: HTMLElement | undefined) => {
  await act(async () => {
    el!.click();
  });
  await settle();
};

describe("the X card", () => {
  it("shows both prices, read from the api", async () => {
    await mount(status());
    expect(host.querySelector('[data-testid="x-posting-prices"]')!.textContent).toBe("Posts: 20 Peaks each. Posts with a link: 240 Peaks each.");
  });
  it("follows the rate card: other numbers read as those numbers", async () => {
    await mount(status({ prices: { plain: 25, link: 300 } }));
    expect(host.textContent).toContain("Posts: 25 Peaks each. Posts with a link: 300 Peaks each.");
    expect(host.textContent).not.toContain("240");
  });
  it("posts with links start OFF", async () => {
    await mount(status());
    expect(sw().getAttribute("aria-checked")).toBe("false");
    expect(host.textContent).toContain("Off");
  });
  it("turning it ON opens the confirmation with the price, and nothing is saved yet", async () => {
    await mount(status());
    await click(sw());
    expect(dialog()).not.toBeNull();
    expect(dialog()!.textContent).toContain("Turn on posts with links?");
    expect(dialog()!.textContent).toContain("240 Peaks");
    expect(button("Yes")).toBeDefined();
    expect(button("No")).toBeDefined();
    expect(h.put).not.toHaveBeenCalled();
  });
  it("No leaves it off and saves nothing", async () => {
    await mount(status());
    await click(sw());
    await click(button("No"));
    expect(dialog()).toBeNull();
    expect(h.put).not.toHaveBeenCalled();
    expect(sw().getAttribute("aria-checked")).toBe("false");
  });
  it("Yes turns it on", async () => {
    await mount(status());
    await click(sw());
    await click(button("Yes"));
    expect(h.put).toHaveBeenCalledWith("/v1/x/content/posting/links", { enabled: true });
    expect(sw().getAttribute("aria-checked")).toBe("true");
  });
  it("turning it OFF asks nothing", async () => {
    await mount(status({ linksEnabled: true }));
    await click(sw());
    expect(dialog()).toBeNull();
    expect(h.put).toHaveBeenCalledWith("/v1/x/content/posting/links", { enabled: false });
    expect(sw().getAttribute("aria-checked")).toBe("false");
  });
  it("not connected: say so, no switch", async () => {
    await mount(status({ connected: false, connectionId: null }));
    expect(host.textContent).toContain("Connect your X account first");
    expect(sw()).toBeNull();
  });
});

describe("the wording", () => {
  it("a missing price is said, never shown as free", () => {
    expect(lib.priceLine({ plain: null, link: null })).toBeNull();
    expect(lib.priceLine({ plain: 20, link: null })).toBe("Posts: 20 Peaks each. Posts with a link: price not set.");
  });
  it("1 is singular", () => expect(lib.peaksWord(1)).toBe("1 Peak"));
  it("the composer says what the post costs: plain, with a link, and a thread", () => {
    expect(lib.postCostLine({ total: 20, posts: [{ hasLink: false, peaks: 20 }] })).toBe("This post costs 20 Peaks.");
    expect(lib.postCostLine({ total: 240, posts: [{ hasLink: true, peaks: 240 }] })).toBe("This post costs 240 Peaks: it has a link.");
    expect(
      lib.postCostLine({ total: 260, posts: [{ hasLink: false, peaks: 20 }, { hasLink: true, peaks: 240 }] }),
    ).toBe("This thread costs 260 Peaks (2 posts). 1 post has a link.");
    expect(lib.postCostLine(undefined)).toBeNull();
    expect(lib.postCostLine({ total: null, posts: [{ hasLink: false, peaks: null }] })).toBeNull();
  });
});

describe("a held post: two choices", () => {
  it("says what the choices are and what the second costs", () => {
    const out = renderToStaticMarkup(<XLinkHeldView linkPeaks={240} busy={false} error={null} onChoose={() => {}} />);
    expect(out).toContain("Post without the link");
    expect(out).toContain("Post with the link: 240 Peaks");
    expect(out).toContain("for this post only");
  });
  it("with no link price, 'with the link' cannot be chosen", () => {
    const out = renderToStaticMarkup(<XLinkHeldView linkPeaks={null} busy={false} error={null} onChoose={() => {}} />);
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Post with the link<\/button>/);
  });
  it("only an X post held for exactly this reason shows them", () => {
    const item = { channel: "x", status: "needs_action", attempts: [{ errorCode: lib.X_LINK_HELD_CODE }] };
    expect(isHeldForLink(item, lib.X_LINK_HELD_CODE)).toBe(true);
    expect(isHeldForLink({ ...item, channel: "linkedin" }, lib.X_LINK_HELD_CODE)).toBe(false);
    expect(isHeldForLink({ ...item, status: "ready" }, lib.X_LINK_HELD_CODE)).toBe(false);
    expect(isHeldForLink({ ...item, attempts: [{ errorCode: "auth_token_expired" }] }, lib.X_LINK_HELD_CODE)).toBe(false);
  });
});
