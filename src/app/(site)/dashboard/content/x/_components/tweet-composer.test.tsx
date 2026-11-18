// @vitest-environment jsdom
/**
 * MR-X1: the X composer's price line and its send gate. Publish and Schedule are off while the api's quote refuses (a link while links
 * are off, too few Peaks), while there is no quote for the text on screen, and when the quote failed (said, with a retry). A refetch in
 * the background with a quote in hand blocks nothing. "Turn on posts with links" opens the Yes / No dialog.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { XPostQuote, XPostingStatus } from "@/lib/x-posting";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), quote: vi.fn() }));
vi.mock("@/lib/api", () => ({
  api: { get: h.get, put: h.put, post: h.post },
  ApiError: class ApiError extends Error {},
  API_BASE_URL: "https://api.example",
}));
vi.mock("@/lib/api/x", () => ({ xApi: { quote: h.quote, publish: vi.fn() }, extractTweetId: () => undefined }));
vi.mock("@/lib/api/content", () => ({
  rewriteContent: vi.fn(),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  getVoiceCards: vi.fn(async () => []),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/scheduler/scheduler-composer", () => ({ SchedulerComposer: () => null }));
vi.mock("@/components/composer", () => ({
  AiComposeToolbar: () => null,
  ComposerCommandPalette: () => null,
  DraftSaver: () => null,
  EmojiPickerTrigger: () => null,
  HashtagSuggest: () => null,
  PlatformCharCounter: () => null,
  useDraftSaver: () => ({ status: "idle", lastSavedAt: null, lastError: null, saveNow: vi.fn() }),
  // the real shell lays these slots out; here they are simply rendered, so the composer's own buttons and notices are what is tested
  ComposerShell: (p: { toolbarSlot?: ReactNode; actionsSlot?: ReactNode; footerSlot?: ReactNode; children?: ReactNode }) => (
    <div>
      {p.children}
      {p.toolbarSlot}
      {p.actionsSlot}
      {p.footerSlot}
    </div>
  ),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { TweetComposer } = await import("./tweet-composer");

const posting: XPostingStatus = { connected: true, connectionId: "c1", prices: { plain: 20, link: 240 }, linksEnabled: false };
const allowed = (total: number, hasLink = false): XPostQuote => ({ allowed: true, total, posts: [{ hasLink, peaks: total }] });
const refused = (reason: string, message: string): XPostQuote => ({ allowed: false, reason, message, total: 240, posts: [{ hasLink: true, peaks: 240 }] });

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  h.get.mockImplementation(async (url: string) => (url.includes("/posting") ? posting : []));
  h.put.mockResolvedValue({ ...posting, linksEnabled: true });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  vi.useRealTimers();
  Object.values(h).forEach((m) => m.mockReset());
});

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <TweetComposer />
      </QueryClientProvider>,
    );
  });
}
const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
async function type(text: string) {
  const ta = host.querySelector("textarea")!;
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    set.call(ta, text);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush(500); // past the 400 ms debounce
  await flush();
  await flush();
}
const btn = (label: RegExp | string) => [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((b) => (typeof label === "string" ? b.textContent === label : label.test(b.textContent ?? "")));
const publish = () => btn(/^Publish/)!;
const schedule = () => btn(/Schedule/)!;

describe("the X composer's send gate", () => {
  it("a plain post: the cost line shows and Publish and Schedule are on", async () => {
    h.quote.mockResolvedValue(allowed(20));
    await mount();
    await type("hello");
    expect(host.querySelector('[data-testid="x-post-cost"]')!.textContent).toBe("This post costs 20 Peaks.");
    expect(publish().disabled).toBe(false);
    expect(schedule().disabled).toBe(false);
  });
  it("a post with a link while links are off: refused with the api's words, Publish and Schedule off", async () => {
    h.quote.mockResolvedValue(refused("x_link_held", "This post has a link, and posts with links are off for X. X charges more for them: 240 Peaks for this post."));
    await mount();
    await type("see https://peakhour.ai");
    expect(host.querySelector('[data-testid="x-link-refused"]')!.textContent).toContain("240 Peaks");
    expect(publish().disabled).toBe(true);
    expect(schedule().disabled).toBe(true);
  });
  it("too few Peaks: said, and Publish and Schedule off", async () => {
    h.quote.mockResolvedValue(refused("x_no_peaks", "You need 20 Peaks to post this on X, and you do not have enough. Add Peaks, then post it again."));
    await mount();
    await type("hello");
    expect(host.querySelector('[data-testid="x-quote-blocked"]')!.textContent).toContain("do not have enough");
    expect(publish().disabled).toBe(true);
    expect(schedule().disabled).toBe(true);
  });
  it("no quote yet for the text on screen: nothing goes until it arrives", async () => {
    let release!: (q: XPostQuote) => void;
    h.quote.mockReturnValue(new Promise<XPostQuote>((r) => (release = r)));
    await mount();
    await type("hello");
    expect(publish().disabled).toBe(true);
    await act(async () => release(allowed(20)));
    await flush();
    expect(publish().disabled).toBe(false);
  });
  it("a quote that failed is said, blocks, and Try again asks again", async () => {
    h.quote.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(allowed(20));
    await mount();
    await type("hello");
    expect(host.querySelector('[data-testid="x-quote-failed"]')!.textContent).toContain("Couldn't check this post's price. Try again.");
    expect(publish().disabled).toBe(true);
    expect(schedule().disabled).toBe(true);
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="x-quote-failed"] button')!.click();
    });
    await flush();
    await flush();
    expect(host.querySelector('[data-testid="x-quote-failed"]')).toBeNull();
    expect(publish().disabled).toBe(false);
  });
  it("a refetch in the background with a quote in hand does not grey the buttons", async () => {
    h.quote.mockResolvedValue(allowed(20));
    await mount();
    await type("hello");
    expect(publish().disabled).toBe(false);
    h.quote.mockReturnValue(new Promise(() => undefined)); // the next request hangs
    // the same text again triggers nothing new; a window-focus style refetch is what runs in the background
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await flush();
    expect(publish().disabled).toBe(false);
  });
  it("Turn on posts with links asks Yes / No first; No saves nothing, Yes turns it on", async () => {
    h.quote.mockResolvedValue(refused("x_link_held", "links are off"));
    await mount();
    await type("see https://peakhour.ai");
    await act(async () => {
      btn("Turn on posts with links")!.click();
    });
    await flush();
    const dialog = document.body.querySelector('[data-testid="x-links-confirm"]')!;
    expect(dialog.textContent).toContain("Turn on posts with links?");
    expect(dialog.textContent).toContain("240 Peaks");
    expect(h.put).not.toHaveBeenCalled();
    await act(async () => {
      btn("No")!.click();
    });
    await flush();
    expect(h.put).not.toHaveBeenCalled();
    expect(document.body.querySelector('[data-testid="x-links-confirm"]')).toBeNull();
    await act(async () => {
      btn("Turn on posts with links")!.click();
    });
    await flush();
    await act(async () => {
      btn("Yes")!.click();
    });
    await flush();
    expect(h.put).toHaveBeenCalledWith("/v1/x/content/posting/links", { enabled: true });
  });
});
