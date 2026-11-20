// @vitest-environment jsdom
/**
 * MR-G0: the provider-neutral ad-account chooser. The Meta behaviour is covered by the Meta accounts panel's tests; this
 * file pins what makes it neutral: the provider in the save URL, the provider's own query keys, and a provider with no
 * format row shows nothing (never "No ad accounts found." over a real list).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ patch: vi.fn(), success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number,
    ) {
      super(message);
    }
  }
  return { api: { patch: h.patch, get: vi.fn() }, API_BASE_URL: "https://api.example", ApiError };
});
vi.mock("sonner", () => ({ toast: { success: h.success, error: h.error } }));

const { AdAccountChoice } = await import("./ad-account-choice");
const { ApiError } = await import("@/lib/api");

const TWO = [
  { id: "act_1111", name: "Quests Travel", currency: "INR", status: 1 },
  { id: "act_2222", name: "CMPL", currency: "USD", status: 1 },
];

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
beforeEach(() => {
  h.patch.mockReset();
  h.error.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(provider: string, extra: Record<string, unknown>) {
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <AdAccountChoice provider={provider} extra={extra} />
      </QueryClientProvider>,
    );
  });
}
const flush = () => act(async () => {});
const saveButton = () => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Save ad accounts")) as HTMLButtonElement;

describe("AdAccountChoice", () => {
  it("a provider with no format row renders nothing, even when the login lists accounts", () => {
    mount("tiktok_ads", { adAccounts: TWO });
    expect(container.innerHTML).toBe("");
  });

  it("saves to the provider's own route and refetches that provider's queries", async () => {
    h.patch.mockResolvedValue({});
    const spy = vi.spyOn(client, "invalidateQueries");
    mount("facebook", { adAccounts: TWO, adAccountChoice: { enabledIds: ["act_1111"], defaultId: "act_1111" } });
    const box = container.querySelector<HTMLInputElement>('input[type="checkbox"]:not(:checked)')!;
    await act(async () => box.click());
    await act(async () => saveButton().click());
    await flush();
    expect(h.patch.mock.calls[0]![0]).toBe("/v1/integrations/facebook/ad-accounts");
    // exactly the channel's own readers and the integrations list: no blanket refetch
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey?: unknown }).queryKey ?? "predicate")).sort();
    expect(keys).toEqual(['"predicate"', '["content-hub-integrations"]', '["meta-ads-accounts"]', '["meta-ads-campaigns"]']);
  });

  it("LinkedIn: ids as the bare number, a CANCELED account cannot be ticked, and the save goes to its own route", async () => {
    h.patch.mockResolvedValue({});
    const LI = [
      { id: "111", name: "Quests", currency: "INR", status: "ACTIVE" },
      { id: "222", name: "CMPL", currency: "USD", status: "CANCELED" },
      { id: "333", name: "Third", currency: "USD", status: "DRAFT" },
    ];
    mount("linkedin_ads", { adAccounts: LI, adAccountChoice: { enabledIds: ["111"], defaultId: "111" } });
    expect(container.textContent).toContain("Account ID 111 · INR");
    expect(container.textContent).toContain("Cancelled on LinkedIn");
    expect(container.textContent).toContain("Draft");
    const boxes = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    // the cancelled account's box is disabled, the draft one can be ticked
    expect(boxes.filter((b) => b.disabled)).toHaveLength(1);
    const draft = boxes.find((b) => !b.checked && !b.disabled)!;
    await act(async () => draft.click());
    await act(async () => saveButton().click());
    await flush();
    expect(h.patch.mock.calls[0]![0]).toBe("/v1/integrations/linkedin_ads/ad-accounts");
    expect(h.patch.mock.calls[0]![1]).toMatchObject({ enabledIds: ["111", "333"], defaultId: "111" });
  });

  it("★V6: every listed account cancelled: the card says the account cannot run ads and links to create one on the platform", async () => {
    mount("linkedin_ads", { adAccounts: [{ id: "222", name: "CMPL", currency: "USD", status: "CANCELED" }] });
    expect(container.textContent).toContain("This ad account is Cancelled on LinkedIn".replace("Cancelled", "cancelled"));
    expect(container.querySelector('a[href*="linkedin.com/campaignmanager"]')).not.toBeNull();
    // and a healthy list does not say it
    act(() => root.unmount());
    root = createRoot(container);
    mount("linkedin_ads", { adAccounts: [{ id: "111", status: "ACTIVE" }, { id: "222", status: "CANCELED" }] });
    expect(container.textContent).not.toContain("can't run ads");
  });

  it("an unknown failure keeps the generic words with the request reference; NOT_CONNECTED is not passed through", async () => {
    const err = new ApiError("NOT_CONNECTED", "Meta Ads is not connected", 404) as InstanceType<typeof ApiError> & { requestId?: string };
    err.requestId = "req-42";
    h.patch.mockRejectedValue(err);
    mount("facebook", { adAccounts: TWO, adAccountChoice: { enabledIds: ["act_1111"], defaultId: "act_1111" } });
    const box = container.querySelector<HTMLInputElement>('input[type="checkbox"]:not(:checked)')!;
    await act(async () => box.click());
    await act(async () => saveButton().click());
    await flush();
    expect(h.error).toHaveBeenCalledWith("Couldn't save the ad accounts. Try again in a moment. (reference req-42)");
  });

  it("a save the api could not write says the api's sentence (a refresh fixes it, not a retry)", async () => {
    h.patch.mockRejectedValue(new ApiError("AD_ACCOUNTS_NOT_SAVED", "No Meta Ads connection of this business lists ad accounts. Refresh your accounts and try again.", 409));
    mount("facebook", { adAccounts: TWO, adAccountChoice: { enabledIds: ["act_1111"], defaultId: "act_1111" } });
    const box = container.querySelector<HTMLInputElement>('input[type="checkbox"]:not(:checked)')!;
    await act(async () => box.click());
    await act(async () => saveButton().click());
    await flush();
    expect(h.error).toHaveBeenCalledWith("No Meta Ads connection of this business lists ad accounts. Refresh your accounts and try again.");
  });
});
