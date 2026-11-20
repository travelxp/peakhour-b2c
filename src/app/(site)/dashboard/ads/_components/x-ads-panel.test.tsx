// @vitest-environment jsdom
/**
 * MR-G3: the X Ads panel on the business's own choice of ad accounts. Enabled accounts get full controls; every other account on
 * the login is a PAUSE-ONLY view (stopping spend is never cut off); the default is preselected, never the first listed; a failed
 * background refetch never hides the switches; `?account=` naming an account the login does not list is rewritten.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  listCampaigns: vi.fn(),
  listFunding: vi.fn(),
  setCampaignStatus: vi.fn(),
  budgetInPlanCurrency: vi.fn(),
  replace: vi.fn(),
  search: "channel=x",
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
  useSearchParams: () => new URLSearchParams(h.search),
}));
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(async () => ({ integrations: [] })) },
  ApiError: class extends Error {},
}));
vi.mock("../ads-channels", async (orig) => {
  const actual = await orig<typeof import("../ads-channels")>();
  return { ...actual, panelConnection: () => ({ isConnected: true, needsReauth: false }) };
});
vi.mock("@/lib/api/x-ads", async (orig) => {
  const actual = await orig<typeof import("@/lib/api/x-ads")>();
  return {
    ...actual,
    xAdsApi: {
      ...actual.xAdsApi,
      listAccounts: h.listAccounts,
      listCampaigns: h.listCampaigns,
      listFundingInstruments: h.listFunding,
      setCampaignStatus: h.setCampaignStatus,
      budgetInPlanCurrency: h.budgetInPlanCurrency,
      analytics: vi.fn(async () => []),
    },
  };
});

const { XAdsPanel } = await import("./x-ads-panel");

const acct = (id: string, name: string) => ({ id, name, timezone: "UTC", approvalStatus: "ACCEPTED" });
const A1 = acct("a1", "Mine One");
const A2 = acct("a2", "Mine Two");
const OTHER = acct("a3", "Another Business");
const RUNNING = { id: "c1", name: "Running", status: "ACTIVE", dailyBudgetAmountLocalMicro: 10_000_000, fundingInstrumentId: "f1" };
const PAUSED = { id: "c2", name: "Parked", status: "PAUSED", dailyBudgetAmountLocalMicro: 10_000_000, fundingInstrumentId: "f1" };

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;

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
  h.search = "channel=x";
  h.replace.mockReset();
  h.listAccounts.mockReset();
  h.listCampaigns.mockReset().mockResolvedValue([RUNNING, PAUSED]);
  h.listFunding.mockReset().mockResolvedValue([{ id: "f1", type: "CREDIT_CARD", currency: "USD", description: "Card", status: "ACTIVE" }]);
  h.setCampaignStatus.mockReset().mockResolvedValue({});
  h.budgetInPlanCurrency.mockReset().mockResolvedValue({ planCurrency: "INR", planAmount: 835 });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const settle = async () => {
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

async function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <XAdsPanel channelKey="x" />
      </QueryClientProvider>,
    );
  });
  await settle();
}

const text = () => container.textContent ?? "";
const switches = () => [...container.querySelectorAll<HTMLButtonElement>('button[role="switch"]')];
const hasButton = (label: string) => [...container.querySelectorAll("button")].some((b) => b.textContent?.includes(label));

describe("enabled account: full controls", () => {
  it("opens on the DEFAULT (never the first listed), with Create campaign and a switch per campaign", async () => {
    h.listAccounts.mockResolvedValue({ accounts: [A1, A2, OTHER], enabledIds: ["a1", "a2"], defaultId: "a2" });
    await mount();
    expect(h.replace).toHaveBeenCalledWith(expect.stringContaining("account=a2"), expect.anything());
    expect(h.listCampaigns).toHaveBeenCalledWith("a2");
    expect(hasButton("Create campaign")).toBe(true);
    expect(text()).not.toContain("does not run new spend");
    expect(text()).toContain("campaign creation are live");
    expect(switches().every((s) => !s.disabled)).toBe(true);
  });

  it("Q3: two enabled and no default preselects the first ENABLED account and says to pick a default", async () => {
    h.listAccounts.mockResolvedValue({ accounts: [OTHER, A1, A2], enabledIds: ["a1", "a2"] });
    await mount();
    expect(h.listCampaigns).toHaveBeenCalledWith("a1");
    expect(text()).toContain("Pick a default in Connected accounts.");
    expect(text()).not.toContain("Choose your X ad accounts");
  });
});

describe("pause-only view", () => {
  it("Q1/U5: another account on the login opens pause-only: no Create, no Activate, the one-line note, no creation footer", async () => {
    h.search = "channel=x&account=a3";
    h.listAccounts.mockResolvedValue({ accounts: [A1, OTHER], enabledIds: ["a1"], defaultId: "a1" });
    await mount();
    expect(h.listCampaigns).toHaveBeenCalledWith("a3");
    expect(hasButton("Create campaign")).toBe(false);
    expect(text()).toContain("Peakhour does not run new spend in this account. You can pause what is running.");
    expect(text()).not.toContain("campaign creation are live");
    // the running campaign can be paused; the paused one cannot be activated
    const [running, parked] = switches();
    expect(running!.disabled).toBe(false);
    expect(running!.getAttribute("aria-checked")).toBe("true");
    expect(parked!.disabled).toBe(true);
  });

  it("U5: an empty pause-only account does not say 'Create your first campaign'", async () => {
    h.search = "channel=x&account=a3";
    h.listCampaigns.mockResolvedValue([]);
    h.listAccounts.mockResolvedValue({ accounts: [A1, OTHER], enabledIds: ["a1"], defaultId: "a1" });
    await mount();
    expect(text()).toContain("No campaigns yet");
    expect(text()).not.toContain("Create your first campaign");
    expect(text()).toContain("Nothing is running in this account.");
  });

  it("Q2: with NOTHING enabled the notice shows AND the accounts' campaigns are still reachable, pause-only", async () => {
    h.listAccounts.mockResolvedValue({ accounts: [A1, OTHER], enabledIds: [] });
    await mount();
    expect(text()).toContain("Choose your X ad accounts");
    expect(h.listCampaigns).toHaveBeenCalledWith("a1");
    expect(hasButton("Create campaign")).toBe(false);
    expect(switches().length).toBe(2);
    expect(text()).toContain("You can pause what is running.");
  });

  it("pausing works from the pause-only view", async () => {
    h.search = "channel=x&account=a3";
    h.listAccounts.mockResolvedValue({ accounts: [A1, OTHER], enabledIds: ["a1"], defaultId: "a1" });
    await mount();
    await act(async () => switches()[0]!.click());
    await settle();
    expect(h.setCampaignStatus).toHaveBeenCalledWith("a3", "c1", "PAUSED");
  });
});

describe("U3: a failed background refetch never hides the pause switches", () => {
  it("keeps the page when the accounts refetch fails after they loaded; shows the full-page error only with nothing to show", async () => {
    h.listAccounts.mockResolvedValue({ accounts: [A1], enabledIds: ["a1"], defaultId: "a1" });
    await mount();
    expect(switches().length).toBe(2);
    h.listAccounts.mockRejectedValue(new Error("blip"));
    await act(async () => {
      await client.refetchQueries({ queryKey: ["x-ads-accounts"] });
    });
    await settle();
    expect(switches().length).toBe(2);
    expect(text()).not.toContain("Couldn't load your ad accounts");
  });

  it("the full-page error is for a first load that failed", async () => {
    h.listAccounts.mockRejectedValue(new Error("down"));
    await mount();
    expect(text()).toContain("Couldn't load your ad accounts");
  });
});

describe("U8: ?account= naming an account the login does not list is rewritten to the one shown", () => {
  it("rewrites an unlisted id, and leaves a listed one (even a pause-only one) alone", async () => {
    h.search = "channel=x&account=zzz";
    h.listAccounts.mockResolvedValue({ accounts: [A1, OTHER], enabledIds: ["a1"], defaultId: "a1" });
    await mount();
    expect(h.replace).toHaveBeenCalledWith(expect.stringContaining("account=a1"), expect.anything());
    h.replace.mockReset();
    h.search = "channel=x&account=a3";
    act(() => root.unmount());
    root = createRoot(container);
    await mount();
    expect(h.replace).not.toHaveBeenCalled();
  });
});

describe("U6/U7: the selector", () => {
  it("shows only the NAME in the closed trigger, and the Default pill beside it", async () => {
    h.listAccounts.mockResolvedValue({ accounts: [A1, A2, OTHER], enabledIds: ["a1", "a2"], defaultId: "a1" });
    h.search = "channel=x&account=a1";
    await mount();
    const trigger = container.querySelector('[aria-label="Ad account"]')!;
    expect(trigger.textContent).toBe("Mine One");
    expect(text()).toContain("Default");
  });
});

describe("U1: the budget line never pairs a new amount with an old conversion", () => {
  it("hides '(about ...)' while the conversion is placeholder data, then shows it for the settled amount", async () => {
    try {
      h.listAccounts.mockResolvedValue({ accounts: [A1], enabledIds: ["a1"], defaultId: "a1" });
      h.budgetInPlanCurrency.mockImplementation(async (amount: number) => ({ planCurrency: "INR", planAmount: amount * 83.5 }));
      await mount();
      // Fake timers only now: the debounce below is the thing under test.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      await act(async () => {
        [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Create campaign"))!.click();
      });
      // choose the funding source (Radix Select: open it, then pick the option)
      await act(async () => {
        const trigger = document.getElementById("x-camp-funding")!;
        trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
      });
      await act(async () => {
        [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes("USD") || o.textContent?.includes("Card"))!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
        (document.querySelector('[role="option"]') as HTMLElement).click();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await vi.advanceTimersByTimeAsync(50);
      });
      const body = () => document.body.textContent ?? "";
      expect(body()).toContain("a day (about ");
      expect(h.budgetInPlanCurrency).toHaveBeenCalledTimes(1);
      // type a new amount: the old conversion (for 10) must not sit beside the new number
      const input = document.getElementById("x-camp-budget") as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      let release!: () => void;
      h.budgetInPlanCurrency.mockImplementation(
        (amount: number) => new Promise((r) => { release = () => r({ planCurrency: "INR", planAmount: amount * 83.5 }); }),
      );
      await act(async () => {
        setter.call(input, "20");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(body()).not.toContain("a day (about ");
      await act(async () => {
        release();
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(body()).toContain("a day (about ");
    } finally {
      vi.useRealTimers();
    }
  });
});
