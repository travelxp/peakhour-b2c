// @vitest-environment jsdom
/** The new TikTok post sheet: the caption and the video or photos are needed, and "Approve and save" commits one TikTok item and posts nothing. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ commit: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: {}, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));
vi.mock("@/lib/scheduler/client", () => ({ scheduler: { commitPlan: h.commit, publishItemNow: h.publish } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/components/shared/media-image", () => ({ MediaImage: () => null }));
const h2 = vi.hoisted(() => ({ pick: [] as { id: string; url: string; mime: string; name?: string }[] }));
// The shared picker and drop/paste are stood in for: the real usePostMedia (dedupe, refusals) runs on top of them.
vi.mock("@/components/drive/drive-picker", () => ({
  DrivePicker: ({ onSelect }: { onSelect: (a: unknown[]) => void }) => (
    <button type="button" onClick={() => onSelect(h2.pick)}>
      Pick files
    </button>
  ),
  useDropPaste: () => ({ ref: { current: null }, dragging: false, busy: false }),
}));

const { TikTokNewPostSheet } = await import("./tiktok-new-post-sheet");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const btn = (label: string) => [...document.body.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;

beforeEach(async () => {
  h.commit.mockReset().mockResolvedValue({ planId: "p1", scheduledItemIds: ["i1"], requestId: "r", resolvedTimes: [] });
  h.publish.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const client = new QueryClient();
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <TikTokNewPostSheet open onOpenChange={() => {}} />
      </QueryClientProvider>,
    );
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("TikTokNewPostSheet", () => {
  it("cannot be saved without a video or photos", async () => {
    expect(btn("Approve and save").disabled).toBe(true);
  });

  const type = async (value: string) => {
    const caption = document.body.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(caption, value);
      caption.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const pick = async (files: typeof h2.pick) => {
    h2.pick = files;
    await act(async () => btn("Pick files").click());
  };

  it("commits one TikTok item with no privacy and channelOptions.mediaType from the file's type, and publishes nothing", async () => {
    await type("Fresh loaves today");
    await pick([{ id: "f1", url: "https://cdn/clip", mime: "video/mp4", name: "clip" }]);
    expect(btn("Approve and save").disabled).toBe(false);
    await act(async () => btn("Approve and save").click());
    expect(h.commit).toHaveBeenCalledTimes(1);
    const body = h.commit.mock.calls[0][0];
    expect(body.channels).toEqual([
      { channel: "tiktok", payload: { text: "Fresh loaves today", mediaUrls: ["https://cdn/clip"], channelOptions: { mediaType: "video" } } },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/privacy/i);
    expect(new Date(body.canonicalScheduledAtUtc).getTime()).toBeGreaterThan(Date.now() + 24 * 3600 * 1000);
    expect(h.publish).not.toHaveBeenCalled();
  });

  it("types photos as photo, by mime and not by the link's extension", async () => {
    await type("Look");
    await pick([{ id: "f1", url: "https://cdn/pic.mp4", mime: "image/jpeg" }]);
    await act(async () => btn("Approve and save").click());
    expect(h.commit.mock.calls[0][0].channels[0].payload.channelOptions).toEqual({ mediaType: "photo" });
  });

  it("refuses a video mixed with photos, with a clear message, and keeps Save off", async () => {
    await type("Mix");
    await pick([
      { id: "f1", url: "https://cdn/v", mime: "video/mp4" },
      { id: "f2", url: "https://cdn/p", mime: "image/png" },
    ]);
    expect(document.body.textContent).toContain("one video or photos, not both");
    expect(btn("Approve and save").disabled).toBe(true);
  });

  it("refuses a file that is neither a video nor a photo", async () => {
    await type("Doc");
    await pick([{ id: "f1", url: "https://cdn/d", mime: "application/pdf" }]);
    expect(document.body.textContent).toContain("video or photos only");
    expect(btn("Approve and save").disabled).toBe(true);
  });

  it("does not add the same file twice (by asset id, even with a new link)", async () => {
    await type("Dup");
    await pick([{ id: "f1", url: "https://cdn/a?sig=1", mime: "image/png", name: "a" }]);
    await pick([{ id: "f1", url: "https://cdn/a?sig=2", mime: "image/png", name: "a" }]);
    expect(document.body.querySelectorAll('ul[aria-label="Attached media"] li')).toHaveLength(1);
  });
});
