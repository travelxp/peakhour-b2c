// @vitest-environment jsdom
/**
 * MR-F2 - Growth shows the business's ENABLED Meta ad accounts: an account filter ("All accounts" first), every campaign
 * under its account, no `?adAccount=`, and with nothing enabled no way to start spend. Another business's accounts on the
 * same Meta login are never offered to start spend in.
 *
 * MR-G4 - those other accounts are listed apart ("Other accounts on your Meta login") and open PAUSE-ONLY: a running campaign
 * there can be paused or have its budget lowered, and nothing else.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  listAdAccounts: vi.fn(),
  listCampaigns: vi.fn(),
  listDatasets: vi.fn(),
  getSelectedDataset: vi.fn(),
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
      getSelectedDataset: h.getSelectedDataset,
      listDatasets: h.listDatasets,
    },
  };
});
vi.mock("./meta-campaign-dialogs", () => ({
  NewCampaignDialog: (p: { accounts: Array<{ id: string }>; defaultAccountId: string | null; initialAccountId?: string | null; onCreated: (campaignId: string, accountId: string) => void }) => (
    <button data-testid="new-campaign" onClick={() => p.onCreated("new-1", "act_1111")} data-accounts={p.accounts.map((x) => x.id).join(",")} data-default={p.defaultAccountId ?? ""} data-initial={p.initialAccountId ?? ""}>
      New campaign
    </button>
  ),
  EditCampaignButton: (p: { lowerOnly?: boolean }) => <button data-lower-only={p.lowerOnly ? "yes" : "no"}>{p.lowerOnly ? "Lower budget" : "Edit campaign"}</button>,
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
  h.getSelectedDataset.mockReset().mockResolvedValue({ selected: null });
  h.listDatasets.mockReset().mockResolvedValue({ datasets: [] });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const settle = async () => {
  // the accounts read, then the campaigns reads behind it, then the render
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

let lastClient: QueryClient;

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  lastClient = client;
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
  it("several enabled: the business's DEFAULT account is selected first, with 'All accounts' still an option", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
    await mount();
    expect(container.querySelector('[aria-label="Ad account filter"]')!.textContent).toContain("CMPL (USD) · act_…2222");
    expect([...container.querySelectorAll("h2")].map((x) => x.textContent)).toEqual(["CMPL (USD) · act_…2222"]);
    expect(h.listCampaigns).not.toHaveBeenCalledWith("act_1111");
  });

  it("no default (several enabled, none marked): 'All accounts' is selected, each enabled account is its own section, every campaign names its account", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], null));
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

  it("an account on the login that is not the business's is not read or shown until chosen, and never offered to New campaign", async () => {
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
    expect(nc.getAttribute("data-initial")).toBe("act_2222");
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
      "Other Biz (USD) · act_…3333",
    ]);
    expect(document.body.textContent).toContain("Other accounts on your Meta login");
    await act(async () => {
      options[2]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle();
    expect([...container.querySelectorAll("h2")].map((x) => x.textContent)).toEqual(["CMPL (USD) · act_…2222"]);
    expect(container.querySelector('[data-testid="new-campaign"]')!.getAttribute("data-initial")).toBe("act_2222");
  });

  it("★the accounts query is scoped by business, so another business's answer is never served for this one", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
    await mount();
    expect(lastClient.getQueryCache().find({ queryKey: ["meta-ads-accounts", "b1"] })).toBeTruthy();
    expect(lastClient.getQueryCache().find({ queryKey: ["meta-ads-accounts"], exact: true })).toBeUndefined();
  });

  it("★the dataset card starts from the account the dataset in use belongs to, not the default", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
    h.getSelectedDataset.mockResolvedValue({ selected: { id: "d1", adAccountId: "act_1111", name: "Quests pixel" } });
    await mount();
    const change = [...container.querySelectorAll("button")].find((b) => b.textContent === "Change dataset")!;
    await act(async () => change.click());
    await settle();
    expect(h.listDatasets).toHaveBeenCalledWith("act_1111");
    expect(h.listDatasets).not.toHaveBeenCalledWith("act_2222");
    expect(container.querySelector('[aria-label="Dataset ad account"]')!.textContent).toContain("Quests Travel");
  });

  it("★C5: a campaign created in ANOTHER account than the one filtered to switches the filter to that account", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
    await mount();
    // filtered to the default (CMPL); the dialog reports a create in QUESTS
    expect([...container.querySelectorAll("h2")].map((x) => x.textContent)).toEqual(["CMPL (USD) · act_…2222"]);
    await act(async () => (container.querySelector('[data-testid="new-campaign"]') as HTMLElement).click());
    await settle();
    expect([...container.querySelectorAll("h2")].map((x) => x.textContent)).toEqual(["Quests Travel (INR) · act_…1111"]);
  });

  it("has no ad account URL param: nothing writes the URL, and a stale ?adAccount= is ignored", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
    await mount();
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("★every enabled account missing from the login: its own empty state, no controls", async () => {
    h.listAdAccounts.mockResolvedValue({ accounts: [QUESTS, CMPL, OTHER], enabledAccounts: [{ id: "act_9999", missing: true }], enabledIds: [], defaultId: null });
    await mount();
    expect(container.textContent).toContain("The ad account you chose is no longer on your Meta login. Reconnect Meta or choose another.");
    expect(container.textContent).not.toContain("Choose the ad accounts this business may use");
    expect(container.textContent).not.toContain("New campaign");
  });

  it("★the plural copy: '2 of your ad accounts are no longer on your Meta login and are not shown.'", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS], "act_1111", ["act_8", "act_9"]));
    await mount();
    expect(container.textContent).toContain("2 of your ad accounts are no longer on your Meta login and are not shown.");
  });

  it("one enabled account is the selection: no 'All accounts', its section, no account line", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS], "act_1111"));
    await mount();
    expect(container.querySelector('[aria-label="Ad account filter"]')!.textContent).toContain("Quests Travel (INR) · act_…1111");
    expect([...container.querySelectorAll("h2")].map((x) => x.textContent)).toEqual(["Quests Travel (INR) · act_…1111"]);
    expect(container.textContent).toContain("New campaign");
    expect(container.textContent).not.toContain("Quests Travel (act_…1111)");
  });

  it("nothing enabled: the Choose notice with the link, no New campaign or Edit, and the login's accounts still open pause-only", async () => {
    h.listAdAccounts.mockResolvedValue(answer([], null));
    await mount();
    expect(container.textContent).toContain("Choose your ad accounts");
    expect(container.textContent).toContain("Choose the ad accounts this business may use before creating campaigns.");
    expect(container.querySelector('a[href="/dashboard/integrations"]')).not.toBeNull();
    expect(container.textContent).not.toContain("New campaign");
    expect(container.textContent).not.toContain("Edit campaign");
    // the first account on the login is shown, pause-only, with its running campaign
    expect(h.listCampaigns).toHaveBeenCalledTimes(1);
    expect(h.listCampaigns).toHaveBeenCalledWith("act_1111");
    expect(container.textContent).toContain("Peakhour does not run new spend in this account. You can pause or lower what is running.");
    expect(container.textContent).toContain("Diwali");
  });

  describe("MR-G4: an account the business has not enabled is pause-only", () => {
    const ACTIVE = { ...CAMPAIGN, status: "ACTIVE", dailyBudget: "5000" };
    const PAUSED = { ...CAMPAIGN, id: "10", name: "Holi", status: "PAUSED", dailyBudget: "5000" };
    const pick = async (label: string) => {
      await act(async () => {
        (container.querySelector('[aria-label="Ad account filter"]') as HTMLElement).click();
      });
      const option = [...document.body.querySelectorAll('[role="option"]')].find((o) => o.textContent!.includes(label))!;
      await act(async () => {
        option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await settle();
    };

    it("lists the unticked accounts in an 'Other accounts on your Meta login' group, after the business's own", async () => {
      h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
      await mount();
      await act(async () => {
        (container.querySelector('[aria-label="Ad account filter"]') as HTMLElement).click();
      });
      const labels = [...document.body.querySelectorAll('[role="group"] [role="option"], [role="group"] [id]')];
      expect(document.body.textContent).toContain("Other accounts on your Meta login");
      expect(labels.some((l) => l.textContent?.includes("Other Biz"))).toBe(true);
      expect(labels.some((l) => l.textContent?.includes("CMPL"))).toBe(false);
    });

    it("choosing one shows its campaigns with the pause switch and Lower budget only: no New campaign, no Change dataset, the pause-only line", async () => {
      h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
      h.listCampaigns.mockImplementation(async (id: string) => ({ campaigns: id === "act_3333" ? [ACTIVE] : [CAMPAIGN], truncated: false }));
      await mount();
      await pick("Other Biz");
      expect(h.listCampaigns).toHaveBeenCalledWith("act_3333");
      expect([...container.querySelectorAll("h2")].map((x) => x.textContent)).toEqual(["Other Biz (USD) · act_…3333"]);
      expect(container.textContent).toContain("Peakhour does not run new spend in this account. You can pause or lower what is running.");
      expect(container.querySelector('[data-testid="new-campaign"]')).toBeNull();
      expect(container.textContent).not.toContain("Edit campaign");
      expect(container.querySelector('[data-lower-only="yes"]')!.textContent).toBe("Lower budget");
      const sw = container.querySelector('[role="switch"]')!;
      expect(sw.getAttribute("aria-label")).toBe("Pause campaign Diwali");
      expect(container.textContent).not.toContain("Change dataset");
    });

    it("a PAUSED campaign there has no switch to turn it on, and no Lower budget without a budget of its own", async () => {
      h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
      h.listCampaigns.mockImplementation(async (id: string) => ({ campaigns: id === "act_3333" ? [PAUSED, { ...CAMPAIGN, id: "11", name: "No budget", status: "ACTIVE" }] : [CAMPAIGN], truncated: false }));
      await mount();
      await pick("Other Biz");
      const labels = [...container.querySelectorAll('[role="switch"]')].map((x) => x.getAttribute("aria-label"));
      expect(labels).toEqual(["Pause campaign No budget"]);
      expect(container.querySelectorAll('[data-lower-only="yes"]')).toHaveLength(1);
    });

    it("an enabled account still has the full controls (Edit, switch to activate, New campaign)", async () => {
      h.listAdAccounts.mockResolvedValue(answer([QUESTS, CMPL], "act_2222"));
      await mount();
      expect(container.querySelector('[role="switch"]')!.getAttribute("aria-label")).toBe("Activate campaign Diwali");
      expect(container.querySelector('[data-lower-only="no"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="new-campaign"]')).not.toBeNull();
    });

    it("nothing enabled: the notice stays, and a running campaign in the login's account can still be paused", async () => {
      h.listAdAccounts.mockResolvedValue(answer([], null));
      h.listCampaigns.mockResolvedValue({ campaigns: [ACTIVE], truncated: false });
      await mount();
      expect(container.textContent).toContain("Choose your ad accounts");
      expect(container.querySelector('[role="switch"]')!.getAttribute("aria-label")).toBe("Pause campaign Diwali");
      expect(container.querySelector('[data-testid="new-campaign"]')).toBeNull();
    });
  });

  it("an enabled account the login no longer has is flagged, not shown or used", async () => {
    h.listAdAccounts.mockResolvedValue(answer([QUESTS], "act_1111", ["act_9999"]));
    await mount();
    expect(container.textContent).toContain("One of your ad accounts is no longer on your Meta login");
    expect(h.listCampaigns).not.toHaveBeenCalledWith("act_9999");
  });
});
