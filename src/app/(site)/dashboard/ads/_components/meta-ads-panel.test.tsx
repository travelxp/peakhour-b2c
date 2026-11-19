// @vitest-environment jsdom
/**
 * MR-F2 - Growth shows the business's ENABLED Meta ad accounts: an account filter ("All accounts" first), every campaign
 * under its account, no `?adAccount=`, and with nothing enabled no way to start spend. Another business's accounts on the
 * same Meta login are never shown.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  listAdAccounts: vi.fn(),
  listCampaigns: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => (
    <a href={href} {...rest}>
      {children as never}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: h.replace }),
  usePathname: () => "/dashboard/ads",
  useSearchParams: () => new URLSearchParams("channel=meta&adAccount=act_1111"),
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "b1", name: "Quests Travel Pvt" } }) }));
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(async () => ({ integrations: [] })) },
  ApiError: class extends Error {},
}));
vi.mock("../ads-channels", async (orig) => {
  const actual = await orig<typeof import("../ads-channels")>();
  return { ...actual, panelConnection: () => ({ isConnected: true, needsReauth: false }) };
});
vi.mock("@/lib/api/meta-ads", async (orig) => {
  const actual = await orig<typeof import("@/lib/api/meta-ads")>();
  return {
    ...actual,
    metaAdsApi: {
      ...actual.metaAdsApi,
      listAdAccounts: h.listAdAccounts,
      listCampaigns: h.listCampaigns,
      insights: vi.fn(async () => []),
      getSelectedDataset: vi.fn(async () => ({ selected: null })),
      listDatasets: vi.fn(async () => ({ datasets: [] })),
    },
  };
});
vi.mock("./meta-campaign-dialogs", () => ({
  NewCampaignDialog: (p: { accounts: Array<{ id: string }>; defaultAccountId: string | null; initialAccountId?: string | null }) => (
    <button data-testid="new-campaign" data-accounts={p.accounts.map((x) => x.id).join(",")} data-default={p.defaultAccountId ?? ""} data-initial={p.initialAccountId ?? ""}>
      New campaign
    </button>
  ),
  EditCampaignButton: () => <button>Edit campaign</button>,
}));

const { MetaAdsPanel } = await import("./meta-ads-panel");

const mk = (id: string, name: string, currency: string) => ({ id, name, accountId: id.replace("act_", ""), currency, timezone: "UTC", accountStatus: 1 });
const QUESTS = mk("act_1111", "Quests Travel", "INR");
const CMPL = mk("act_2222", "CMPL", "USD");
/** On the same login, but another business's. */
const OTHER = mk("act_3333", "Other Biz", "USD");
const CAMPAIGN = { id: "9", name: "Diwali", status: "PAUSED", objective: "OUTCOME_TRAFFIC", createdTime: "", updatedTime: "" };

/** What the api answers: the live list, and this business's own accounts. */
const answer = (enabled: Array<ReturnType<typeof mk>>, defaultId: string | null, missing: string[] = []) => ({
  accounts: [QUESTS, CMPL, OTHER],
  enabledAccounts: [...enabled.map((a) => ({ id: a.id, name: a.name, currency: a.currency, status: 1, missing: false })), ...missing.map((id) => ({ id, missing: true }))],
  enabledIds: enabled.map((a) => a.id),
  defaultId,
});

let root: Root;
let container: HTMLDivElement;

beforeAll(() => {
  // Radix Select in jsdom
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = () => undefined;
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => undefined;
});

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  h.listAdAccounts.mockReset();
  h.listCampaigns.mockReset().mockResolvedValue({ campaigns: [CAMPAIGN], truncated: false });
  h.replace.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const settle = async () => {
  // the accounts read, then the campaigns reads behind it, then the render
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MetaAdsPanel />
      </QueryClientProvider>,
    );
  });
  await settle();
}

