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
  return { api: { patch: h.patch }, ApiError };
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
  SelectItem: ({ value, children }: { value: string; children: unknown }) => <option value={value}>{children as never}</option>,
}));

const { MetaAccountsPanel, instagramLine } = await import("./meta-accounts-panel");
const { ApiError } = await import("@/lib/api");

const EXTRA = {
  pages: [
    { pageId: "1001", pageName: "Acme", instagramAccountId: "17841", instagramUsername: "acme" },
    { pageId: "1002", pageName: "Other" },
    { pageId: "1003", pageName: "Third", instagramAccountId: "17999" },
  ],
  adAccounts: [
    { id: "act_9", name: "Acme Ads", currency: "INR", status: 1 },
    { id: "act_10", name: "Old Ads", currency: "USD", status: 2 },
  ],
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
    const ads = container.querySelector('[aria-label="Ad accounts"]')!.textContent;
    expect(ads).toContain("Acme Ads (INR)");
    expect(ads).toContain("Old Ads (USD), not active");
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

  it("shows where messages stand for the Page Peakhour uses, from the same status the panel below reads", () => {
    client.setQueryData(["meta-dm-status"], {
      channels: { messenger: true, instagram: false },
      connected: true,
      needsReauth: false,
      savedPageId: "1003",
      missingPermissions: {},
      pages: [{ pageId: "1003", pageName: "Third", instagramUsername: null, connectionId: "c", messenger: { available: true, enabled: true }, instagram: { available: false, enabled: false } }],
    });
    mount(EXTRA);
    const line = container.querySelector('[data-testid="meta-dm-pointer"]') as HTMLAnchorElement;
    expect(line.textContent).toBe("Messages: on for Third");
    expect(line.getAttribute("href")).toBe("#meta-dm-connect");
  });

  it("shows no messages line while messaging is not released (no answer from the api)", () => {
    mount(EXTRA);
    expect(container.querySelector('[data-testid="meta-dm-pointer"]')).toBeNull();
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
