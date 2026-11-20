// @vitest-environment jsdom
/**
 * MR-G3: the X card's ad-account checklist reads X's list once when none is stored. U2: only the FIRST load unmounts the checklist
 * (a save's refresh is a refetch and must not); U4: a failed background refetch keeps what it has.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ listAccounts: vi.fn(), choice: vi.fn() }));

vi.mock("@/lib/api/x-ads", async (orig) => ({ ...(await orig<typeof import("@/lib/api/x-ads")>()), xAdsApi: { listAccounts: h.listAccounts } }));
vi.mock("@/components/ads/ad-account-choice", () => ({
  AdAccountChoice: (p: { provider: string; extra: { adAccounts?: Array<{ id: string }> } }) => {
    h.choice(p);
    return <div data-testid="checklist">{(p.extra.adAccounts ?? []).map((a) => a.id).join(",")}</div>;
  },
}));

const { XAdAccountChoice } = await import("./x-ad-account-choice");

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  h.listAccounts.mockReset();
  h.choice.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
async function mount(extra: Record<string, unknown>, onChanged = vi.fn()) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <XAdAccountChoice extra={extra} onChanged={onChanged} />
      </QueryClientProvider>,
    );
  });
  await settle();
  return onChanged;
}
const text = () => container.textContent ?? "";

describe("XAdAccountChoice", () => {
  it("with a stored list it reads nothing and shows the checklist", async () => {
    await mount({ adAccounts: [{ id: "a1" }] });
    expect(h.listAccounts).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="checklist"]')!.textContent).toBe("a1");
  });

  it("Q4: with no stored list it passes the LIVE list to the checklist and tells the card once", async () => {
    h.listAccounts.mockResolvedValue({ accounts: [{ id: "a1" }, { id: "a2" }], enabledIds: [] });
    const onChanged = await mount({});
    expect(container.querySelector('[data-testid="checklist"]')!.textContent).toBe("a1,a2");
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(h.listAccounts).toHaveBeenCalledTimes(1);
  });

  it("Q5: says it is loading while reading", async () => {
    h.listAccounts.mockReturnValue(new Promise(() => undefined));
    await mount({});
    expect(text()).toContain("Loading your X ad accounts");
    expect(text()).not.toContain("No ad accounts found");
  });

  it("Q5: a failed read says so with Retry, never 'No ad accounts found'", async () => {
    h.listAccounts.mockRejectedValueOnce(new Error("down"));
    await mount({});
    expect(text()).toContain("Couldn't read your X ad accounts");
    expect(text()).not.toContain("No ad accounts found");
    h.listAccounts.mockResolvedValue({ accounts: [{ id: "a1" }], enabledIds: [] });
    await act(async () => {
      [...container.querySelectorAll("button")].find((b) => b.textContent === "Retry")!.click();
    });
    await settle();
    expect(container.querySelector('[data-testid="checklist"]')).not.toBeNull();
  });

  it("U2: a refetch (a save's refresh) does NOT unmount the checklist", async () => {
    h.listAccounts.mockResolvedValue({ accounts: [{ id: "a1" }], enabledIds: [] });
    await mount({});
    expect(container.querySelector('[data-testid="checklist"]')).not.toBeNull();
    let release!: () => void;
    h.listAccounts.mockReturnValue(new Promise((r) => { release = () => r({ accounts: [{ id: "a1" }], enabledIds: ["a1"] }); }));
    await act(async () => {
      void client.refetchQueries({ queryKey: ["x-ads-accounts"] });
    });
    expect(container.querySelector('[data-testid="checklist"]')).not.toBeNull();
    expect(text()).not.toContain("Loading your X ad accounts");
    await act(async () => release());
  });

  it("U4: a failed background refetch keeps the accounts it already has", async () => {
    h.listAccounts.mockResolvedValue({ accounts: [{ id: "a1" }], enabledIds: [] });
    await mount({});
    h.listAccounts.mockRejectedValue(new Error("blip"));
    await act(async () => {
      await client.refetchQueries({ queryKey: ["x-ads-accounts"] });
    });
    await settle();
    expect(container.querySelector('[data-testid="checklist"]')).not.toBeNull();
    expect(text()).not.toContain("Couldn't read your X ad accounts");
  });
});
