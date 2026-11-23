// @vitest-environment jsdom
/**
 * The Repurpose sheet shows the price in Peaks BEFORE the merchant confirms, per channel it will write, and sends the receipt for that price with the press.
 * The numbers are the api's binding quote (`GET /v1/content/repurpose/quote`); nothing here types one. With no price in hand Generate stays off.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

const api = vi.hoisted(() => ({
  recommendPlatforms: vi.fn(),
  repurpose: vi.fn(),
  repurposeQuote: vi.fn(),
}));
vi.mock("@/lib/api/repurpose", async (orig) => ({ ...((await orig()) as object), ...api }));
const { ApiErrorStub } = vi.hoisted(() => ({
  ApiErrorStub: class extends Error {
    constructor(public code: string, message: string, public status: number) {
      super(message);
    }
  },
}));
vi.mock("@/lib/api", () => ({ api: {}, ApiError: ApiErrorStub, API_BASE_URL: "https://api.example", newActionKey: () => ({}) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/scheduler/scheduler-composer", () => ({ SchedulerComposer: () => null }));
// Radix Sheet portals and traps focus; the sheet's own content is what is under test.
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ id, checked, disabled, onCheckedChange }: { id: string; checked: boolean; disabled?: boolean; onCheckedChange: (v: boolean) => void }) => (
    <input type="checkbox" id={id} checked={checked} disabled={disabled} onChange={(e) => onCheckedChange(e.target.checked)} />
  ),
}));

const { RepurposeSheet } = await import("./repurpose-sheet");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FAR = Date.now() + 60 * 60 * 1000;
const rec = (channel: string, band = "green") => ({ channel, fitScore: 80, band, rationale: `${channel} fits`, adapterVersion: "1", tier: "rules" });
const quoteFor = (channels: string[]) => ({
  channels: channels.map((channel) => ({ channel, kind: "post", pieces: channel === "x" ? 2 : 1, peaks: channel === "x" ? 150 : 75 })),
  posts: { units: channels.reduce((n, c) => n + (c === "x" ? 2 : 1), 0), quote: { token: "tok-posts", expiresAt: FAR } },
  articles: null,
  totalPeaks: channels.reduce((n, c) => n + (c === "x" ? 150 : 75), 0),
  free: false,
});

let host: HTMLDivElement;
let root: Root;
const SOURCE = { type: "facebook_post", postId: "1001_555" } as const;

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <RepurposeSheet open onOpenChange={() => {}} source={SOURCE} />
      </QueryClientProvider>,
    );
  });
  await flush();
  await flush();
}
const footer = () => host.querySelector('[data-testid="repurpose-price"]') as HTMLElement | null;
const generate = () => [...host.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Generate")) as HTMLButtonElement;
const tick = async (channel: string) => {
  const box = host.querySelector(`#repurpose-${channel}`) as HTMLInputElement;
  await act(async () => box.click());
  await flush();
};

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.recommendPlatforms.mockResolvedValue({ platformFitId: "f".repeat(24), recommendations: [rec("linkedin"), rec("x"), rec("threads", "grey")], connectedChannelsCount: 3 });
  api.repurposeQuote.mockImplementation(async (platforms: string[]) => quoteFor(platforms));
  api.repurpose.mockResolvedValue({ socialPostId: "s1", sourceTitle: "T", adaptations: [], blogDrafts: [], failedPlatforms: [] });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("the price comes before the press", () => {
  it("asks for the price of the ticked channels (green and amber are ticked) and shows it per channel and in total", async () => {
    await mount();
    expect(api.repurposeQuote).toHaveBeenCalledWith(["linkedin", "x"]);
    expect(host.querySelector('[data-testid="repurpose-price-linkedin"]')!.textContent).toBe("75 Peaks");
    // X is a post and a thread: two pieces, so twice the price of one
    expect(host.querySelector('[data-testid="repurpose-price-x"]')!.textContent).toBe("150 Peaks");
    // a channel that is not ticked has no price on it
    expect(host.querySelector('[data-testid="repurpose-price-threads"]')).toBeNull();
    expect(footer()!.textContent).toBe("Costs up to 225 Peaks. You pay only for what is written.");
    expect(footer()!.dataset.priceState).toBe("priced");
    // no model has been asked yet
    expect(api.repurpose).not.toHaveBeenCalled();
  });

  it("re-prices when the choice changes", async () => {
    await mount();
    await tick("threads");
    expect(api.repurposeQuote).toHaveBeenLastCalledWith(["linkedin", "threads", "x"]);
    expect(footer()!.textContent).toContain("300 Peaks");
  });

  it("never types money: Peaks only", async () => {
    await mount();
    expect(host.textContent).not.toMatch(/[₹$£€]/);
  });
});

describe("a price that cannot be had, or is refused", () => {
  it("offers Try again, and asks once more when it is pressed", async () => {
    api.repurposeQuote.mockRejectedValueOnce(new Error("503"));
    await mount();
    expect(footer()!.dataset.priceState).toBe("unavailable");
    const retry = [...footer()!.querySelectorAll("button")].find((b) => b.textContent === "Try again")!;
    await act(async () => retry.click());
    await flush();
    expect(footer()!.dataset.priceState).toBe("priced");
    expect(generate().disabled).toBe(false);
  });

  it("a press the api refuses on the price (409 QUOTE_NOT_HONOURED) asks for the price again", async () => {
    await mount();
    api.repurpose.mockRejectedValueOnce(new ApiErrorStub("QUOTE_NOT_HONOURED", "That price quote has expired.", 409));
    const before = api.repurposeQuote.mock.calls.length;
    await act(async () => generate().click());
    await flush();
    await flush();
    expect(api.repurposeQuote.mock.calls.length).toBeGreaterThan(before);
  });

  it("after a refused price the refused receipt is gone and Generate is off until the new price arrives", async () => {
    await mount();
    api.repurpose.mockRejectedValueOnce(new ApiErrorStub("QUOTE_NOT_HONOURED", "That price quote was for a different amount.", 409));
    api.repurposeQuote.mockImplementation(() => new Promise(() => {}));
    await act(async () => generate().click());
    await flush();
    await flush();
    expect(footer()!.textContent).toBe("Working out the price…");
    expect(generate().disabled).toBe(true);
  });

  it("any other failed press leaves the price on screen (it was not the price's fault)", async () => {
    await mount();
    api.repurpose.mockRejectedValueOnce(new ApiErrorStub("INTERNAL", "boom", 500));
    const before = api.repurposeQuote.mock.calls.length;
    await act(async () => generate().click());
    await flush();
    await flush();
    expect(api.repurposeQuote.mock.calls.length).toBe(before);
    expect(footer()!.dataset.priceState).toBe("priced");
  });
});

describe("channels nothing is written for", () => {
  it("the Generate button counts what will be written, not the channels that are not", async () => {
    api.recommendPlatforms.mockResolvedValue({ platformFitId: "f".repeat(24), recommendations: [rec("linkedin"), rec("peakhoursite")], connectedChannelsCount: 2 });
    api.repurposeQuote.mockResolvedValue({
      channels: [
        { channel: "linkedin", kind: "post", pieces: 1, peaks: 75 },
        { channel: "peakhoursite", kind: "none", pieces: 0, peaks: 0 },
      ],
      posts: { units: 1, quote: { token: "tok-posts", expiresAt: FAR } },
      articles: null,
      totalPeaks: 75,
      free: false,
    });
    await mount();
    expect(generate().textContent).toBe("Generate 1 variant");
  });

  it("each says so, and when every ticked channel is one the footer says so and Generate stays off (never 'Free')", async () => {
    api.recommendPlatforms.mockResolvedValue({ platformFitId: "f".repeat(24), recommendations: [rec("peakhoursite")], connectedChannelsCount: 1 });
    api.repurposeQuote.mockResolvedValue({ channels: [{ channel: "peakhoursite", kind: "none", pieces: 0, peaks: 0 }], posts: null, articles: null, totalPeaks: 0, free: false });
    await mount();
    expect(host.querySelector('[data-testid="repurpose-price-peakhoursite"]')!.textContent).toBe("Not written here");
    expect(footer()!.textContent).toContain("Nothing is written for the channels ticked");
    expect(footer()!.textContent).not.toContain("Free");
    expect(generate().disabled).toBe(true);
  });
});

describe("Generate sends the receipt for the price that was shown", () => {
  it("the press carries the quote's token and the ticked channels", async () => {
    await mount();
    await act(async () => generate().click());
    await flush();
    expect(api.repurpose).toHaveBeenCalledTimes(1);
    const [req, tokens] = api.repurpose.mock.calls[0]!;
    expect(req).toEqual({ source: SOURCE, platforms: ["linkedin", "x"], platformFitId: "f".repeat(24) });
    expect(tokens).toEqual({ posts: "tok-posts" });
  });

  it("stays off until a price is in hand: while it loads, nothing can be pressed", async () => {
    api.repurposeQuote.mockImplementation(() => new Promise(() => {}));
    await mount();
    expect(footer()!.textContent).toBe("Working out the price…");
    expect(generate().disabled).toBe(true);
    await act(async () => generate().click());
    expect(api.repurpose).not.toHaveBeenCalled();
  });

  it("stays off, and says why, when the price cannot be had: nothing is written that was not priced", async () => {
    api.repurposeQuote.mockRejectedValue(new Error("503"));
    await mount();
    expect(footer()!.dataset.priceState).toBe("unavailable");
    expect(footer()!.textContent).toContain("cannot show the price");
    expect(generate().disabled).toBe(true);
    await act(async () => generate().click());
    expect(api.repurpose).not.toHaveBeenCalled();
  });

  it("a free price is said as Free, never 0 Peaks", async () => {
    api.repurposeQuote.mockImplementation(async (platforms: string[]) => ({ ...quoteFor(platforms), free: true, totalPeaks: 0, channels: quoteFor(platforms).channels.map((c) => ({ ...c, peaks: 0 })) }));
    await mount();
    expect(footer()!.textContent).toBe("Free — you are never charged for this.");
    expect(host.querySelector('[data-testid="repurpose-price-linkedin"]')!.textContent).toBe("Free");
    expect(host.textContent).not.toContain("0 Peaks");
  });
});
