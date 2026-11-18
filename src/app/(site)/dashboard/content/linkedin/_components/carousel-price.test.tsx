// @vitest-environment jsdom
/**
 * The LinkedIn carousel preview makes one AI image per slide, so it is a priced task (CS-5b): the composer's Carousel button asks first, the dialog shows
 * the price in Peaks, nothing is made until the merchant says yes, and the signed receipt for the price on screen travels with the click.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";

const h = vi.hoisted(() => ({ quote: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...((await orig()) as object), api: { post: h.post, get: vi.fn() } }));
vi.mock("@/lib/api/peaks", async (orig) => ({ ...((await orig()) as object), peaksApi: { quote: h.quote, actions: vi.fn() } }));

const { CarouselPriceDialog, carouselPriceSentence } = await import("./carousel-price-dialog");
const { PEAKS_ACTIONS } = await import("@/lib/api/peaks");
const { linkedInContentApi } = await import("@/lib/api/linkedin-content");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const quote = (over: Record<string, unknown> = {}) => ({ action: "linkedin.newsletter_carousel", useCase: "creative_image", label: "Image", description: null, peaks: 1250, breakdown: [], free: false, source: "code", token: "tok-1", expiresAt: Date.now() + 15 * 60_000, ...over });

let root: Root;
let host: HTMLElement;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  h.quote.mockReset();
  h.post.mockReset();
});
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
async function settle(times = 4) {
  for (let i = 0; i < times; i++) await flush();
}
async function mount(open: boolean, onConfirm = vi.fn(), onCancel = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <CarouselPriceDialog open={open} onConfirm={onConfirm} onCancel={onCancel} />
      </QueryClientProvider>,
    );
  });
  await settle();
  return { onConfirm, onCancel };
}
const dialog = () => document.body.querySelector<HTMLElement>('[data-testid="carousel-price-dialog"]');
const button = (label: string) => [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label);

describe("the price dialog", () => {
  it("asks the api for the carousel's price, shows it in Peaks and nothing else", async () => {
    h.quote.mockResolvedValue(quote());
    await mount(true);
    expect(h.quote).toHaveBeenCalledWith("linkedin.newsletter_carousel");
    expect(dialog()!.querySelector('[data-testid="carousel-price"]')!.textContent).toBe("This costs 1,250 Peaks, and only when your preview is ready. Nothing is charged if it fails. Publishing the preview is free.");
    expect(dialog()!.textContent).toContain("Five slides, each with its own AI image.");
    expect(dialog()!.textContent).not.toMatch(/[$₹£€]/);
  });

  it("asks for no price while it is closed (a receipt's clock starts when the merchant is about to act)", async () => {
    await mount(false);
    expect(h.quote).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it("the button stays off until a price is in hand, and no token leaves", async () => {
    h.quote.mockImplementation(() => new Promise(() => undefined));
    const { onConfirm } = await mount(true);
    expect(button("Make the preview")!.disabled).toBe(true);
    await act(async () => button("Make the preview")!.click());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Make the preview hands back the receipt for the price on screen", async () => {
    h.quote.mockResolvedValue(quote());
    const { onConfirm } = await mount(true);
    await act(async () => button("Make the preview")!.click());
    expect(onConfirm).toHaveBeenCalledWith("tok-1");
  });

  it("Not now makes nothing", async () => {
    h.quote.mockResolvedValue(quote());
    const { onConfirm, onCancel } = await mount(true);
    await act(async () => button("Not now")!.click());
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("a price that cannot be read is said, and the button stays off", async () => {
    h.quote.mockRejectedValue(new Error("offline"));
    await mount(true);
    expect(button("Make the preview")!.disabled).toBe(true);
    expect(dialog()!.textContent).toMatch(/couldn.t/i);
  });

  it("the sentence is withheld for a free or missing quote", () => {
    expect(carouselPriceSentence({ quote: undefined })).toBeNull();
    expect(carouselPriceSentence({ quote: quote({ free: true, peaks: 0 }) as never })).toBeNull();
  });
});

describe("the preview call carries the price", () => {
  it("names the api's registered action", () => {
    expect(PEAKS_ACTIONS.linkedinCarousel).toBe("linkedin.newsletter_carousel");
  });

  it("sends the receipt as x-peaks-quote with one Idempotency-Key per click, and no slide count", async () => {
    h.post.mockResolvedValue({});
    await linkedInContentApi.previewCarousel({ newsletterText: "x".repeat(60) }, "tok-1");
    const [path, body, headers] = h.post.mock.calls[0]!;
    expect(path).toBe("/v1/linkedin/content/repurpose-newsletter-carousel/preview");
    expect(body).toEqual({ newsletterText: "x".repeat(60) });
    expect(headers["x-peaks-quote"]).toBe("tok-1");
    expect(headers["Idempotency-Key"]).toMatch(/^click-/);
    await linkedInContentApi.previewCarousel({ newsletterText: "x".repeat(60) });
    expect(h.post.mock.calls[1]![2]["x-peaks-quote"]).toBeUndefined();
    expect(h.post.mock.calls[1]![2]["Idempotency-Key"]).not.toBe(headers["Idempotency-Key"]);
  });
});

describe("the composer asks first", () => {
  const composer = readFileSync("src/app/(site)/dashboard/content/linkedin/_components/post-composer.tsx", "utf8");
  it("the Carousel button only opens the price dialog; the preview call is made on Yes, with the receipt", () => {
    const onCarousel = composer.slice(composer.indexOf("function onCarousel()"), composer.indexOf("function startCarousel"));
    expect(onCarousel).toContain("setCarouselConfirmOpen(true)");
    expect(onCarousel).not.toContain("carousel.mutate");
    expect(composer).toContain("carousel.mutate({ input: { newsletterText: text.trim() }, quoteToken })");
    expect(composer).toContain("startCarousel(quoteToken)");
  });
  it("a refused receipt is thrown away and a refusal before the task started is shown in the api's words", () => {
    expect(composer).toContain('err.code === "QUOTE_NOT_HONOURED"');
    expect(composer).toContain("chargedTaskRefusal(err.code, err.message)");
  });
});
