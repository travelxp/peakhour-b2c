// @vitest-environment jsdom
/**
 * MR-G2 - the Google Ads panel shows the business's ENABLED accounts, the default first. `?customer=` for a non-enabled
 * account falls back to the default (one URL rewrite). With nothing enabled there are no controls. A listed account that is NOT
 * enabled opens a PAUSE-ONLY view: pause and lower, never create, start, targeting or bidding.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  listAdAccounts: vi.fn(),
  listCampaigns: vi.fn(),
  replace: vi.fn(),
  search: { value: "channel=google" },
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
  useSearchParams: () => new URLSearchParams(h.search.value),
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
vi.mock("@/lib/api/google-ads", async (orig) => {
  const actual = await orig<typeof import("@/lib/api/google-ads")>();
  const calls: Record<string, unknown> = { listAdAccounts: h.listAdAccounts, listCampaigns: h.listCampaigns };
  return {
    ...actual,
    googleAdsApi: new Proxy({}, { get: (_t, k: string) => calls[k] ?? vi.fn(async () => new Promise(() => undefined)) }),
  };
});
vi.mock("./google-website-conversion-section", () => ({ GoogleWebsiteConversionSection: () => <div data-testid="web-conv" /> }));
vi.mock("./google-callouts-section", () => ({ GoogleCalloutsSection: () => <div data-testid="callouts" /> }));
vi.mock("./google-reports-section", () => ({ GoogleReportsSection: () => <div data-testid="reports" /> }));
vi.mock("./google-targeting-dialog", () => ({ GoogleTargetingDialog: () => null }));
vi.mock("./google-bidding-dialog", () => ({ GoogleBiddingDialog: () => null }));
vi.mock("./google-campaign-manage-dialog", () => ({
  GoogleCampaignManageDialog: (p: { spendReducingOnly?: boolean }) => <div data-testid="manage" data-pause-only={String(!!p.spendReducingOnly)} />,
}));

const { GoogleAdsPanel } = await import("./google-ads-panel");

const mk = (id: string, name: string, currencyCode: string) => ({ id, name, currencyCode, testAccount: false });
const INDIA = mk("1111111111", "India Store", "INR");
const UK = mk("2222222222", "UK Store", "GBP");
const OTHER = mk("3333333333", "Other Biz", "USD");
const camp = (id: string, name: string, adAccountId: string, status: string) => ({ id, name, status, adAccountId, platformCampaignId: `p${id}`, channelType: "SEARCH", createdAt: "2026-11-01", budget: { daily: 10 }, currency: "USD", createState: "created" });

const answer = (enabledIds: string[], defaultId: string | null, adAccounts = [INDIA, UK, OTHER]) => ({ adAccounts, enabledIds, defaultId });

let root: Root;
let container: HTMLDivElement;

beforeAll(() => {
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
  h.listCampaigns.mockReset().mockResolvedValue({ campaigns: [] });
  h.replace.mockReset();
  h.search.value = "channel=google";
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <GoogleAdsPanel channelKey="google" />
      </QueryClientProvider>,
    );
  });
  await settle();
}
const trigger = () => container.querySelector('[aria-label="Google Ads account"]')!;

describe("Ads > Google: no enabled account", () => {
  it("the login reaches more than one: says so, links to Connected accounts, and shows no controls", async () => {
    h.listAdAccounts.mockResolvedValue(answer([], null));
    await mount();
    expect(container.textContent).toContain("Choose the ad accounts this business may use before creating campaigns. Your Google login reaches more than one.");
    expect(container.querySelector('a[href="/dashboard/integrations"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Google Ads account"]')).toBeNull();
    expect(container.textContent).not.toContain("Create campaign");
  });

  it("the login reaches one: no 'more than one'", async () => {
    h.listAdAccounts.mockResolvedValue(answer([], null, [INDIA]));
    await mount();
    expect(container.textContent).toContain("Choose the ad account this business may use in Connected accounts.");
    expect(container.textContent).not.toContain("more than one");
  });
});

describe("Ads > Google: the account in ?customer=", () => {
  it("nothing in the URL: the default is shown and the URL is written once", async () => {
    h.listAdAccounts.mockResolvedValue(answer(["1111111111", "2222222222"], "2222222222"));
    await mount();
    expect(trigger().textContent).toContain("UK Store (GBP)");
    expect(h.replace).toHaveBeenCalledTimes(1);
    expect(h.replace.mock.calls[0]![0]).toContain("customer=2222222222");
  });

  it("an id the business does not know falls back to the default with one replace", async () => {
    h.search.value = "channel=google&customer=9999999999";
    h.listAdAccounts.mockResolvedValue(answer(["1111111111", "2222222222"], "2222222222"));
    await mount();
    expect(trigger().textContent).toContain("UK Store (GBP)");
    expect(h.replace).toHaveBeenCalledTimes(1);
    expect(h.replace.mock.calls[0]![0]).toContain("customer=2222222222");
  });

  it("an enabled id (dashed spelling) is kept: no URL rewrite", async () => {
    h.search.value = "channel=google&customer=111-111-1111";
    h.listAdAccounts.mockResolvedValue(answer(["1111111111", "2222222222"], "2222222222"));
    await mount();
    expect(trigger().textContent).toContain("India Store (INR)");
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("the account query waits for the business and an enabled account gets the full controls", async () => {
    h.search.value = "channel=google&customer=1111111111";
    h.listAdAccounts.mockResolvedValue(answer(["1111111111"], "1111111111"));
    h.listCampaigns.mockResolvedValue({ campaigns: [camp("c1", "Diwali", "1111111111", "paused")] });
    await mount();
    expect(container.textContent).toContain("New campaign");
    expect(container.querySelector('[data-testid="callouts"]')).not.toBeNull();
    expect(container.textContent).toContain("Targeting");
    expect(container.textContent).toContain("Resume");
  });
});

describe("Ads > Google: an account the business did not enable is pause-only", () => {
  const open = async (status: string) => {
    h.search.value = "channel=google&customer=3333333333";
    h.listAdAccounts.mockResolvedValue(answer(["1111111111"], "1111111111"));
    h.listCampaigns.mockResolvedValue({ campaigns: [camp("c9", "Old campaign", "3333333333", status), camp("c1", "Mine", "1111111111", "active")] });
    await mount();
  };

  it("the default stays selected when nothing names an account; the others are listed apart", async () => {
    h.listAdAccounts.mockResolvedValue(answer(["1111111111"], "1111111111"));
    await mount();
    expect(trigger().textContent).toContain("India Store (INR)");
    await act(async () => { trigger().dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); (trigger() as HTMLElement).click(); });
    await settle();
    expect(document.body.textContent).toContain("Other accounts on your Google login");
    expect(document.body.textContent).toContain("Other Biz (USD)");
  });

  it("a running campaign can be paused or managed, with the one explanatory line; nothing starts, creates or targets", async () => {
    await open("active");
    expect(trigger().textContent).toContain("Other Biz (USD)");
    expect(container.textContent).toContain("Peakhour does not run new spend in this account. You can pause or lower what is running.");
    expect(container.textContent).toContain("Old campaign");
    expect(container.textContent).not.toContain("Mine");
    const buttons = [...container.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons).toContain("Pause");
    expect(buttons).toContain("Manage");
    for (const word of ["Targeting", "Bidding", "Start", "Resume"]) expect(buttons).not.toContain(word);
    expect(container.textContent).not.toContain("New campaign");
    expect(container.querySelector('[data-testid="callouts"]')).toBeNull();
    expect(container.querySelector('[data-testid="web-conv"]')).toBeNull();
    expect(container.textContent).not.toContain("Conversion tracking");
    // a URL naming a listed account is already right: no rewrite
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("a paused campaign offers no Resume at all, and Manage opens the lower-only dialog", async () => {
    await open("paused");
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent)).not.toContain("Resume");
    await act(async () => buttons.find((b) => b.textContent === "Manage")!.click());
    expect(container.querySelector('[data-testid="manage"]')!.getAttribute("data-pause-only")).toBe("true");
  });
});
