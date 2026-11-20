// @vitest-environment jsdom
/**
 * MR-G1: the per-Page picker lists only the business's ENABLED ad accounts (what the api's GET /page-ad-account answers), is
 * labelled "Default for this Page", and is a plain line when only one account is enabled.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ state: null as unknown, put: vi.fn() }));

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
  return { api: { get: vi.fn(), put: vi.fn() }, API_BASE_URL: "https://api.example", ApiError };
});
vi.mock("@/lib/api/linkedin-ads", () => ({
  linkedInAdsApi: { pageAdAccount: async () => h.state, setPageAdAccount: h.put },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const { AdAccountPicker } = await import("./ad-account-picker");

const Q = { id: "111", name: "Quests Travel", currency: "INR" };
const C = { id: "222", name: "CMPL", currency: "USD" };

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount(state: unknown) {
  h.state = state;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <AdAccountPicker />
      </QueryClientProvider>,
    );
  });
  // the query resolves on a later tick
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

describe("AdAccountPicker", () => {
  it("with several enabled accounts: a select labelled 'Default for this Page'", async () => {
    await mount({ activePageId: "p1", adAccountId: "222", byPage: { p1: "222" }, businessDefaultId: "111", accounts: [Q, C] });
    expect(container.textContent).toContain("Default for this Page");
    expect(container.querySelector('[role="combobox"]')).not.toBeNull();
    expect(container.querySelector('[role="combobox"]')!.getAttribute("aria-label")).toBe("Default ad account for this Page");
    // the chosen one is shown
    expect(container.textContent).toContain("CMPL");
  });

  it("with one enabled account: a plain line, no select", async () => {
    await mount({ activePageId: "p1", adAccountId: "111", byPage: {}, businessDefaultId: "111", accounts: [Q] });
    expect(container.querySelector('[role="combobox"]')).toBeNull();
    expect(container.textContent).toContain("Quests Travel");
    expect(container.textContent).toContain("Account ID 111 · INR");
  });

  it("with none enabled: says to choose accounts in Connected accounts, and offers that link", async () => {
    await mount({ activePageId: "p1", adAccountId: null, byPage: {}, businessDefaultId: null, accounts: [] });
    expect(container.querySelector('[role="combobox"]')).toBeNull();
    expect(container.textContent).toContain("Connected accounts");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/dashboard/integrations");
  });

  it("a pageless connection shows nothing", async () => {
    await mount({ activePageId: null, adAccountId: "111", byPage: {}, accounts: [Q, C] });
    expect(container.innerHTML).toBe("");
  });
});