describe("Growth > Ads > Meta", () => {
  it("several enabled: 'All accounts' is selected, each enabled account is its own section, every campaign names its account", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
    await mount();
    const bar = container.querySelector('[aria-label="Ad accounts"]')!;
    expect(bar.textContent).toContain("Quests Travel Pvt");
    expect(container.querySelector('[aria-label="Ad account filter"]')!.textContent).toContain("All accounts");
    expect(h.listCampaigns).toHaveBeenCalledWith("act_1111");
    expect(h.listCampaigns).toHaveBeenCalledWith("act_2222");
    const headings = [...container.querySelectorAll("h2")].map((x) => x.textContent);
    expect(headings).toEqual(["Quests Travel (INR) · act_…1111", "CMPL (USD) · act_…2222"]);
    expect(container.textContent).toContain("Quests Travel (act_…1111)");
    expect(container.textContent).toContain("CMPL (act_…2222)");
    const change = [...bar.querySelectorAll("a")].find((a) => a.textContent === "Change")!;
    expect(change.getAttribute("href")).toBe("/dashboard/integrations");
  });

  it("another business's account on the login is never read, listed or offered", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
    await mount();
    expect(h.listCampaigns).not.toHaveBeenCalledWith("act_3333");
    expect(container.textContent).not.toContain("Other Biz");
    expect(container.querySelector('[data-testid="new-campaign"]')!.getAttribute("data-accounts")).toBe("act_1111,act_2222");
  });

  it("New campaign gets the enabled accounts and the default, and Edit shows", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
    await mount();
    const nc = container.querySelector('[data-testid="new-campaign"]')!;
    expect(nc.getAttribute("data-default")).toBe("act_2222");
    expect(nc.getAttribute("data-initial")).toBe("");
    expect(container.textContent).toContain("Edit campaign");
  });

  it("choosing one account in the filter shows only that account, and hands it to New campaign", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
    await mount();
    await act(async () => {
      (container.querySelector('[aria-label="Ad account filter"]') as HTMLElement).click();
    });
    const options = [...document.body.querySelectorAll('[role="option"]')];
    expect(options.map((o) => o.textContent)).toEqual([
      "All accounts",
      "Quests Travel (INR) · act_…1111",
      "CMPL (USD) · act_…2222 · default",
    ]);
    await act(async () => {
      options[2]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle();
    expect([...container.querySelectorAll("h2")].map((x) => x.textContent)).toEqual(["CMPL (USD) · act_…2222"]);
    expect(container.querySelector('[data-testid="new-campaign"]')!.getAttribute("data-initial")).toBe("act_2222");
  });

  it("has no ad account URL param: nothing writes the URL, and a stale ?adAccount= is ignored", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
    await mount();
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("one enabled account is the selection: no filter, its section, no account line", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS], "act_1111"));
    await mount();
    expect(container.querySelector('[aria-label="Ad account filter"]')).toBeNull();
    expect(container.querySelector('[aria-label="Ad accounts"]')!.textContent).toContain("Quests Travel (INR) · act_…1111");
    expect(container.textContent).toContain("New campaign");
    expect(container.textContent).not.toContain("Quests Travel (act_…1111)");
  });

  it("nothing enabled: an empty state with the link, and no New campaign, Edit or switches; nothing is read", async () => {
    h.listAdAccounts.mockResolvedValue(answer([], null));
    await mount();
    expect(container.textContent).toContain("Choose your ad accounts");
    expect(container.textContent).toContain("Choose the ad accounts this business may use before creating campaigns.");
    expect(container.querySelector('a[href="/dashboard/integrations"]')).not.toBeNull();
    expect(container.textContent).not.toContain("New campaign");
    expect(container.textContent).not.toContain("Edit campaign");
    expect(container.querySelector('[role="switch"]')).toBeNull();
    expect(h.listCampaigns).not.toHaveBeenCalled();
  });

  it("an enabled account the login no longer has is flagged, not shown or used", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS], "act_1111", ["act_9999"]));
    await mount();
    expect(container.textContent).toContain("One of your ad accounts is no longer on your Meta login");
    expect(h.listCampaigns).not.toHaveBeenCalledWith("act_9999");
  });
});
