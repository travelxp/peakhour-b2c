// @vitest-environment jsdom
/**
 * <MetaComposer/>: what each channel lets through, and what "Publish now" sends. The scheduler client is replaced, so nothing
 * here reaches the network; the Drive picker, the AI toolbar and the emoji picker are stubbed because they are not under test.
 * The rules themselves are asserted in `lib/meta-compose.test.ts`; this file asserts the component APPLIES them (a blocked post
 * cannot be sent, the right channel's payload is) and names where the post goes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  commitPlan: vi.fn(),
  publishItemNow: vi.fn(),
  listItems: vi.fn(),
  pick: { current: null as null | ((assets: { id: string; url: string; mime: string; name?: string }[]) => void) },
}));

vi.mock("@/lib/scheduler/client", () => ({
  scheduler: { commitPlan: h.commitPlan, publishItemNow: h.publishItemNow, listItems: h.listItems },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/components/scheduler/scheduler-composer", () => ({ SchedulerComposer: () => null }));
vi.mock("@/components/composer", () => ({
  AiComposeToolbar: () => null,
  EmojiPickerTrigger: () => null,
  HashtagSuggest: () => null,
  PlatformCharCounter: ({ value }: { value: number }) => <span data-testid="count">{value}</span>,
  ComposerShell: ({
    headerSlot,
    children,
    actionsSlot,
    footerSlot,
  }: {
    headerSlot?: React.ReactNode;
    children?: React.ReactNode;
    actionsSlot?: React.ReactNode;
    footerSlot?: React.ReactNode;
  }) => (
    <div>
      {headerSlot}
      {children}
      <div>{actionsSlot}</div>
      <div>{footerSlot}</div>
    </div>
  ),
  DrivePicker: ({ onSelect }: { onSelect: (a: { id: string; url: string; mime: string; name?: string }[]) => void }) => {
    h.pick.current = onSelect;
    return <button type="button">Drive</button>;
  },
}));
vi.mock("@/lib/api/content", () => ({ rewriteContent: vi.fn() }));

const { MetaComposer } = await import("./meta-composer");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

function mount(channel: "facebook" | "instagram" | "threads", postingTo: string | null = "Posting to Acme Bakery") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={qc}>
        <MetaComposer channel={channel} postingTo={postingTo} />
      </QueryClientProvider>,
    );
  });
}

function type(text: string) {
  const el = host.querySelector("textarea")!;
  act(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    set.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const button = (label: RegExp) => [...host.querySelectorAll("button")].find((b) => label.test(b.textContent ?? "")) as HTMLButtonElement;

async function click(b: HTMLButtonElement) {
  await act(async () => {
    b.click();
  });
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  h.commitPlan.mockReset().mockResolvedValue({ planId: "plan1", scheduledItemIds: ["item1"], requestId: "r", resolvedTimes: [] });
  h.publishItemNow.mockReset().mockResolvedValue({ itemId: "item1", outcome: "published", published: true });
  h.listItems.mockReset().mockResolvedValue({ items: [{ _id: "item1", externalUrl: "https://www.threads.com/@acme/post/1", attempts: [] }] });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("MetaComposer", () => {
  it("names the Page it posts to and points at Connected accounts to change it", () => {
    mount("facebook", "Posting to Acme Bakery");
    const line = host.querySelector('[data-testid="meta-posting-to"]')!;
    expect(line.textContent).toContain("Posting to Acme Bakery");
    expect(line.querySelector("a")?.getAttribute("href")).toBe("/dashboard/integrations");
  });

  it("Instagram cannot be sent without a picture, and says why", async () => {
    mount("instagram", "Posting to @acmebakery");
    type("Fresh bread");
    expect(button(/Publish now/).disabled).toBe(true);
    expect(host.querySelector('[data-testid="meta-problems"]')?.textContent).toContain("Instagram posts need a picture or a video");
    await click(button(/Publish now/));
    expect(h.commitPlan).not.toHaveBeenCalled();
  });

  it("Instagram with a picture publishes an instagram payload carrying that picture, and no page id", async () => {
    mount("instagram", "Posting to @acmebakery");
    type("Fresh bread #bakery");
    act(() => h.pick.current!([{ id: "m1", url: "https://cdn.example.com/loaf.jpg", mime: "image/jpeg", name: "loaf.jpg" }]));
    expect(button(/Publish now/).disabled).toBe(false);
    await click(button(/Publish now/));

    expect(h.commitPlan).toHaveBeenCalledTimes(1);
    const body = h.commitPlan.mock.calls[0]![0];
    expect(body.channels).toEqual([
      { channel: "instagram", payload: { text: "Fresh bread #bakery", mediaUrls: ["https://cdn.example.com/loaf.jpg"] } },
    ]);
    expect(body.staggerStrategy).toBe("synchronized");
    expect(h.publishItemNow).toHaveBeenCalledWith("item1");
    expect(host.textContent).toContain("Published to Instagram.");
    expect(host.querySelector('a[href="/dashboard/content/instagram"]')).not.toBeNull();
  });

  it("Threads sends text alone, and links to the post it made", async () => {
    mount("threads", "Posting to @acme");
    type("New batch out of the oven");
    await click(button(/Publish now/));
    expect(h.commitPlan.mock.calls[0]![0].channels).toEqual([{ channel: "threads", payload: { text: "New batch out of the oven" } }]);
    const a = host.querySelector('a[href="https://www.threads.com/@acme/post/1"]');
    expect(a?.textContent).toBe("View on Threads");
  });

  it("Threads refuses 501 characters", () => {
    mount("threads");
    type("a".repeat(501));
    expect(button(/Publish now/).disabled).toBe(true);
    expect(host.querySelector('[data-testid="meta-problems"]')?.textContent).toContain("Threads allows 500 characters. This is 501.");
  });

  it("Facebook sends its link as a channel option", async () => {
    mount("facebook");
    type("Spring sale");
    const link = host.querySelector("#meta-link") as HTMLInputElement;
    act(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(link, "https://shop.example.com/sale");
      link.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(button(/Publish now/));
    expect(h.commitPlan.mock.calls[0]![0].channels).toEqual([
      { channel: "facebook", payload: { text: "Spring sale", channelOptions: { link: "https://shop.example.com/sale" } } },
    ]);
    expect(host.querySelector('a[href="/dashboard/content/facebook"]')).not.toBeNull();
  });

  it("Instagram and Threads show no link box", () => {
    mount("instagram");
    expect(host.querySelector("#meta-link")).toBeNull();
  });

  it("a publish the channel did not take says what the channel said, never 'Published'", async () => {
    h.publishItemNow.mockResolvedValue({ itemId: "item1", outcome: "permanent_error", published: false });
    h.listItems.mockResolvedValue({ items: [{ _id: "item1", attempts: [{ errorMessage: "The image could not be fetched" }] }] });
    mount("facebook");
    type("Spring sale");
    await click(button(/Publish now/));
    const alert = host.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("Facebook said: The image could not be fetched");
    expect(host.textContent).not.toContain("Published to Facebook.");
  });

  it("shows the server's message when the commit itself is refused, with no calendar link because nothing was created", async () => {
    h.commitPlan.mockRejectedValue(new Error("instagram: Instagram posts require at least one image"));
    mount("facebook");
    type("Spring sale");
    await click(button(/Publish now/));
    const alert = host.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("Instagram posts require at least one image");
    expect(alert.querySelector("a")).toBeNull();
    expect(h.publishItemNow).not.toHaveBeenCalled();
  });

  it("never posts twice: after a failed attempt the screen locks to that item and Try again re-sends it", async () => {
    h.publishItemNow.mockResolvedValueOnce({ itemId: "item1", outcome: "transient_error", published: false });
    mount("facebook");
    type("Spring sale");
    await click(button(/Publish now/));
    expect(h.commitPlan).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="alert"] a')?.getAttribute("href")).toBe("/dashboard/calendar");
    // locked: the text cannot change under the item that is already on the calendar, and Schedule is off
    expect(host.querySelector("textarea")!.readOnly).toBe(true);
    expect(button(/Schedule/).disabled).toBe(true);

    await click(button(/Try again/));
    expect(h.commitPlan).toHaveBeenCalledTimes(1);
    expect(h.publishItemNow).toHaveBeenCalledTimes(2);
    expect(h.publishItemNow).toHaveBeenLastCalledWith("item1");
    expect(host.textContent).toContain("Published to Facebook.");
    // and the composer is free again for the next post
    expect(host.querySelector("textarea")!.readOnly).toBe(false);
    expect(button(/Publish now/)).toBeTruthy();
  });

  it("a network error after the commit also keeps the item, so a second press does not commit another", async () => {
    h.publishItemNow.mockRejectedValueOnce(new Error("Network down"));
    mount("threads");
    type("New batch");
    await click(button(/Publish now/));
    expect(host.querySelector('[role="alert"] a')?.getAttribute("href")).toBe("/dashboard/calendar");
    await click(button(/Try again/));
    expect(h.commitPlan).toHaveBeenCalledTimes(1);
    expect(h.publishItemNow).toHaveBeenCalledTimes(2);
  });

  it("clears the last attempt's banner when the post changes", async () => {
    mount("facebook");
    type("Spring sale");
    await click(button(/Publish now/));
    expect(host.textContent).toContain("Published to Facebook.");
    type("Autumn sale");
    expect(host.textContent).not.toContain("Published to Facebook.");
  });
});
