// @vitest-environment jsdom
/**
 * MR-F2 - Growth shows ONE active Meta ad account: no dropdown, no `?adAccount=`, the workspace named beside it, and
 * with two or more accounts and none chosen no way to start spend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  NewCampaignDialog: () => <button>New campaign</button>,
  EditCampaignButton: () => <button>Edit campaign</button>,
}));

const { MetaAdsPanel } = await import("./meta-ads-panel");

const QUESTS = { id: "act_1111", name: "Quests Travel", accountId: "1111", currency: "INR", timezone: "Asia/Kolkata", accountStatus: 1 };
const CMPL = { id: "act_2222", name: "CMPL", accountId: "2222", currency: "USD", timezone: "UTC", accountStatus: 1 };
const CAMPAIGN = { id: "9", name: "Diwali", status: "PAUSED", objective: "OUTCOME_TRAFFIC", createdTime: "", updatedTime: "" };

let root: Root;
let container: HTMLDivElement;

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

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MetaAdsPanel />
      </QueryClientProvider>,
    );
  });
  // the accounts read, then the campaigns read behind it, then the render
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe("Growth > Ads > Meta", () => {
  it("shows the active ad account: name, currency, id, the workspace, and a Change link", async () => {
    h.listAdAccounts.mockResolvedValue({ accounts: [QUESTS, CMPL], activeAdAccountId: "act_2222", activeAdAccountName: "CMPL" });
    await mount();
    const bar = container.querySelector('[aria-label="Active ad account"]')!;
    expect(bar.textContent).toContain("Active ad account");
    expect(bar.textContent).toContain("CMPL");
    expect(bar.textContent).toContain("(USD)");
    expect(bar.textContent).toContain("act_2222");
    expect(bar.textContent).toContain("Quests Travel Pvt");
    const change = [...bar.querySelectorAll("a")].find((a) => a.textContent === "Change")!;
    expect(change.getAttribute("href")).toBe("/dashboard/integrations");
  });

  it("has no ad account dropdown, ignores a stale ?adAccount= and never writes the URL", async () => {
    h.listAdAccounts.mockResolvedValue({ accounts: [QUESTS, CMPL], activeAdAccountId: "act_2222", activeAdAccountName: "CMPL" });
    await mount();
    expect(container.querySelector('[aria-label="Ad account"]')).toBeNull();
    // the URL says act_1111; the campaigns read is for the ACTIVE account
    expect(h.listCampaigns).toHaveBeenCalledWith("act_2222");
    expect(h.listCampaigns).not.toHaveBeenCalledWith("act_1111");
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("an active account shows New campaign and Edit", async () => {
    h.listAdAccounts.mockResolvedValue({ accounts: [QUESTS, CMPL], activeAdAccountId: "act_2222", activeAdAccountName: "CMPL" });
    await mount();
    expect(container.textContent).toContain("New campaign");
    expect(container.textContent).toContain("Edit campaign");
  });

  it("two accounts and none chosen: an empty state with the link, and no New campaign, Edit or switches", async () => {
    h.listAdAccounts.mockResolvedValue({ accounts: [QUESTS, CMPL], activeAdAccountId: null, activeAdAccountName: null });
    await mount();
    expect(container.textContent).toContain("Choose your ad account");
    expect(container.textContent).toContain("Choose the ad account for this workspace before creating campaigns.");
    expect(container.querySelector('a[href="/dashboard/integrations"]')).not.toBeNull();
    expect(container.textContent).not.toContain("New campaign");
    expect(container.textContent).not.toContain("Edit campaign");
    expect(container.querySelector('[role="switch"]')).toBeNull();
    // nothing about any account's campaigns was read
    expect(h.listCampaigns).not.toHaveBeenCalled();
  });

  it("an active id the live list no longer has is treated as not chosen", async () => {
    h.listAdAccounts.mockResolvedValue({ accounts: [QUESTS, CMPL], activeAdAccountId: "act_9999", activeAdAccountName: "Gone" });
    await mount();
    expect(container.textContent).toContain("Choose your ad account");
    expect(container.textContent).not.toContain("New campaign");
  });

  it("one account is the active one with no choosing", async () => {
    h.listAdAccounts.mockResolvedValue({ accounts: [QUESTS], activeAdAccountId: "act_1111", activeAdAccountName: "Quests Travel" });
    await mount();
    expect(container.querySelector('[aria-label="Active ad account"]')!.textContent).toContain("Quests Travel");
    expect(container.textContent).toContain("New campaign");
  });
});
