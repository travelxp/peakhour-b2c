// @vitest-environment jsdom
/**
 * MR-H1: the Facebook Page card on Growth > Ads > Meta. A Page picker (saved Page first, a Page without the advertise permission
 * disabled with why), the ads that have run from the Page, and "Promote a post".
 *
 * The api client is faked; the screen's use of it is what is tested.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  listPages: vi.fn(),
  listPageAdsPosts: vi.fn(),
  listPagePosts: vi.fn(),
}));

vi.mock("@/lib/api/meta-ads", async (orig) => {
  const actual = await orig<typeof import("@/lib/api/meta-ads")>();
  return {
    ...actual,
    metaAdsApi: {
      ...actual.metaAdsApi,
      listPages: mocks.listPages,
      listPageAdsPosts: mocks.listPageAdsPosts,
      listPagePosts: mocks.listPagePosts,
    },
  };
});

import { ApiError } from "@/lib/api";
import { MetaPagesCard } from "./meta-pages-card";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = () => undefined;
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => undefined;
});

const SAVED = { id: "9001", name: "Corner Shop", canAdvertise: true, isSaved: true };
const OTHER = { id: "9002", name: "Second Page", canAdvertise: true, isSaved: false };
const LOCKED = { id: "9003", name: "Not Mine", canAdvertise: false, isSaved: false };
const POST = {
  id: "9001_77",
  message: "Big sale this weekend",
  createdTime: "2026-11-01T10:00:00+0000",
  pictureUrl: "https://cdn.example/x.jpg",
  permalinkUrl: "https://facebook.com/9001/posts/77",
};

let root: Root;
let host: HTMLElement;

// The Page list is read first, then the Page's ads behind it: settle both hops.
const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
};

import { useState } from "react";

/** The panel holds the picked Page; this stand-in does the same, and reports each pick. */
function Harness({ onPromote, onPick }: { onPromote: () => void; onPick: (id: string) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <MetaPagesCard
      businessId="b1"
      pickedPageId={picked}
      onPick={(id) => {
        setPicked(id);
        onPick(id);
      }}
      onPromote={onPromote}
    />
  );
}

function mount(onPromote = vi.fn(), onPick = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness onPromote={onPromote} onPick={onPick} />
      </QueryClientProvider>,
    );
  });
  return onPromote;
}

const q = <T extends Element = HTMLElement>(sel: string) => document.body.querySelector<T>(sel);
const byText = (sel: string, text: string | RegExp) =>
  [...document.body.querySelectorAll<HTMLElement>(sel)].find((e) =>
    typeof text === "string" ? e.textContent?.trim() === text : text.test(e.textContent ?? ""),
  );
