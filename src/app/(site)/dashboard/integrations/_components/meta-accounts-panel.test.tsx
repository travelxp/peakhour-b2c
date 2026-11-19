// @vitest-environment jsdom
/**
 * The Meta accounts panel on the Facebook card: Pages with their Instagram account, the picker that saves
 * which Page Peakhour uses, the ad accounts, and Refresh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  patch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  getStatus: vi.fn((): Promise<unknown> => Promise.reject(new Error("404"))),
}));

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
  return { api: { patch: h.patch, get: h.getStatus }, API_BASE_URL: "https://api.example", ApiError };
});
vi.mock("sonner", () => ({ toast: { success: h.success, error: h.error } }));
// Radix Select does not open in jsdom; a native select keeps the assertion on what the panel sends.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: unknown }) => (
    <select aria-label="Page Peakhour uses" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children as never}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: unknown }) => <>{children as never}</>,
  SelectItem: ({ value, children, disabled }: { value: string; children: unknown; disabled?: boolean }) => (
    <option value={value} disabled={disabled}>
      {children as never}
    </option>
  ),
}));

const TWO_ADS = [
  { id: "act_1111", name: "Quests Travel", currency: "INR", status: 1 },
  { id: "act_2222", name: "CMPL", currency: "USD", status: 1 },
  { id: "act_3333", name: "Old Ads", currency: "USD", status: 2 },
];

const { MetaAccountsPanel, instagramLine } = await import("./meta-accounts-panel");
const { ApiError } = await import("@/lib/api");

const EXTRA = {
  pages: [
    { pageId: "1001", pageName: "Acme", instagramAccountId: "17841", instagramUsername: "acme" },
    { pageId: "1002", pageName: "Other" },
    { pageId: "1003", pageName: "Third", instagramAccountId: "17999" },
  ],
  // ONE ad account is not a choice: it is shown as a line. The picker cases below use TWO_ADS.
  adAccounts: [{ id: "act_9", name: "Acme Ads", currency: "INR", status: 1 }],
  capabilities: { pages: { enabled: true, activeResourceId: "1003" } },
};

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient();
  h.patch.mockReset();
  h.success.mockReset();
  h.error.mockReset();
  h.getStatus.mockReset().mockRejectedValue(new Error("404"));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(extra: Record<string, unknown>, props: { onRefresh?: () => void; onChanged?: () => void; refreshing?: boolean } = {}) {
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <MetaAccountsPanel extra={extra} onRefresh={props.onRefresh ?? (() => {})} refreshing={props.refreshing ?? false} onChanged={props.onChanged} />
      </QueryClientProvider>,
    );
  });
}

describe("instagramLine", () => {
  it("names the username, says so when a linked account has none, and when nothing is linked", () => {
    expect(instagramLine({ pageId: "1", instagramAccountId: "9", instagramUsername: "acme" })).toBe("Instagram @acme");
    expect(instagramLine({ pageId: "1", instagramAccountId: "9" })).toBe("Instagram linked");
    expect(instagramLine({ pageId: "1" })).toBe("No Instagram linked");
  });
});

describe("MetaAccountsPanel", () => {
  it("lists every Page with its Instagram account, and the ad accounts", () => {
    mount(EXTRA);
    const pages = container.querySelector('[aria-label="Pages and their Instagram accounts"]')!.textContent;
    expect(pages).toContain("Acme: Instagram @acme");
    expect(pages).toContain("Other: No Instagram linked");
    // one ad account: a line, no picker
    expect(container.querySelector('[aria-label="Ad account"]')!.textContent).toContain("Acme Ads (INR) · act_…");
    expect(container.querySelectorAll("select")).toHaveLength(1);
  });

  it("shows the saved Page in the picker, and the first Page when none is saved", () => {
    mount(EXTRA);
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("1003");
    act(() => root.unmount());
    root = createRoot(container);
    mount({ ...EXTRA, capabilities: {} });
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("1001");
  });

  it("choosing a Page saves it as the one value, then refetches the hubs and comments", async () => {
    h.patch.mockResolvedValue({});
    const spy = vi.spyOn(client, "invalidateQueries");
    const onChanged = vi.fn();
    mount(EXTRA, { onChanged });
    const select = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      select.value = "1002";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(h.patch).toHaveBeenCalledWith("/v1/integrations/facebook/capabilities", {
      capability: "pages",
      enabled: true,
      activeResourceId: "1002",
    });
    expect(spy.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0]).sort()).toEqual(["meta-comments", "meta-content", "meta-dm-status"]);
    expect(onChanged).toHaveBeenCalled();
    expect(h.success).toHaveBeenCalled();
  });

  it("shows the new Page in the picker at once, before the list behind it has reloaded", async () => {
    h.patch.mockResolvedValue({});
    mount(EXTRA, { onChanged: () => {} });
    const select = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      select.value = "1002";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("1002");
  });

  it("a Page row with no id is not offered", () => {
    mount({ ...EXTRA, pages: [...EXTRA.pages, { pageName: "Broken" }, { pageId: "", pageName: "Empty" }] });
    expect(container.querySelectorAll("option")).toHaveLength(3);
    expect(container.textContent).not.toContain("Broken");
  });

  it("keeps the Pages switch as it was when the pick is saved", async () => {
    h.patch.mockResolvedValue({});
    mount({ ...EXTRA, capabilities: { pages: { enabled: false, activeResourceId: "1003" } } });
    const select = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      select.value = "1001";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(h.patch.mock.calls[0]![1]).toMatchObject({ enabled: false, activeResourceId: "1001" });
  });

  it("a Page the api refuses says so in plain words and refetches nothing", async () => {
    h.patch.mockRejectedValue(new ApiError("PAGE_NOT_FOUND", "x", 400));
    const spy = vi.spyOn(client, "invalidateQueries");
    const onChanged = vi.fn();
    mount(EXTRA, { onChanged });
    const select = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      select.value = "1002";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(h.error.mock.calls[0]![0]).toContain("Refresh your Pages");
    expect(spy).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("one Page is a name, not a picker", () => {
    mount({ ...EXTRA, pages: [EXTRA.pages[0]] });
    expect(container.querySelector("select")).toBeNull();
    expect(container.textContent).toContain("Acme");
  });

  it("Refresh calls the parent's refresh, and is disabled while one is running", () => {
    const onRefresh = vi.fn();
    mount(EXTRA, { onRefresh });
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Refresh"))!;
    act(() => button.click());
    expect(onRefresh).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    root = createRoot(container);
    mount(EXTRA, { onRefresh, refreshing: true });
    const busy = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Refreshing")) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
  });

  it("with no Pages, says so and still shows the ad accounts", () => {
    mount({ pages: [], adAccounts: EXTRA.adAccounts });
    expect(container.textContent).toContain("No Facebook Pages found");
    expect(container.textContent).toContain("Acme Ads");
  });
});

describe("MetaAccountsPanel ad account picker", () => {
  const adSelect = () => container.querySelectorAll("select")[1] as HTMLSelectElement;
  const choose = async (value: string) => {
    await act(async () => {
      adSelect().value = value;
      adSelect().dispatchEvent(new Event("change", { bubbles: true }));
    });
  };

  it("two or more accounts and none chosen: a picker, a plain warning, and no first-listed default", () => {
    mount({ ...EXTRA, adAccounts: TWO_ADS });
    expect(adSelect()).toBeTruthy();
    expect(container.textContent).toContain("Choose the ad account for this workspace before creating campaigns.");
    // each option reads Name (CURRENCY) · act_…last4, and an inactive account says so and is not pickable
    const options = [...adSelect().querySelectorAll("option")];
    expect(options.map((o) => o.textContent)).toEqual([
      "Quests Travel (INR) · act_…1111",
      "CMPL (USD) · act_…2222",
      "Old Ads (USD) · act_…3333, not active",
    ]);
    expect(options[2]!.disabled).toBe(true);
    expect(options[0]!.disabled).toBe(false);
  });

  it("a saved account is the one shown, and there is no warning", () => {
    mount({ ...EXTRA, adAccounts: TWO_ADS, capabilities: { ...EXTRA.capabilities, adAccounts: { activeResourceId: "act_2222" } } });
    expect(adSelect().value).toBe("act_2222");
    expect(container.textContent).not.toContain("Choose the ad account");
  });

  it("choosing saves the one value, refetches Growth's reads, and says so", async () => {
    h.patch.mockResolvedValue({});
    const spy = vi.spyOn(client, "invalidateQueries");
    const onChanged = vi.fn();
    mount({ ...EXTRA, adAccounts: TWO_ADS }, { onChanged });
    await choose("act_2222");
    expect(h.patch).toHaveBeenCalledWith("/v1/integrations/facebook/ad-account", { adAccountId: "act_2222" });
    expect(spy.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0]).sort()).toEqual([
      "content-hub-integrations",
      "meta-ads-accounts",
      "meta-ads-campaigns",
    ]);
    expect(onChanged).toHaveBeenCalled();
    expect(h.success).toHaveBeenCalled();
    // shown at once, before the list behind it reloads; the warning is gone
    expect(adSelect().value).toBe("act_2222");
    expect(container.textContent).not.toContain("Choose the ad account");
  });

  it("an account the api refuses says so in plain words, refetches nothing, and keeps the warning", async () => {
    h.patch.mockRejectedValue(new ApiError("AD_ACCOUNT_NOT_FOUND", "x", 400));
    const spy = vi.spyOn(client, "invalidateQueries");
    mount({ ...EXTRA, adAccounts: TWO_ADS });
    await choose("act_2222");
    expect(h.error.mock.calls[0]![0]).toContain("no longer on your Meta login");
    expect(spy).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Choose the ad account");
  });

  it("an unexpected failure gets the generic words", async () => {
    h.patch.mockRejectedValue(new Error("boom"));
    mount({ ...EXTRA, adAccounts: TWO_ADS });
    await choose("act_2222");
    expect(h.error.mock.calls[0]![0]).toContain("Couldn't change the ad account");
  });

  it("no ad accounts: says so", () => {
    mount({ ...EXTRA, adAccounts: [] });
    expect(container.textContent).toContain("No ad accounts found.");
  });
});

describe("MetaAccountsPanel messaging switches", () => {
  const dm = {
    channels: { messenger: true, instagram: false },
    connected: true,
    needsReauth: false,
    savedPageId: "1003",
    missingPermissions: {},
    pages: [{ pageId: "1003", pageName: "Third", instagramUsername: null, connectionId: "c", messenger: { available: true, enabled: true }, instagram: { available: false, enabled: false } }],
  };

  it("shows the switches for the Page Peakhour uses, and none without a status", () => {
    mount(EXTRA);
    expect(container.querySelector('[data-testid="meta-messaging-switches"]')).toBeNull();
    client.setQueryData(["meta-dm-status"], dm);
    mount(EXTRA);
    expect(container.querySelector('[data-testid="meta-messaging-switches"]')).not.toBeNull();
  });

  it("hides them while a Page pick saves", async () => {
    const both = { ...dm, pages: [...dm.pages, { ...dm.pages[0], pageId: "1002", pageName: "Other" }] };
    client.setQueryData(["meta-dm-status"], both);
    h.getStatus.mockResolvedValue(both);
    let resolve!: () => void;
    h.patch.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    mount(EXTRA);
    const select = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      select.value = "1002";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="meta-messaging-switches"]')).toBeNull();
    await act(async () => resolve());
    expect(container.querySelector('[data-testid="meta-messaging-switches"]')).not.toBeNull();
    // the re-read after the pick really fetched: the switches stayed mounted and observed the status
    expect(h.getStatus).toHaveBeenCalled();
  });
});
