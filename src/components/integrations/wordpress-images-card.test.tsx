// @vitest-environment jsdom
/**
 * AI featured images for WordPress (CS-5b): the card is OFF until turned on, shows the price per image in Peaks from the api, asks first (with a monthly
 * limit the merchant sets), sends back the price they were shown, and says so in the api's words when it is refused. Only an owner or admin can change it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AiFeaturedImagesStatus } from "@/lib/wordpress-ai-images";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), role: "admin" as string }));
vi.mock("@/lib/api", () => ({ api: { get: h.get, put: h.put }, API_BASE_URL: "https://api.example" }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ org: { _id: "o1" }, orgs: [{ _id: "o1", role: h.role }] }) }));

const { WordPressImagesCard } = await import("./wordpress-images-card");
const lib = await import("@/lib/wordpress-ai-images");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const status = (over: Partial<AiFeaturedImagesStatus> = {}): AiFeaturedImagesStatus => ({
  enabled: false,
  monthlyCapPeaks: null,
  usedPeaks: 0,
  remainingPeaks: null,
  pricePerImagePeaks: 250,
  acceptedPricePeaks: null,
  needsReaccept: false,
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
  h.role = "admin";
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
async function settle(times = 4) {
  for (let i = 0; i < times; i++) await flush();
}

async function mount(initial: AiFeaturedImagesStatus) {
  let current = initial;
  h.get.mockImplementation(async () => current);
  h.put.mockImplementation(async (_url: string, body: { enabled: boolean; monthlyCapPeaks?: number; acceptedPricePeaks?: number }) => {
    current = body.enabled
      ? { ...current, enabled: true, monthlyCapPeaks: body.monthlyCapPeaks ?? null, acceptedPricePeaks: body.acceptedPricePeaks ?? null, remainingPeaks: body.monthlyCapPeaks ?? null, needsReaccept: false }
      : { ...current, enabled: false };
    return current;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <WordPressImagesCard />
      </QueryClientProvider>,
    );
  });
  await settle();
}
const sw = () => host.querySelector<HTMLButtonElement>("#wp-ai-images")!;
const dialog = () => document.body.querySelector<HTMLElement>('[data-testid="wp-images-confirm"]');
const button = (label: string) => [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label);
const click = async (el: HTMLElement | undefined) => {
  await act(async () => {
    el!.click();
  });
  await settle();
};
const type = async (el: HTMLInputElement, value: string) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
};

describe("the card", () => {
  it("starts OFF and shows the price per image in Peaks, read from the api", async () => {
    await mount(status());
    expect(sw().getAttribute("aria-checked")).toBe("false");
    expect(host.querySelector('[data-testid="wp-images-price"]')!.textContent).toBe("Each image costs 250 Peaks, and only when the image arrives.");
    expect(host.textContent).toContain("makes no AI image and your post goes out without one");
  });

  it("follows the rate card: another price reads as that price, and no currency figure is shown", async () => {
    await mount(status({ pricePerImagePeaks: 300 }));
    expect(host.textContent).toContain("300 Peaks");
    expect(host.textContent).not.toContain("250");
    expect(host.textContent).not.toMatch(/[$₹£€]/);
  });

  it("turning it ON opens the confirmation with the price and a suggested limit, and nothing is saved yet", async () => {
    await mount(status());
    await click(sw());
    expect(dialog()).not.toBeNull();
    expect(dialog()!.textContent).toContain("Turn on AI featured images?");
    expect(dialog()!.textContent).toContain("250 Peaks");
    expect(dialog()!.textContent).toContain("1,250 Peaks a month, which is 5 images");
    expect(dialog()!.querySelector<HTMLInputElement>("#wp-ai-images-confirm-limit")!.value).toBe("1250");
    expect(h.put).not.toHaveBeenCalled();
    expect(sw().getAttribute("aria-checked")).toBe("false");
  });

  it("No leaves it off and saves nothing", async () => {
    await mount(status());
    await click(sw());
    await click(button("No"));
    expect(dialog()).toBeNull();
    expect(h.put).not.toHaveBeenCalled();
  });

  it("Yes sends the limit and the price that was shown, and the card reads ON with the usage", async () => {
    await mount(status());
    await click(sw());
    await type(dialog()!.querySelector<HTMLInputElement>("#wp-ai-images-confirm-limit")!, "2,000");
    expect(dialog()!.textContent).toContain("2,000 Peaks a month, which is 8 images");
    await click(button("Yes, turn on"));
    expect(h.put).toHaveBeenCalledWith("/v1/ai-featured-images", { enabled: true, monthlyCapPeaks: 2000, acceptedPricePeaks: 250 });
    expect(sw().getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector('[data-testid="wp-images-usage"]')!.textContent).toBe("Used this month: 0 of 2,000 Peaks.");
  });

  it("a limit that does not cover one image cannot be accepted", async () => {
    await mount(status());
    await click(sw());
    await type(dialog()!.querySelector<HTMLInputElement>("#wp-ai-images-confirm-limit")!, "100");
    expect(button("Yes, turn on")!.disabled).toBe(true);
    await type(dialog()!.querySelector<HTMLInputElement>("#wp-ai-images-confirm-limit")!, "abc");
    expect(button("Yes, turn on")!.disabled).toBe(true);
    expect(h.put).not.toHaveBeenCalled();
  });

  it("turning it OFF asks nothing", async () => {
    await mount(status({ enabled: true, monthlyCapPeaks: 1000, acceptedPricePeaks: 250, remainingPeaks: 1000 }));
    await click(sw());
    expect(dialog()).toBeNull();
    expect(h.put).toHaveBeenCalledWith("/v1/ai-featured-images", { enabled: false });
    expect(sw().getAttribute("aria-checked")).toBe("false");
  });

  it("when on, the limit can be changed and is saved with the price on screen", async () => {
    await mount(status({ enabled: true, monthlyCapPeaks: 1000, acceptedPricePeaks: 250, remainingPeaks: 1000, usedPeaks: 500 }));
    expect(host.querySelector('[data-testid="wp-images-usage"]')!.textContent).toBe("Used this month: 500 of 1,000 Peaks.");
    await type(host.querySelector<HTMLInputElement>("#wp-ai-images-limit")!, "3000");
    await click(button("Save limit"));
    expect(h.put).toHaveBeenCalledWith("/v1/ai-featured-images", { enabled: true, monthlyCapPeaks: 3000, acceptedPricePeaks: 250 });
  });

  it("a price that rose says images are paused and offers to accept the new price", async () => {
    await mount(status({ enabled: true, monthlyCapPeaks: 1000, acceptedPricePeaks: 250, pricePerImagePeaks: 300, needsReaccept: true, remainingPeaks: 1000 }));
    expect(host.querySelector('[data-testid="wp-images-reaccept"]')!.textContent).toContain("The price has changed, so AI images are paused");
    await click(button("Accept the new price"));
    expect(dialog()!.textContent).toContain("300 Peaks");
  });

  it("a refused save says so in the api's words and the switch stays as the api has it", async () => {
    await mount(status());
    h.put.mockRejectedValueOnce(new Error("The price is now 300 Peaks per image. Check it and accept again."));
    await click(sw());
    await click(button("Yes, turn on"));
    expect(host.querySelector('[data-testid="wp-images-error"]')!.textContent).toBe("The price is now 300 Peaks per image. Check it and accept again.");
    expect(sw().getAttribute("aria-checked")).toBe("false");
    expect(sw().disabled).toBe(false);
  });

  it("an editor sees the setting but cannot change it", async () => {
    h.role = "editor";
    await mount(status());
    expect(sw().disabled).toBe(true);
    expect(host.textContent).toContain("takes an owner or admin");
  });

  it("with no price from the api it says so and cannot be turned on, never showing 0", async () => {
    await mount(status({ pricePerImagePeaks: null }));
    expect(host.textContent).toContain("The price of an AI image is not set yet");
    expect(sw().disabled).toBe(true);
    expect(host.textContent).not.toContain("0 Peaks");
  });
});

describe("the wording", () => {
  it("a limit is read as a whole number of Peaks", () => {
    expect(lib.parseCap("1,250")).toBe(1250);
    expect(lib.parseCap(" 600 ")).toBe(600);
    expect([lib.parseCap("0"), lib.parseCap("12.5"), lib.parseCap("-5"), lib.parseCap(""), lib.parseCap("99999999")]).toEqual([null, null, null, null, null]);
  });
  it("counts the images a limit covers, whole images only", () => {
    expect(lib.imagesCovered(1250, 250)).toBe(5);
    expect(lib.imagesCovered(600, 250)).toBe(2);
    expect(lib.confirmSentence(250, 250)).toContain("which is 1 image.");
  });
});
