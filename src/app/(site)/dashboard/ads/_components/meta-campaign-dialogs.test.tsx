// @vitest-environment jsdom
/**
 * MR-F1 — the New campaign dialog and the edit sheet: what a merchant sees and what each button sends.
 *
 * ★THE API CLIENT IS FAKED, THE FORM LOGIC IS NOT. `meta-ads-form.test.ts` pins the arithmetic; this pins that
 * the screen refuses what it should before any call, sends the bodies that arithmetic made, and says plainly
 * what exists in the merchant's Meta account when a launch fails half way.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  getPage: vi.fn(),
  uploadImage: vi.fn(),
  launchCampaign: vi.fn(),
  editCampaign: vi.fn(),
  editAdSet: vi.fn(),
  listAdSets: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: mocks.toastSuccess, error: vi.fn() }) }));
vi.mock("@/lib/api/meta-ads", async (orig) => {
  const actual = await orig<typeof import("@/lib/api/meta-ads")>();
  return {
    ...actual,
    metaAdsApi: {
      ...actual.metaAdsApi,
      getPage: mocks.getPage,
      uploadImage: mocks.uploadImage,
      launchCampaign: mocks.launchCampaign,
      editCampaign: mocks.editCampaign,
      editAdSet: mocks.editAdSet,
      listAdSets: mocks.listAdSets,
    },
  };
});

import { ApiError } from "@/lib/api";
import { MetaLaunchError, type MetaAdAccount, type MetaCampaign } from "@/lib/api/meta-ads";
import { EditCampaignButton, NewCampaignDialog } from "./meta-campaign-dialogs";

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

const ACCOUNT: MetaAdAccount = {
  id: "act_111",
  name: "Corner Shop",
  accountId: "111",
  currency: "USD",
  timezone: "Asia/Kolkata",
  accountStatus: 1,
};

let root: Root;
let host: HTMLElement;

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
};

function mount(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  act(() => {
    root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  });
}

const q = <T extends Element = HTMLElement>(sel: string) => document.body.querySelector<T>(sel);
const byText = (sel: string, text: string | RegExp) =>
  [...document.body.querySelectorAll<HTMLElement>(sel)].find((e) =>
    typeof text === "string" ? e.textContent?.trim() === text : text.test(e.textContent ?? ""),
  );

function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

function attach(input: HTMLInputElement, file: File) {
  act(() => {
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const click = (el: Element | undefined | null) => {
  expect(el).toBeTruthy();
  act(() => {
    (el as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const PNG = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])], "shirt.png", { type: "image/png" });

async function fillValidForm() {
  setValue(q<HTMLInputElement>("#mc-name")!, "Spring sale");
  setValue(q<HTMLInputElement>("#mc-budget")!, "25.50");
  setValue(q<HTMLSelectElement>('select[aria-label="Add a country"]')!, "IN");
  setValue(q<HTMLInputElement>("#mc-headline")!, "Spring is here");
  setValue(q<HTMLTextAreaElement>("#mc-text")!, "Fresh arrivals this week.");
  setValue(q<HTMLInputElement>("#mc-link")!, "https://shop.example.com/spring");
  attach(q<HTMLInputElement>("#mc-image")!, PNG());
  await flush();
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.getPage.mockResolvedValue({ page: { id: "9001", name: "Corner Shop" } });
  mocks.uploadImage.mockResolvedValue({ imageHash: "hash1" });
  mocks.launchCampaign.mockResolvedValue({ campaignId: "c1", adSetId: "s1", adId: "a1" });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("New campaign dialog", () => {
  const open = async (onCreated = vi.fn()) => {
    mount(<NewCampaignDialog account={ACCOUNT} onCreated={onCreated} />);
    click(byText("button", /New campaign/));
    await flush();
    return onCreated;
  };

  it("says it starts paused and names the currency the budget is in", async () => {
    await open();
    expect(document.body.textContent).toContain("starts paused");
    expect(byText("label", /Daily budget/)?.textContent).toContain("USD");
    expect(document.body.textContent).toContain("Shown as Corner Shop");
  });

  it("refuses an empty form with a reason on each field, and makes no call", async () => {
    await open();
    click(byText("button", "Create paused campaign"));
    await flush();
    const alerts = [...document.body.querySelectorAll('[role="alert"]')].map((a) => a.textContent);
    expect(alerts.some((t) => t?.includes("Give the campaign a name"))).toBe(true);
    expect(alerts.some((t) => t?.includes("daily budget"))).toBe(true);
    expect(alerts.some((t) => t?.includes("Choose at least one country"))).toBe(true);
    expect(alerts.some((t) => t?.includes("Choose an image"))).toBe(true);
    expect(mocks.uploadImage).not.toHaveBeenCalled();
    expect(mocks.launchCampaign).not.toHaveBeenCalled();
  });

  it("will not create without a Facebook Page, and says why", async () => {
    mocks.getPage.mockResolvedValue({ page: null });
    await open();
    await fillValidForm();
    expect(document.body.textContent).toContain("No Facebook Page is saved");
    click(byText("button", "Create paused campaign"));
    await flush();
    expect(mocks.launchCampaign).not.toHaveBeenCalled();
  });

  it("uploads the image, then launches three PAUSED levels with the budget in minor units", async () => {
    const onCreated = await open();
    await fillValidForm();
    click(byText("button", "Create paused campaign"));
    await flush();

    expect(mocks.uploadImage).toHaveBeenCalledTimes(1);
    const upload = mocks.uploadImage.mock.calls[0]![0];
    expect(upload).toMatchObject({ adAccountId: "act_111", contentType: "image/png", name: "shirt.png" });
    expect(atob(upload.data).charCodeAt(0)).toBe(0x89);

    const bodies = mocks.launchCampaign.mock.calls[0]![0];
    expect(bodies.campaign).toMatchObject({ name: "Spring sale", status: "PAUSED", dailyBudget: "2550" });
    expect(bodies.adSet("c1")).toMatchObject({ status: "PAUSED", targeting: { geoLocations: { countries: ["IN"] } } });
    expect(bodies.ad("s1").creative.objectStorySpec.linkData.imageHash).toBe("hash1");
    expect(bodies.ad("s1").creative.objectStorySpec.pageId).toBe("9001");

    expect(onCreated).toHaveBeenCalledWith("c1");
    expect(mocks.toastSuccess).toHaveBeenCalledWith(expect.stringContaining("paused"));
  });

  it("shows Meta's refusal in plain words, and that nothing was created", async () => {
    mocks.launchCampaign.mockRejectedValue(
      new MetaLaunchError(new ApiError("BUDGET_ENVELOPE_EXCEEDED", "That is over your weekly limit.", 409), "c1", false),
    );
    await open();
    await fillValidForm();
    click(byText("button", "Create paused campaign"));
    await flush();
    const alert = byText('[role="alert"]', /weekly limit/);
    expect(alert?.textContent).toContain("Nothing was created");
  });

  it("does not show raw error text from an unlisted code", async () => {
    mocks.launchCampaign.mockRejectedValue(
      new MetaLaunchError(new ApiError("CREATE_FAILED", "(#100) Invalid parameter act_111", 400), null, false),
    );
    await open();
    await fillValidForm();
    click(byText("button", "Create paused campaign"));
    await flush();
    expect(document.body.textContent).not.toContain("Invalid parameter");
    expect(document.body.textContent).not.toContain("act_111 ");
  });

  it("tells the merchant when a half-made campaign could not be removed", async () => {
    mocks.launchCampaign.mockRejectedValue(
      new MetaLaunchError(new ApiError("META_UNAVAILABLE", "Couldn't reach Meta just now.", 502), "c1", true),
    );
    await open();
    await fillValidForm();
    click(byText("button", "Create paused campaign"));
    await flush();
    expect(byText('[role="alert"]', /may be in your Meta account/)?.textContent).toContain("Spring sale");
  });

  it("stops at the image when the upload is refused, and launches nothing", async () => {
    mocks.uploadImage.mockRejectedValue(new ApiError("IMAGE_INVALID", "That file isn't a JPEG or PNG image.", 400));
    await open();
    await fillValidForm();
    click(byText("button", "Create paused campaign"));
    await flush();
    expect(byText('[role="alert"]', /isn't a JPEG or PNG/)).toBeTruthy();
    expect(mocks.launchCampaign).not.toHaveBeenCalled();
  });

  it("removes a country with its own button", async () => {
    await open();
    setValue(q<HTMLSelectElement>('select[aria-label="Add a country"]')!, "IN");
    setValue(q<HTMLSelectElement>('select[aria-label="Add a country"]')!, "GB");
    expect(q('ul[aria-label="Chosen countries"]')?.textContent).toContain("India");
    click(q('button[aria-label="Remove India"]'));
    expect(q('ul[aria-label="Chosen countries"]')?.textContent).not.toContain("India");
    expect(q('ul[aria-label="Chosen countries"]')?.textContent).toContain("United Kingdom");
  });
});

describe("Edit sheet", () => {
  const CAMPAIGN: MetaCampaign = {
    id: "c1",
    name: "Spring sale",
    status: "PAUSED",
    objective: "OUTCOME_TRAFFIC",
    dailyBudget: "2550",
    createdTime: "2026-10-01T00:00:00+0000",
    updatedTime: "2026-10-01T00:00:00+0000",
  };
  const AD_SET = {
    id: "s1",
    name: "Spring sale - audience",
    campaignId: "c1",
    status: "PAUSED",
    billingEvent: "IMPRESSIONS",
    optimizationGoal: "LINK_CLICKS",
    startTime: "2026-10-01T00:00:00+0000",
    targeting: { geo_locations: { countries: ["IN"] }, age_min: 25, age_max: 44 },
  };

  const open = async () => {
    mocks.listAdSets.mockResolvedValue({ adSets: [AD_SET], truncated: false });
    mocks.editCampaign.mockResolvedValue({ campaign: null });
    mocks.editAdSet.mockResolvedValue({ adSet: null });
    mount(<EditCampaignButton account={ACCOUNT} campaign={CAMPAIGN} />);
    click(q('button[aria-label="Edit campaign Spring sale"]'));
    await flush();
  };

  it("opens with the campaign's own name and budget, in the account's currency", async () => {
    await open();
    expect(q<HTMLInputElement>("#ec-name")?.value).toBe("Spring sale");
    expect(q<HTMLInputElement>("#ec-budget")?.value).toBe("25.5");
    expect(byText("label", /Daily budget/)?.textContent).toContain("USD");
  });

  it("sends only the budget when only the budget changed", async () => {
    await open();
    setValue(q<HTMLInputElement>("#ec-budget")!, "40");
    click(byText("button", "Save campaign"));
    await flush();
    expect(mocks.editCampaign).toHaveBeenCalledWith("c1", { dailyBudget: "4000" });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Campaign saved.");
  });

  it("sends nothing at all when nothing changed", async () => {
    await open();
    click(byText("button", "Save campaign"));
    await flush();
    expect(mocks.editCampaign).not.toHaveBeenCalled();
  });

  it("keeps the sheet open and shows the reason when the weekly limit refuses a raise", async () => {
    await open();
    mocks.editCampaign.mockRejectedValue(new ApiError("BUDGET_ENVELOPE_EXCEEDED", "That would go over your weekly limit.", 409));
    setValue(q<HTMLInputElement>("#ec-budget")!, "5000");
    click(byText("button", "Save campaign"));
    await flush();
    expect(byText('[role="alert"]', /weekly limit/)).toBeTruthy();
    expect(q<HTMLInputElement>("#ec-name")).toBeTruthy();
  });

  it("shows the ad set's countries and ages, and sends only a changed age", async () => {
    await open();
    expect(document.body.textContent).toContain("India");
    expect(q<HTMLInputElement>("#as-s1-min")?.value).toBe("25");
    setValue(q<HTMLInputElement>("#as-s1-min")!, "30");
    click(byText("button", "Save ad set"));
    await flush();
    expect(mocks.editAdSet).toHaveBeenCalledWith("s1", { targeting: { ageMin: 30 } });
  });

  it("will not save an ad set with the ages the wrong way round", async () => {
    await open();
    setValue(q<HTMLInputElement>("#as-s1-min")!, "60");
    click(byText("button", "Save ad set"));
    await flush();
    expect(byText('[role="alert"]', /oldest age/)).toBeTruthy();
    expect(mocks.editAdSet).not.toHaveBeenCalled();
  });

  it("shows the start day in the ad account's zone, not UTC", async () => {
    await open();
    // 2026-10-01T00:00Z is 05:30 on the 1st in Kolkata.
    expect(q<HTMLInputElement>("#as-s1-start")?.value).toBe("2026-10-01");
    expect(document.body.textContent).toContain("Asia/Kolkata");
  });
});
