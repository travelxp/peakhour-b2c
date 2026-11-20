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
    mount("linkedin_ads", { adAccounts: TWO });
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

  it("B4: a Google account the business chose that is now blocked is one muted line: no tick, no default, nothing else says it", () => {
    const G = [{ id: "1111111111", name: "India Store", currencyCode: "INR", testAccount: false }, { id: "2222222222", name: "UK Store", currencyCode: "GBP", testAccount: false }];
    mount("google_ads", {
      adAccounts: G,
      blockedAdAccounts: [{ id: "3333333333", code: "customer_status_CANCELED" }],
      adAccountChoice: { enabledIds: ["1111111111", "3333333333"], defaultId: "1111111111" },
    });
    expect(container.textContent).toContain("1 ad account you chose is no longer available on Google.");
    expect(container.textContent).not.toContain("3333");
    expect(container.querySelectorAll("input[type=checkbox]:checked").length).toBe(1);
    // nothing blocked: no line
    act(() => root.unmount());
    root = createRoot(container);
    mount("google_ads", { adAccounts: G, adAccountChoice: { enabledIds: ["1111111111"], defaultId: "1111111111" } });
    expect(container.textContent).not.toContain("no longer available");
  });

  it("S6: the no-longer-available line also shows when ONE account is listed and enabled, and for a chosen id that vanished from the login", () => {
    const G = [{ id: "1111111111", name: "India Store", currencyCode: "INR", testAccount: false }];
    mount("google_ads", { adAccounts: G, adAccountChoice: { enabledIds: ["1111111111", "7777777777"], defaultId: "1111111111" } });
    expect(container.textContent).toContain("1 ad account you chose is no longer available on Google.");
    expect(container.querySelector("input[type=checkbox]")).toBeNull();
  });

  it("S2: a lone Google TEST account is not auto-enabled: the checklist shows so it can be ticked", () => {
    mount("google_ads", { adAccounts: [{ id: "4444444444", name: "Sandbox", currencyCode: "USD", testAccount: true }] });
    expect(container.querySelectorAll("input[type=checkbox]").length).toBe(1);
    expect(container.querySelectorAll("input[type=checkbox]:checked").length).toBe(0);
    expect(container.textContent).toContain("Test account");
  });
});
