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
const { AdAccountChoice } = await import("@/components/ads/ad-account-choice");
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
    // the name on its own line, then the full account number and currency
    expect(container.querySelector('[aria-label="Ad accounts"]')!.textContent).toContain("Acme Ads, Account ID 9 · INR");
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

describe("MetaAccountsPanel ad accounts checklist", () => {
  const box = (id: string) => container.querySelector(`[id$="-ad-${id}"]`) as HTMLInputElement;
  // The default control is named by its visible words plus the account ("Make default for CMPL").
  const radio = (name: string) =>
    [...container.querySelectorAll('input[type="radio"]')].find((r) => r.closest("label")?.textContent?.endsWith(` for ${name}`)) as HTMLInputElement;
  const saveButton = () => [...container.querySelectorAll("button")].find((x) => x.textContent?.includes("Save ad accounts")) as HTMLButtonElement;
  const click = async (el: HTMLElement) => {
    await act(async () => {
      el.click();
    });
  };
  const flush = () => act(async () => {});

  it("two or more listed and none ticked: the checklist, a plain warning, nothing ticked, Save disabled", () => {
    mount({ ...EXTRA, adAccounts: TWO_ADS });
    expect(container.textContent).toContain("Ad accounts Peakhour may use");
    expect(container.textContent).toContain("Choose the ad accounts this business may use before creating campaigns.");
    const labels = [...container.querySelectorAll('[aria-label="Ad accounts"] li label:first-of-type')].map((l) => l.textContent);
    expect(labels).toEqual([
      "Quests Travel, Account ID 1111 · INR",
      "CMPL, Account ID 2222 · USD",
      "Old Ads, Account ID 3333 · USD, Disabled on Meta",
    ]);
    expect(TWO_ADS.map((a) => box(a.id).checked)).toEqual([false, false, false]);
    expect(saveButton().disabled).toBe(true);
  });

  it("★a ticked account that is now disabled can be UNticked, not saved until it is, and saving drops it", async () => {
    h.patch.mockResolvedValue({});
    mount({
      ...EXTRA,
      adAccounts: [TWO_ADS[0], TWO_ADS[1], { id: "act_4444", name: "Gone", currency: "USD", status: 2 }],
      adAccountChoice: { enabledIds: ["act_1111", "act_4444"], defaultId: "act_1111" },
    });
    expect(box("act_4444").checked).toBe(true);
    expect(box("act_4444").disabled).toBe(false);
    expect(container.textContent).toContain("Disabled on Meta, untick to save");
    await click(box("act_2222"));
    expect(saveButton().disabled).toBe(true);
    await click(box("act_4444"));
    expect(box("act_4444").disabled).toBe(true);
    expect(saveButton().disabled).toBe(false);
    await click(saveButton());
    await flush();
    expect(h.patch).toHaveBeenCalledWith("/v1/integrations/facebook/ad-accounts", { enabledIds: ["act_1111", "act_2222"], defaultId: "act_1111" });
  });

  it("★payment issue, under review and grace period stay tickable, with the word on the line", () => {
    mount({
      ...EXTRA,
      adAccounts: [
        { id: "act_5", name: "A", currency: "USD", status: 3 },
        { id: "act_6", name: "B", currency: "USD", status: 7 },
        { id: "act_7", name: "C", currency: "USD", status: 9 },
      ],
    });
    expect(container.textContent).toContain("Payment issue");
    expect(container.textContent).toContain("Under review");
    expect(container.textContent).toContain("Grace period");
    for (const id of ["act_5", "act_6", "act_7"]) expect(box(id).disabled).toBe(false);
  });

  it("★two pickers on one page share no id and no radio group", () => {
    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <AdAccountChoice provider="facebook" extra={{ ...EXTRA, adAccounts: TWO_ADS }} />
          <AdAccountChoice provider="facebook" extra={{ ...EXTRA, adAccounts: TWO_ADS }} />
        </QueryClientProvider>,
      );
    });
    const ids = [...container.querySelectorAll("input[id]")].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = new Set([...container.querySelectorAll('input[type="radio"]')].map((i) => (i as HTMLInputElement).name));
    expect(names.size).toBe(2);
  });

  it("showAdAccounts={false} leaves the checklist to the Meta Ads card", () => {
    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <MetaAccountsPanel extra={{ ...EXTRA, adAccounts: TWO_ADS }} onRefresh={() => {}} refreshing={false} showAdAccounts={false} />
        </QueryClientProvider>,
      );
    });
    expect(container.textContent).not.toContain("Ad accounts Peakhour may use");
  });

  it("one saved account that Meta now flags still shows its status", () => {
    mount({ ...EXTRA, adAccounts: [{ id: "act_9", name: "Acme Ads", currency: "INR", status: 3 }], adAccountChoice: { enabledIds: ["act_9"], defaultId: "act_9" } });
    expect(container.querySelector('[aria-label="Ad accounts"]')!.textContent).toContain("Acme Ads, Account ID 9 · INR, Payment issue");
  });

  it("the default pill reads what it does, and an unticked account is never shown or announced as the default", () => {
    mount({ ...EXTRA, adAccounts: TWO_ADS, adAccountChoice: { enabledIds: ["act_1111"], defaultId: "act_2222" } });
    expect(radio("CMPL").checked).toBe(false);
    expect(radio("CMPL").closest("label")!.textContent).toBe("Make default for CMPL");
  });

  it("a disabled or closed account is shown and cannot be ticked", () => {
    mount({ ...EXTRA, adAccounts: [...TWO_ADS, { id: "act_4444", name: "Gone", currency: "USD", status: 101 }] });
    expect(box("act_3333").disabled).toBe(true);
    expect(box("act_4444").disabled).toBe(true);
    expect(container.textContent).toContain("Gone, Account ID 4444 · USD, Closed on Meta");
    expect(box("act_1111").disabled).toBe(false);
  });

  // ── MR-F3: "Used for" tags ────────────────────────────────────────────────────────────────────────────────────────────
  const usedFor = (name: string) => container.querySelector(`fieldset[aria-label="Used for: ${name}"]`) as HTMLFieldSetElement | null;
  const SAVED_TWO = { enabledIds: ["act_1111", "act_2222"], defaultId: "act_1111" };

  it("★only an ENABLED account has a Used for line, with Markets and Purpose, and the one helper line", () => {
    mount({ ...EXTRA, adAccounts: TWO_ADS, adAccountChoice: SAVED_TWO });
    expect(usedFor("Quests Travel")).not.toBeNull();
    expect(usedFor("CMPL")).not.toBeNull();
    expect(usedFor("Old Ads")).toBeNull();
    const line = usedFor("CMPL")!.textContent ?? "";
    expect(line).toContain("Markets");
    expect(line).not.toContain("Collections");
    expect(line).toContain("Purpose");
    expect(container.textContent).toContain("Peakhour uses these to choose the ad account for automated campaigns. Untagged: your default.");
  });

  it("saved tags show as chips and pressed purposes", () => {
    mount({
      ...EXTRA,
      adAccounts: TWO_ADS,
      adAccountChoice: { ...SAVED_TWO, tags: { act_2222: { markets: ["GB"], purposes: ["conversion"] } } },
    });
    const line = usedFor("CMPL")!;
    expect(line.textContent).toContain("United Kingdom");
    expect((line.querySelector("button[aria-pressed='true']") as HTMLButtonElement).textContent).toBe("Sales");
    expect(usedFor("Quests Travel")!.querySelectorAll("button[aria-pressed='true']")).toHaveLength(0);
  });

  it("★one Save sends the tags with the accounts; an untouched save sends none (the api keeps the stored tags)", async () => {
    h.patch.mockResolvedValue({});
    mount({ ...EXTRA, adAccounts: TWO_ADS, adAccountChoice: SAVED_TWO });
    const purpose = [...usedFor("CMPL")!.querySelectorAll("button")].find((b) => b.textContent === "Brand awareness") as HTMLButtonElement;
    await click(purpose);
    const select = usedFor("CMPL")!.querySelector('select[aria-label="Add a country for CMPL"]') as HTMLSelectElement;
    await act(async () => {
      select.value = "GB";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click(saveButton());
    await flush();
    expect(h.patch).toHaveBeenCalledWith("/v1/integrations/facebook/ad-accounts", {
      enabledIds: ["act_1111", "act_2222"],
      defaultId: "act_1111",
      tags: { act_2222: { markets: ["GB"], purposes: ["awareness"] } },
    });
  });

  it("★no Collections picker yet (no launch input carries collections), and the store's collections are not read", async () => {
    mount({ ...EXTRA, adAccounts: TWO_ADS, adAccountChoice: SAVED_TWO });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(usedFor("Quests Travel")!.textContent).not.toContain("Collections");
    expect((h.getStatus.mock.calls as unknown[][]).some((c) => String(c[0]).includes("ad-account/collections"))).toBe(false);
  });

  it("★a purpose ticked on and off again is not a change: Save stays off and no tags are sent", async () => {
    mount({ ...EXTRA, adAccounts: TWO_ADS, adAccountChoice: SAVED_TWO });
    const sales = () => [...usedFor("CMPL")!.querySelectorAll("button")].find((b) => b.textContent === "Sales") as HTMLButtonElement;
    await click(sales());
    expect(saveButton().disabled).toBe(false);
    await click(sales());
    expect(saveButton().disabled).toBe(true);
  });

  it("unticking an account drops its tags from the save", async () => {
    h.patch.mockResolvedValue({});
    mount({
      ...EXTRA,
      adAccounts: TWO_ADS,
      adAccountChoice: { ...SAVED_TWO, tags: { act_1111: { markets: ["IN"] }, act_2222: { markets: ["GB"] } } },
    });
    const purpose = [...usedFor("Quests Travel")!.querySelectorAll("button")].find((b) => b.textContent === "Sales") as HTMLButtonElement;
    await click(purpose);
    await click(box("act_2222"));
    expect(usedFor("CMPL")).toBeNull();
    await click(saveButton());
    await flush();
    expect(h.patch).toHaveBeenCalledWith("/v1/integrations/facebook/ad-accounts", {
      enabledIds: ["act_1111"],
      defaultId: "act_1111",
      tags: { act_1111: { markets: ["IN"], purposes: ["conversion"] } },
    });
  });

  it("saved accounts show ticked with their Default marked, and no warning", () => {
    mount({ ...EXTRA, adAccounts: TWO_ADS, adAccountChoice: { enabledIds: ["act_1111", "act_2222"], defaultId: "act_2222" } });
    expect(box("act_1111").checked).toBe(true);
    expect(box("act_2222").checked).toBe(true);
    expect(box("act_3333").checked).toBe(false);
    expect(radio("CMPL").checked).toBe(true);
    expect(radio("Quests Travel").checked).toBe(false);
    expect(container.textContent).not.toContain("Choose the ad accounts");
  });

  it("the first ticked account becomes the default; the default can be moved only among ticked accounts", async () => {
    mount({ ...EXTRA, adAccounts: TWO_ADS });
    expect(radio("CMPL").disabled).toBe(true);
    await click(box("act_2222"));
    expect(radio("CMPL").checked).toBe(true);
    await click(box("act_1111"));
    expect(radio("Quests Travel").disabled).toBe(false);
    await click(radio("Quests Travel"));
    expect(radio("Quests Travel").checked).toBe(true);
    // unticking the default hands it to the one still ticked
    await click(box("act_1111"));
    expect(radio("CMPL").checked).toBe(true);
  });

  it("Save sends every ticked account and the default, refetches Growth's reads, and says so", async () => {
    h.patch.mockResolvedValue({});
    const spy = vi.spyOn(client, "invalidateQueries");
    const onChanged = vi.fn();
    mount({ ...EXTRA, adAccounts: TWO_ADS }, { onChanged });
    await click(box("act_1111"));
    await click(box("act_2222"));
    await click(radio("CMPL"));
    await click(saveButton());
    await flush();
    expect(h.patch).toHaveBeenCalledWith("/v1/integrations/facebook/ad-accounts", {
      enabledIds: ["act_1111", "act_2222"],
      defaultId: "act_2222",
    });
    expect(spy.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0]).sort()).toEqual([
      "content-hub-integrations",
      "growth-v2",
      "meta-ads-accounts",
      "meta-ads-campaigns",
    ]);
    expect(onChanged).toHaveBeenCalled();
    expect(h.success).toHaveBeenCalled();
  });

  it("a refusal says so in plain words, refetches nothing, and keeps the edit for another try", async () => {
    h.patch.mockRejectedValue(new ApiError("AD_ACCOUNT_NOT_FOUND", "x", 400));
    const spy = vi.spyOn(client, "invalidateQueries");
    mount({ ...EXTRA, adAccounts: TWO_ADS });
    await click(box("act_1111"));
    await click(saveButton());
    await flush();
    expect(h.error.mock.calls[0]![0]).toContain("no longer on your Meta login");
    expect(spy).not.toHaveBeenCalled();
    expect(box("act_1111").checked).toBe(true);
  });

  it("an unexpected failure gets the generic words", async () => {
    h.patch.mockRejectedValue(new Error("boom"));
    mount({ ...EXTRA, adAccounts: TWO_ADS });
    await click(box("act_1111"));
    await click(saveButton());
    await flush();
    expect(h.error.mock.calls[0]![0]).toContain("Couldn't save the ad accounts");
  });

  it("★C1: one listed account that is NOT enabled (a saved choice no longer matches) shows the checklist with Save, so it can be enabled", async () => {
    h.patch.mockResolvedValue({});
    mount({ ...EXTRA, adAccounts: [{ id: "act_3333", name: "New one", currency: "USD", status: 1 }], adAccountChoice: { enabledIds: ["act_1111"], defaultId: "act_1111" } });
    expect(box("act_3333")).toBeTruthy();
    expect(box("act_3333").checked).toBe(false);
    await click(box("act_3333"));
    await click(saveButton());
    await flush();
    expect(h.patch).toHaveBeenCalledWith("/v1/integrations/facebook/ad-accounts", { enabledIds: ["act_3333"], defaultId: "act_3333" });
  });

  it("★C6: saving also refetches the Growth signal step's Meta accounts", async () => {
    h.patch.mockResolvedValue({});
    const spy = vi.spyOn(client, "invalidateQueries");
    mount({ ...EXTRA, adAccounts: TWO_ADS });
    await click(box("act_1111"));
    await click(saveButton());
    await flush();
    expect(spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: string[] }).queryKey))).toContain(JSON.stringify(["growth-v2", "signal"]));
  });

  it("no ad accounts: says so; one account is a plain line with no checklist", () => {
    mount({ ...EXTRA, adAccounts: [] });
    expect(container.textContent).toContain("No ad accounts found.");
    act(() => root.unmount());
    root = createRoot(container);
    mount(EXTRA);
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
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