const click = (el: Element | undefined | null) => {
  expect(el).toBeTruthy();
  act(() => {
    (el as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.listPages.mockResolvedValue({ pages: [SAVED, OTHER, LOCKED], savedPageId: "9001" });
  mocks.listPageAdsPosts.mockResolvedValue({ posts: [], truncated: false });
  mocks.listPagePosts.mockResolvedValue({ posts: [POST], truncated: false });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("Facebook Page card", () => {
  it("defaults to the saved Page and reads that Page's ads", async () => {
    mount();
    await flush();
    expect(q("#mp-page")?.textContent).toContain("Corner Shop");
    expect(mocks.listPageAdsPosts).toHaveBeenCalledWith("9001");
    expect(mocks.listPagePosts).not.toHaveBeenCalled();
  });

  it("lists every Page, with one the person cannot advertise for disabled and the reason beside it", async () => {
    mount();
    await flush();
    click(q("#mp-page"));
    await flush();
    const options = [...document.body.querySelectorAll('[role="option"]')];
    expect(options.map((o) => o.textContent)).toEqual([
      "Corner Shop · saved",
      "Second Page",
      "Not Mine · you can't run ads as this Page",
    ]);
    expect(options[2]!.getAttribute("aria-disabled") ?? options[2]!.getAttribute("data-disabled")).not.toBeNull();
  });

  it("reads the ads of the Page that was picked", async () => {
    mount();
    await flush();
    click(q("#mp-page"));
    await flush();
    click([...document.body.querySelectorAll('[role="option"]')][1]);
    await flush();
    expect(mocks.listPageAdsPosts).toHaveBeenLastCalledWith("9002");
  });

  it("tells the panel which Page was picked, so New campaign can start on it", async () => {
    const onPick = vi.fn();
    mount(vi.fn(), onPick);
    await flush();
    click(q("#mp-page"));
    await flush();
    click([...document.body.querySelectorAll('[role="option"]')][1]);
    await flush();
    expect(onPick).toHaveBeenCalledWith("9002");
  });

  it("falls to the first Page that can advertise when the saved Page cannot", async () => {
    mocks.listPages.mockResolvedValue({ pages: [{ ...SAVED, canAdvertise: false }, OTHER], savedPageId: "9001" });
    mount();
    await flush();
    expect(q("#mp-page")?.textContent).toContain("Second Page");
    expect(mocks.listPageAdsPosts).toHaveBeenCalledWith("9002");
  });

  it("says plainly when no ads have run from the Page", async () => {
    mount();
    await flush();
    expect(document.body.textContent).toContain("No ads have run from this Page yet.");
  });

  it("shows each ad with its text, date and a link, and nothing that looks like a token", async () => {
    mocks.listPageAdsPosts.mockResolvedValue({ posts: [POST], truncated: false });
    mount();
    await flush();
    const row = q('[data-testid="page-post-row"]')!;
    expect(row.textContent).toContain("Big sale this weekend");
    expect(row.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/x.jpg");
    expect(row.querySelector("a")?.getAttribute("href")).toBe("https://facebook.com/9001/posts/77");
    expect(row.textContent).toMatch(/2026/);
  });

  it("does not make a link out of anything but a web address", async () => {
    mocks.listPageAdsPosts.mockResolvedValue({ posts: [{ ...POST, permalinkUrl: "javascript:alert(1)" }], truncated: false });
    mount();
    await flush();
    expect(q('[data-testid="page-post-row"] a')).toBeNull();
  });

  it("when no Page can run ads, says so and reads nothing", async () => {
    mocks.listPages.mockResolvedValue({ pages: [LOCKED], savedPageId: null });
    mount();
    await flush();
    expect(document.body.textContent).toContain("None of your Facebook Pages lets you run ads");
    expect(mocks.listPageAdsPosts).not.toHaveBeenCalled();
  });

  it("says so when the login has no Page at all", async () => {
    mocks.listPages.mockResolvedValue({ pages: [], savedPageId: null });
    mount();
    await flush();
    expect(document.body.textContent).toContain("has no Facebook Page");
  });

  it("shows Meta's own words for a permission refusal, never the raw error", async () => {
    mocks.listPageAdsPosts.mockRejectedValue(
      new ApiError("PAGE_PERMISSION_MISSING", "Meta didn't allow Peakhour to use this Facebook Page for ads. Reconnect Meta and approve Page advertising.", 403),
    );
    mount();
    await flush();
    expect(document.body.textContent).toContain("approve Page advertising");
  });

  it("does not read the posts until the person asks, then Promote hands the post and its Page on", async () => {
    const onPromote = mount();
    await flush();
    expect(mocks.listPagePosts).not.toHaveBeenCalled();
    click(byText("button", "Choose a post to promote"));
    await flush();
    expect(mocks.listPagePosts).toHaveBeenCalledWith("9001");
    click(byText("button", "Promote"));
    expect(onPromote).toHaveBeenCalledWith("9001", POST);
  });

  it("says when the Page has no posts to promote", async () => {
    mocks.listPagePosts.mockResolvedValue({ posts: [], truncated: false });
    mount();
    await flush();
    click(byText("button", "Choose a post to promote"));
    await flush();
    expect(document.body.textContent).toContain("no posts to promote");
  });
});
