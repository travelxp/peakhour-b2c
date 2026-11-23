// @vitest-environment jsdom
/**
 * Automatic writing (W2-A): every job is OFF until turned on, each shows its price per draft in Peaks from the api, turning one on asks first (Yes / No, with the one
 * monthly limit), sends back the price that was shown, and a refusal is said in the api's words. Only an owner or admin can change it. No currency figure, no typed price.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AutoWriteInput, AutoWriteJobKey, AutoWriteStatus } from "@/lib/auto-write";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), role: "admin" as string }));
vi.mock("@/lib/api", () => ({ api: { get: h.get, put: h.put }, API_BASE_URL: "https://api.example" }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ org: { _id: "o1" }, orgs: [{ _id: "o1", role: h.role }] }) }));

const { AutoWriteCard } = await import("./auto-write-card");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const JOBS: Array<[AutoWriteJobKey, string]> = [
  ["weekly_plan", "Weekly plan"],
  ["new_blog_post", "New blog post"],
  ["new_product", "New product"],
  ["sale_or_festival", "Sale or festival"],
  ["recycle_top_post", "Reuse a top post"],
  ["fresh_recurring", "Fresh recurring posts"],
];

const status = (over: Partial<AutoWriteStatus> = {}, on: AutoWriteJobKey[] = [], price: number | null = 225): AutoWriteStatus => ({
  monthlyCapPeaks: null,
  usedPeaks: 0,
  remainingPeaks: null,
  month: "2026-11",
  runs: false,
  jobs: JOBS.map(([job, label]) => ({ job, label, what: `${label} text`, enabled: on.includes(job), pricePerDraftPeaks: price, acceptedPricePeaks: on.includes(job) ? 225 : null, needsReaccept: false })),
  ...over,
});

let root: Root;
let host: HTMLElement;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  h.get.mockReset();
  h.put.mockReset();
  h.role = "admin";
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
async function settle(times = 4) {
  for (let i = 0; i < times; i++) await flush();
}

async function mount(initial: AutoWriteStatus) {
  let current = initial;
  h.get.mockImplementation(async () => current);
  h.put.mockImplementation(async (_url: string, body: AutoWriteInput) => {
    const cap = body.monthlyCapPeaks === undefined ? current.monthlyCapPeaks : body.monthlyCapPeaks;
    current = {
      ...current,
      monthlyCapPeaks: cap,
      remainingPeaks: cap,
      jobs: current.jobs.map((j) => (body.jobs?.[j.job] ? { ...j, enabled: body.jobs[j.job]!.enabled } : j)),
    };
    return current;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <AutoWriteCard />
      </QueryClientProvider>,
    );
  });
  await settle();
}
const sw = (job: AutoWriteJobKey) => host.querySelector<HTMLButtonElement>(`#auto-write-${job}`)!;
const dialog = () => document.body.querySelector<HTMLElement>('[data-testid="auto-write-confirm"]');
const button = (label: string) => [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label);
const click = async (el: HTMLElement | undefined) => {
  await act(async () => {
    el!.click();
  });
  await settle();
};
const type = async (el: HTMLInputElement, value: string) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
};

describe("the card", () => {
  it("lists all six jobs, every one OFF, each with its price per draft in Peaks from the api, and says nothing runs without a limit", async () => {
    await mount(status());
    for (const [job] of JOBS) {
      expect(sw(job).getAttribute("aria-checked")).toBe("false");
      expect(host.querySelector(`[data-testid="auto-write-price-${job}"]`)!.textContent).toBe("Each draft costs 225 Peaks, and only when the draft is written.");
    }
    expect(host.querySelectorAll('[data-testid^="auto-write-job-"]')).toHaveLength(6);
    expect(host.querySelector('[data-testid="auto-write-nolimit"]')).not.toBeNull();
    expect(host.querySelector("#auto-write-limit")).toBeNull();
  });

  it("follows the rate card: another price reads as that price, and no currency figure is shown", async () => {
    await mount(status({}, [], 300));
    expect(host.textContent).toContain("300 Peaks");
    expect(host.textContent).not.toContain("225");
    expect(host.textContent).not.toMatch(/[$₹£€]/);
  });

  it("turning a job ON opens the confirmation with its price, the suggested limit and 'nothing is posted', and saves nothing yet", async () => {
    await mount(status());
    await click(sw("weekly_plan"));
    expect(dialog()).not.toBeNull();
    expect(dialog()!.textContent).toContain("Weekly plan: each draft costs 225 Peaks");
    expect(dialog()!.textContent).toContain("1,125 Peaks a month, which is 5 drafts");
    expect(dialog()!.textContent).toContain("Nothing is posted until you say OK");
    expect(dialog()!.querySelector<HTMLInputElement>("#auto-write-confirm-limit")!.value).toBe("1125");
    expect(h.put).not.toHaveBeenCalled();
    expect(sw("weekly_plan").getAttribute("aria-checked")).toBe("false");
  });

  it("No leaves it off and saves nothing", async () => {
    await mount(status());
    await click(sw("new_product"));
    await click(button("No"));
    expect(dialog()).toBeNull();
    expect(h.put).not.toHaveBeenCalled();
  });

  it("Yes sends the limit and the price that was shown for THAT job, and the card reads ON with the usage", async () => {
    await mount(status());
    await click(sw("new_blog_post"));
    await type(dialog()!.querySelector<HTMLInputElement>("#auto-write-confirm-limit")!, "2,250");
    expect(dialog()!.textContent).toContain("2,250 Peaks a month, which is 10 drafts");
    await click(button("Yes, turn on"));
    expect(h.put).toHaveBeenCalledWith("/v1/content/auto-write", { monthlyCapPeaks: 2250, jobs: { new_blog_post: { enabled: true, acceptedPricePeaks: 225 } } });
    expect(sw("new_blog_post").getAttribute("aria-checked")).toBe("true");
    expect(sw("weekly_plan").getAttribute("aria-checked")).toBe("false");
    expect(host.querySelector('[data-testid="auto-write-usage"]')!.textContent).toBe("Used this month: 0 of 2,250 Peaks.");
  });

  it("a limit that does not cover one draft cannot be accepted", async () => {
    await mount(status());
    await click(sw("weekly_plan"));
    await type(dialog()!.querySelector<HTMLInputElement>("#auto-write-confirm-limit")!, "100");
    expect(button("Yes, turn on")!.disabled).toBe(true);
    await type(dialog()!.querySelector<HTMLInputElement>("#auto-write-confirm-limit")!, "abc");
    expect(button("Yes, turn on")!.disabled).toBe(true);
    expect(h.put).not.toHaveBeenCalled();
  });

  it("a limit below a draft says why Yes is greyed out, in the dialog and in the limit box", async () => {
    await mount(status({ monthlyCapPeaks: 1000, remainingPeaks: 1000 }, ["weekly_plan"]));
    await type(host.querySelector<HTMLInputElement>("#auto-write-limit")!, "100");
    expect(host.querySelector('[data-testid="auto-write-limit-hint"]')!.textContent).toBe("The limit must cover at least one draft.");
    await click(sw("new_product"));
    await type(dialog()!.querySelector<HTMLInputElement>("#auto-write-confirm-limit")!, "100");
    expect(dialog()!.querySelector('[data-testid="auto-write-confirm-text"]')!.textContent).toBe("The limit must cover at least one draft.");
    expect(button("Yes, turn on")!.disabled).toBe(true);
  });

  it("the limit must cover the jobs that are ON (and the one being asked about), not jobs that are off", async () => {
    const s0 = status({ monthlyCapPeaks: 1000, remainingPeaks: 1000 }, ["weekly_plan"]);
    s0.jobs.find((j) => j.job === "fresh_recurring")!.pricePerDraftPeaks = 900;
    await mount(s0);
    await type(host.querySelector<HTMLInputElement>("#auto-write-limit")!, "500");
    expect(host.querySelector('[data-testid="auto-write-limit-hint"]')).toBeNull();
    expect(button("Save limit")!.disabled).toBe(false);
    await click(sw("fresh_recurring"));
    await type(dialog()!.querySelector<HTMLInputElement>("#auto-write-confirm-limit")!, "500");
    expect(button("Yes, turn on")!.disabled).toBe(true);
  });

  it("flipping a job off leaves a typed, unsaved limit in the box", async () => {
    await mount(status({ monthlyCapPeaks: 1000, remainingPeaks: 1000 }, ["weekly_plan", "new_product"]));
    await type(host.querySelector<HTMLInputElement>("#auto-write-limit")!, "8000");
    await click(sw("new_product"));
    expect(host.querySelector<HTMLInputElement>("#auto-write-limit")!.value).toBe("8000");
  });

  it("a refused limit does not stay typed in as if it were saved", async () => {
    await mount(status({ monthlyCapPeaks: 1000, remainingPeaks: 1000 }, ["weekly_plan"]));
    await type(host.querySelector<HTMLInputElement>("#auto-write-limit")!, "500");
    h.put.mockRejectedValueOnce(new Error("Nope."));
    await click(button("Save limit"));
    expect(host.querySelector<HTMLInputElement>("#auto-write-limit")!.value).toBe("1000");
    expect(host.querySelector('[data-testid="auto-write-error"]')!.textContent).toBe("Nope.");
  });

  it("turning a job OFF asks nothing and leaves the others alone", async () => {
    await mount(status({ monthlyCapPeaks: 1000, remainingPeaks: 1000 }, ["weekly_plan", "new_product"]));
    await click(sw("weekly_plan"));
    expect(dialog()).toBeNull();
    expect(h.put).toHaveBeenCalledWith("/v1/content/auto-write", { jobs: { weekly_plan: { enabled: false } } });
    expect(sw("weekly_plan").getAttribute("aria-checked")).toBe("false");
    expect(sw("new_product").getAttribute("aria-checked")).toBe("true");
  });

  it("the one limit is saved from its box, and a limit below one draft cannot be", async () => {
    await mount(status({ monthlyCapPeaks: 1000, remainingPeaks: 1000, usedPeaks: 450 }, ["weekly_plan"]));
    expect(host.querySelector('[data-testid="auto-write-usage"]')!.textContent).toBe("Used this month: 450 of 1,000 Peaks.");
    await type(host.querySelector<HTMLInputElement>("#auto-write-limit")!, "100");
    expect(button("Save limit")!.disabled).toBe(true);
    await type(host.querySelector<HTMLInputElement>("#auto-write-limit")!, "3000");
    await click(button("Save limit"));
    expect(h.put).toHaveBeenCalledWith("/v1/content/auto-write", { monthlyCapPeaks: 3000 });
  });

  it("a price that rose says that job is paused and offers to accept the new price", async () => {
    const s = status({ monthlyCapPeaks: 1000, remainingPeaks: 1000 }, ["weekly_plan"], 300);
    s.jobs[0]!.needsReaccept = true;
    await mount(s);
    expect(host.querySelector('[data-testid="auto-write-reaccept-weekly_plan"]')!.textContent).toContain("The price has changed, so this is paused");
    expect(host.querySelector('[data-testid="auto-write-reaccept-new_product"]')).toBeNull();
    await click(button("Accept the new price"));
    expect(dialog()!.textContent).toContain("300 Peaks");
  });

  it("a refused save says so in the api's words and the switch stays as the api has it", async () => {
    await mount(status());
    await click(sw("weekly_plan"));
    h.put.mockRejectedValueOnce(new Error("The price is now 300 Peaks per draft. Check it and accept again."));
    await click(button("Yes, turn on"));
    expect(host.querySelector('[data-testid="auto-write-error"]')!.textContent).toBe("The price is now 300 Peaks per draft. Check it and accept again.");
    expect(sw("weekly_plan").getAttribute("aria-checked")).toBe("false");
    expect(sw("weekly_plan").disabled).toBe(false);
  });

  it("an editor sees the setting but cannot change it", async () => {
    h.role = "editor";
    await mount(status({ monthlyCapPeaks: 1000, remainingPeaks: 1000 }, ["weekly_plan"]));
    for (const [job] of JOBS) expect(sw(job).disabled).toBe(true);
    expect(host.textContent).toContain("takes an owner or admin");
    expect(host.querySelector("#auto-write-limit")).toBeNull();
  });

  it("a job with no price from the api says so and cannot be turned on, never showing 0", async () => {
    await mount(status({}, [], null));
    expect(host.textContent).toContain("The price of a draft is not set yet");
    expect(sw("weekly_plan").disabled).toBe(true);
    expect(host.textContent).not.toContain("0 Peaks");
  });

  it("when the settings cannot be loaded it says so and offers to try again", async () => {
    h.get.mockRejectedValue(new Error("boom"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <AutoWriteCard />
        </QueryClientProvider>,
      );
    });
    await settle();
    expect(host.querySelector('[data-testid="auto-write-load-error"]')!.textContent).toContain("Automatic writing settings could not be loaded");
  });
});
