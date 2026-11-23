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
vi.mock("@/components/composer", () => ({
  DrivePicker: ({ onSelect }: { onSelect: (a: { url: string; mime: string; name?: string }[]) => void }) => (
    <button type="button" onClick={() => onSelect([{ url: "https://cdn/v.mp4", mime: "video/mp4", name: "v.mp4" }])}>
      Pick a video
    </button>
  ),
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

  it("commits one TikTok item with the caption and the video, and publishes nothing", async () => {
    const caption = document.body.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(caption, "Fresh loaves today");
      caption.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => btn("Pick a video").click());
    expect(btn("Approve and save").disabled).toBe(false);
    await act(async () => btn("Approve and save").click());
    expect(h.commit).toHaveBeenCalledTimes(1);
    const body = h.commit.mock.calls[0][0];
    expect(body.channels).toEqual([{ channel: "tiktok", payload: { text: "Fresh loaves today", mediaUrls: ["https://cdn/v.mp4"] } }]);
    expect(h.publish).not.toHaveBeenCalled();
  });
});
