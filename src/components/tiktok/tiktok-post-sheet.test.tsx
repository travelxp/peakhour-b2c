// @vitest-environment jsdom
/**
 * The TikTok post sheet, driven as a person sees it: the account, the preview, privacy with no default, the switches, commercial content,
 * the declaration, the length limit, and a Post button that answers on screen and sends nothing.
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
const h = vi.hoisted(() => ({ list: vi.fn(), creatorInfo: vi.fn(), post: vi.fn(), get: vi.fn(), commit: vi.fn(), edit: vi.fn(), resched: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { post: h.post, get: h.get }, ApiError: FakeApiError, API_BASE_URL: "https://api.example" }));
vi.mock("@/lib/api/tiktok-content", () => ({ tiktokContentApi: { creatorInfo: h.creatorInfo } }));
vi.mock("@/lib/scheduler/client", () => ({
  scheduler: { listItems: h.list, commitPlan: h.commit, publishItemNow: h.publish, editItemPayload: h.edit, rescheduleItem: h.resched },
}));

const { TikTokPostSheet } = await import("./tiktok-post-sheet");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CREATOR = {
  nickname: "Acme Bakes",
  avatarUrl: "https://cdn/a.jpg",
  privacyLevelOptions: ["PUBLIC_TO_EVERYONE", "FOLLOWER_OF_CREATOR", "SELF_ONLY"],
  commentDisabled: false,
  duetDisabled: false,
  stitchDisabled: false,
  maxVideoPostDurationSec: 300,
};
const ITEM = (mediaUrls: string[], mediaType: string) =>
  ({
    _id: "item1",
    status: "queued",
    createdAt: "2026-11-23T10:00:00.000Z",
    payload: { text: "Fresh loaves today", mediaUrls, channelOptions: { mediaType } },
  }) as never;
const VIDEO = ITEM(["https://cdn/v.mp4"], "video");
const PHOTOS = ITEM(["https://cdn/1.jpg", "https://cdn/2.jpg"], "photo");

let host: HTMLDivElement;
let root: Root;
const q = (sel: string) => document.body.querySelector(sel);
const text = () => document.body.textContent ?? "";
const postButton = () => [...document.body.querySelectorAll("button")].find((b) => b.textContent === "Post") as HTMLButtonElement;
const select = () => document.body.querySelector("select") as HTMLSelectElement;
const sw = (label: string) => document.body.querySelector(`[role="switch"][id$="-${label}"]`) as HTMLButtonElement | null;

async function mount(item: unknown = VIDEO) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <TikTokPostSheet item={item as never} onOpenChange={() => {}} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
// The sheet beside the list it belongs to, as on the TikTok page.
vi.mock("@/hooks/use-locale", () => ({ useLocale: () => ({ formatDate: (d: Date) => d.toISOString().slice(0, 10) }) }));
async function mountWithList(item: unknown) {
  const { useTikTokItems } = await import("@/hooks/use-tiktok-content");
  const { TikTokStatusList } = await import("./tiktok-status-list");
  function Harness() {
    const items = useTikTokItems(true);
    return (
      <>
        <TikTokStatusList items={items.data?.items ?? []} />
        <TikTokPostSheet item={item as never} onOpenChange={() => {}} />
      </>
    );
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}
async function click(el: Element | null) {
  await act(async () => {
    (el as HTMLElement).click();
  });
}
async function knowLength(seconds: number) {
  const video = q("video") as HTMLVideoElement;
  Object.defineProperty(video, "duration", { value: seconds, configurable: true });
  await act(async () => {
    video.dispatchEvent(new Event("loadedmetadata"));
  });
}
async function choose(value: string) {
  await act(async () => {
    const el = select();
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  h.creatorInfo.mockReset().mockResolvedValue(CREATOR);
  h.post.mockReset();
  h.get.mockReset();
  h.commit.mockReset();
  h.edit.mockReset().mockResolvedValue({});
  h.resched.mockReset().mockResolvedValue({});
  h.publish.mockReset().mockResolvedValue({ published: false });
  h.list.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("TikTokPostSheet", () => {
  it("loads creator-info and shows the account that will post, with the preview and caption", async () => {
    await mount();
    expect(h.creatorInfo).toHaveBeenCalledTimes(1);
    expect(q('[data-testid="tiktok-creator"]')?.textContent).toContain("Acme Bakes");
    expect(q('[data-testid="tiktok-creator"] img')?.getAttribute("src")).toBe("https://cdn/a.jpg");
    expect(q("video")?.getAttribute("src")).toBe("https://cdn/v.mp4");
    expect(q('[data-testid="tiktok-caption"]')?.textContent).toBe("Fresh loaves today");
  });

  it("has no privacy level chosen, and Post stays disabled until one is", async () => {
    await mount();
    await knowLength(60);
    expect(select().value).toBe("");
    expect(postButton().disabled).toBe(true);
    await choose("PUBLIC_TO_EVERYONE");
    expect(postButton().disabled).toBe(false);
  });

  it("builds the privacy choices from creator-info only", async () => {
    await mount();
    const labels = [...select().querySelectorAll("option")].map((o) => o.textContent);
    expect(labels).toEqual(["Choose who can see this post", "Everyone", "Followers", "Only me"]);
  });

  it("starts with comments, Duet and Stitch off", async () => {
    await mount();
    for (const id of ["comments", "duet", "stitch"]) expect(sw(id)?.getAttribute("aria-checked")).toBe("false");
  });

  it("disables and explains a switch the creator has turned off", async () => {
    h.creatorInfo.mockResolvedValue({ ...CREATOR, commentDisabled: true, duetDisabled: true });
    await mount();
    expect(sw("comments")?.disabled).toBe(true);
    expect(sw("duet")?.disabled).toBe(true);
    expect(sw("stitch")?.disabled).toBe(false);
    expect(text()).toContain("Comments are turned off in your TikTok account settings");
    expect(text()).toContain("Duet is turned off in your TikTok account settings");
  });

  it("hides Duet and Stitch for a photo post", async () => {
    await mount(PHOTOS);
    expect(sw("comments")).not.toBeNull();
    expect(sw("duet")).toBeNull();
    expect(sw("stitch")).toBeNull();
    expect(document.body.querySelectorAll("ul[aria-label='Photos in this post'] img")).toHaveLength(2);
  });

  it("commercial content: off by default, label preview, and the Branded Content Policy line only for branded content", async () => {
    await mount();
    expect(sw("commercial")?.getAttribute("aria-checked")).toBe("false");
    expect(q('[data-testid="tiktok-label-preview"]')).toBeNull();
    expect(q('[data-testid="tiktok-declaration"]')?.textContent).toContain("Music Usage Confirmation");
    expect(q('[data-testid="tiktok-declaration"]')?.textContent).not.toContain("Branded Content Policy");

    await knowLength(60);
    await click(sw("commercial"));
    await choose("PUBLIC_TO_EVERYONE");
    // switched on with no kind chosen: Post stays disabled
    expect(postButton().disabled).toBe(true);
    await click(q('[id$="-your-brand"]'));
    expect(q('[data-testid="tiktok-label-preview"]')?.textContent).toContain("Promotional content");
    expect(postButton().disabled).toBe(false);

    await click(q('[id$="-branded"]'));
    expect(q('[data-testid="tiktok-label-preview"]')?.textContent).toContain("Paid partnership");
    expect(q('[data-testid="tiktok-declaration"]')?.textContent).toContain("Branded Content Policy");
    const links = [...document.body.querySelectorAll('[data-testid="tiktok-declaration"] a')].map((a) => a.getAttribute("href"));
    expect(links.every((l) => l?.startsWith("https://www.tiktok.com/"))).toBe(true);
  });

  it("branded content cannot be private: Only me is disabled and explained, and turning it on clears a chosen Only me", async () => {
    await mount();
    await knowLength(60);
    await choose("SELF_ONLY");
    expect(select().value).toBe("SELF_ONLY");
    await click(sw("commercial"));
    await click(q('[id$="-branded"]'));
    const onlyMe = [...select().querySelectorAll("option")].find((o) => o.textContent === "Only me")!;
    expect(onlyMe.disabled).toBe(true);
    expect(select().value).toBe("");
    expect(text()).toContain("not available for branded content");
    expect(postButton().disabled).toBe(true);
  });

  it("a video longer than the account's limit says so in the problems list and disables Post", async () => {
    await mount();
    await choose("PUBLIC_TO_EVERYONE");
    await knowLength(301);
    expect(q('[data-problem="duration"]')?.textContent).toContain("up to 300 seconds");
    expect(postButton().disabled).toBe(true);
  });

  it("keeps Post off until the video's length is known, and says so when the video cannot be read", async () => {
    await mount();
    await choose("PUBLIC_TO_EVERYONE");
    expect(postButton().disabled).toBe(true);
    expect(q('[data-problem="duration_unknown"]')?.textContent).toContain("Checking the length");
    await act(async () => {
      (q("video") as HTMLVideoElement).dispatchEvent(new Event("error"));
    });
    expect(postButton().disabled).toBe(true);
    expect(q('[data-problem="duration_unknown"]')?.textContent).toContain("could not read this video");
  });

  it("always draws the problems list, and the button's aria-describedby points at it", async () => {
    await mount(PHOTOS);
    const describedBy = () => postButton().getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy())).not.toBeNull();
    expect(q('[data-testid="tiktok-problems"]')?.textContent).toContain("Choose who can see this post");
    await choose("PUBLIC_TO_EVERYONE");
    expect(document.getElementById(describedBy())).not.toBeNull();
    expect(q('[data-testid="tiktok-problems"]')?.textContent).toBe("");
  });

  it("turning on Branded content clears a chosen Only me", async () => {
    await mount(PHOTOS);
    await choose("SELF_ONLY");
    await click(sw("commercial"));
    await click(q('[id$="-your-brand"]'));
    expect(select().value).toBe("SELF_ONLY"); // your brand alone may be private
    await click(q('[id$="-branded"]'));
    expect(select().value).toBe("");
  });

  it("Post saves the choices on the item, schedules it for now, then shows the coming-soon message; it never publishes", async () => {
    h.creatorInfo.mockResolvedValue({ ...CREATOR, duetDisabled: true });
    await mount();
    await knowLength(60);
    await choose("FOLLOWER_OF_CREATOR");
    await click(sw("comments"));
    await click(sw("stitch"));
    await click(sw("commercial"));
    await click(q('[id$="-your-brand"]'));
    await click(postButton());
    expect(h.edit).toHaveBeenCalledWith("item1", {
      channelOptions: {
        privacyLevel: "FOLLOWER_OF_CREATOR",
        allowComment: true,
        allowDuet: false,
        allowStitch: true,
        brandOrganic: true,
        brandedContent: false,
      },
    });
    expect(h.resched).toHaveBeenCalledTimes(1);
    expect(h.resched.mock.calls[0][0]).toBe("item1");
    expect(h.resched.mock.calls[0][1].mode).toBe("item");
    // saved before it is scheduled
    expect(h.edit.mock.invocationCallOrder[0]).toBeLessThan(h.resched.mock.invocationCallOrder[0]);
    expect(q('[data-testid="tiktok-coming-soon"]')?.textContent).toBe(
      "TikTok integration is coming soon. Your post is saved and will publish once TikTok approves Peakhour.",
    );
    // then the worker's own publish path runs once, after the reschedule, so the api parks it at once
    expect(h.publish).toHaveBeenCalledTimes(1);
    expect(h.publish).toHaveBeenCalledWith("item1");
    expect(h.resched.mock.invocationCallOrder[0]).toBeLessThan(h.publish.mock.invocationCallOrder[0]);
    expect(h.post).not.toHaveBeenCalled();
    expect(h.commit).not.toHaveBeenCalled();
    expect(text()).not.toMatch(/published|is live|posted successfully/i);
  });

  it("if publish-now refuses, the coming-soon message still shows and no error is shown", async () => {
    h.publish.mockRejectedValue(new Error("409 queued to retry"));
    await mount(PHOTOS);
    await choose("PUBLIC_TO_EVERYONE");
    await click(postButton());
    expect(q('[data-testid="tiktok-coming-soon"]')).not.toBeNull();
    expect(q('[role="alert"]')).toBeNull();
    expect(text()).not.toContain("409");
  });

  it("right after Post, the item is refetched and its status reads Waiting for TikTok approval", async () => {
    const parked = { ...(PHOTOS as object), status: "needs_action", attempts: [{ errorCode: "tiktok_coming_soon" }] };
    h.list.mockResolvedValueOnce({ items: [PHOTOS] }).mockResolvedValue({ items: [parked] });
    await mountWithList(PHOTOS);
    expect(q('[data-testid="tiktok-status"]')?.textContent).toBe("Approved");
    await choose("PUBLIC_TO_EVERYONE");
    await click(postButton());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(q('[data-testid="tiktok-status"]')?.textContent).toBe("Waiting for TikTok approval");
  });

  it("a failed save says so and does not show the coming-soon message", async () => {
    h.edit.mockRejectedValue(new Error("Nope"));
    await mount(PHOTOS);
    await choose("PUBLIC_TO_EVERYONE");
    await click(postButton());
    expect(h.resched).not.toHaveBeenCalled();
    expect(q('[data-testid="tiktok-coming-soon"]')).toBeNull();
    expect(text()).toContain("Nope");
  });

  it("NEEDS_REAUTH shows Reconnect", async () => {
    h.creatorInfo.mockRejectedValue(new FakeApiError("NEEDS_REAUTH", "reauth", 409));
    await mount();
    expect(text()).toContain("TikTok needs a quick reconnect");
    expect(q('a[href*="/dashboard/integrations"]')?.textContent).toBe("Reconnect TikTok");
    expect(select()).toBeNull();
  });

  it("TIKTOK_UNAVAILABLE shows a plain retry, not Reconnect", async () => {
    h.creatorInfo.mockRejectedValue(new FakeApiError("TIKTOK_UNAVAILABLE", "down", 503));
    await mount();
    expect(text()).toContain("We could not reach TikTok");
    expect(text()).not.toContain("Reconnect");
    expect([...document.body.querySelectorAll("button")].some((b) => b.textContent === "Try again")).toBe(true);
  });
});
