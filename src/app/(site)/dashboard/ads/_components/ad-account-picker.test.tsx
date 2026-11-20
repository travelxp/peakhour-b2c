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

const { AdAccountPicker, NoAdAccountState } = await import("./ad-account-picker");

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
    // the Page's own default is shown, and it does not say it inherits
    expect(container.textContent).toContain("CMPL");
    expect(container.textContent).not.toContain("Uses the business default");
  });

  it("★a Page with no default of its own says it uses the business default, by name", async () => {
    await mount({ activePageId: "p1", adAccountId: "111", byPage: {}, businessDefaultId: "111", accounts: [Q, C] });
    expect(container.textContent).toContain("Uses the business default: Quests Travel");
    expect(container.querySelector('[role="combobox"]')!.textContent).toContain("Use the business default");
  });

  it("a stored Page default for an account that is no longer enabled reads as inheriting", async () => {
    await mount({ activePageId: "p1", adAccountId: "111", byPage: { p1: "999" }, businessDefaultId: "111", accounts: [Q, C] });
    expect(container.textContent).toContain("Uses the business default: Quests Travel");
  });

  it("with one enabled account: a plain line with the full account id, no select", async () => {
    await mount({ activePageId: "p1", adAccountId: "111", byPage: {}, businessDefaultId: "111", accounts: [Q] });
    expect(container.querySelector('[role="combobox"]')).toBeNull();
    expect(container.textContent).toContain("Quests Travel");
    expect(container.textContent).toContain("Account ID 111 · INR");
  });

  it("★the business ticked none: says to choose in Connected accounts and links there", async () => {
    await mount({ activePageId: "p1", adAccountId: null, byPage: {}, businessDefaultId: null, listedCount: 3, accounts: [] });
    expect(container.querySelector('[role="combobox"]')).toBeNull();
    expect(container.textContent).toContain("Connected accounts");
    expect(container.textContent).not.toContain("nothing to show");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/dashboard/integrations");
  });

  it("★the login lists no ad accounts: keeps the Campaign Manager link to create one", async () => {
    await mount({ activePageId: "p1", adAccountId: null, byPage: {}, businessDefaultId: null, listedCount: 0, accounts: [] });
    expect(container.textContent).toContain("lists no ad accounts");
    expect(container.querySelector("a")?.getAttribute("href")).toContain("linkedin.com/campaignmanager");
  });

  it("★V5: with no business default the trigger shows the placeholder, not 'Use the business default'", async () => {
    await mount({ activePageId: "p1", adAccountId: null, byPage: {}, businessDefaultId: null, listedCount: 2, accounts: [Q, C] });
    const trigger = container.querySelector('[role="combobox"]')!;
    expect(trigger.textContent).toContain("Choose an ad account");
    expect(trigger.textContent).not.toContain("Use the business default");
  });

  it("★V6: every listed account is cancelled: says so and links to Campaign Manager, not round to Connected accounts", async () => {
    await mount({ activePageId: "p1", adAccountId: null, byPage: {}, businessDefaultId: null, listedCount: 1, blocked: [{ id: "444", name: "Gone Co", word: "cancelled" }], accounts: [] });
    expect(container.textContent).toContain("Gone Co is cancelled on LinkedIn");
    expect(container.querySelector("a")?.getAttribute("href")).toContain("linkedin.com/campaignmanager");
    expect(container.textContent).not.toContain("Open Connected accounts");
  });

  it("★V7: an api that does not say how many accounts the login lists reads as none: the Campaign Manager link", async () => {
    await mount({ activePageId: "p1", adAccountId: null, byPage: {}, businessDefaultId: null, accounts: [] });
    expect(container.querySelector("a")?.getAttribute("href")).toContain("linkedin.com/campaignmanager");
  });

  it("a pageless connection shows nothing", async () => {
    await mount({ activePageId: null, adAccountId: "111", byPage: {}, accounts: [Q, C] });
    expect(container.innerHTML).toBe("");
  });
});

describe("NoAdAccountState (V8)", () => {
  it("each surface gets its own sentence: the campaigns line only for campaigns, lead forms their own", () => {
    const render = (kind: "campaigns" | "lead forms") => {
      act(() => root.render(<NoAdAccountState kind={kind} />));
      return container.textContent ?? "";
    };
    expect(render("campaigns")).toContain("Campaigns that are already running stay listed");
    const forms = render("lead forms");
    expect(forms).toContain("lead forms will appear here");
    expect(forms).not.toContain("Campaigns");
  });
});
