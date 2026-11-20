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
    expect(container.textContent).toBe("");
    expect(container.textContent).not.toContain("No ad accounts found.");
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
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(keys).toEqual(expect.arrayContaining(['["meta-ads-accounts"]', '["meta-ads-campaigns"]', '["growth-v2","signal"]', '["content-hub-integrations"]']));
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
