// @vitest-environment jsdom
/**
 * MR-F3: what a Meta campaign launch's approval card says about its ad account. "Runs in Name (act_…1234) · why", the
 * currency warning (a warning line, never a block), and, when several of the business's accounts fit, a REQUIRED account pick
 * that limits the choice to the candidates and travels with the approve.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { DecisionView } from "@/lib/api/growth-v2";

// Radix Select does not open in jsdom; a native select keeps the assertion on what the card sends.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children, disabled }: { value: string; onValueChange: (v: string) => void; children: unknown; disabled?: boolean }) => (
    <select aria-label="Ad account for this campaign" value={value} disabled={disabled} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">Choose an ad account</option>
      {children as never}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: unknown }) => <>{children as never}</>,
  SelectItem: ({ value, children }: { value: string; children: unknown }) => <option value={value}>{children as never}</option>,
}));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { DecisionCard } = await import("./decision-card");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.now();
const launch = (adAccount: DecisionView["adAccount"], id = "d-1"): DecisionView => ({
  id,
  kind: "campaign_launch",
  source: { engine: "optimizer" },
  title: "Start a campaign",
  summary: "It starts paused.",
  ops: [{ platform: "meta", campaignRef: "ph-1", op: "create_campaign", to: { name: "n" }, description: "Start Spring (Meta Ads) at INR 300 a day" }],
  ...(adAccount ? { adAccount } : {}),
  needsPerson: true,
  status: "proposed",
  expiresAt: new Date(NOW + 48 * 3_600_000).toISOString(),
  delivery: {},
  createdAt: new Date(NOW - 3_600_000).toISOString(),
});

let root: Root;
let host: HTMLElement;
const onAction = vi.fn();

function render(d: DecisionView) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root.render(<DecisionCard decision={d} currency="INR" unit={{ one: "booking", many: "bookings" }} now={NOW} onAction={onAction} />);
  });
}
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  onAction.mockReset();
});

const button = (label: string) => [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined;
const click = async (label: string) => {
  const b = button(label);
  expect(b, `a button "${label}"`).toBeDefined();
  await act(async () => {
    b!.click();
  });
};
const section = () => document.body.querySelector('[aria-label="Ad account"]')?.textContent ?? "";

describe("the ad account on a launch card", () => {
  it("says which account the campaign runs in and why", () => {
    render(launch({ required: false, accountId: "act_111", label: "India Store (act_…111)", reason: "Matches market India" }));
    expect(section()).toContain("Runs in India Store (act_…111) · Matches market India");
  });

  it("says it is the default when nothing else matched", () => {
    render(launch({ required: false, accountId: "act_111", label: "India Store (act_…111)", reason: "Your default ad account" }));
    expect(section()).toContain("Runs in India Store (act_…111) · Your default ad account");
  });

  it("shows the currency note as a neutral line and does not block Approve", async () => {
    render(launch({ required: false, accountId: "act_222", label: "UK Store (act_…222)", currencyNote: "Billed in USD; your plan's budget is in INR" }));
    expect(section()).toContain("Billed in USD; your plan's budget is in INR");
    expect(button("Approve")!.disabled).toBe(false);
  });

  it("a launch with no ad account block shows no section", () => {
    render(launch(undefined));
    expect(document.body.querySelector('[aria-label="Ad account"]')).toBeNull();
  });

  it("★when several accounts fit, Approve is off until one is picked, the choice is only the candidates, and the pick travels with the approve", async () => {
    render(
      launch({
        required: true,
        reason: "More than one of your ad accounts fits this campaign",
        options: [
          { id: "act_111", label: "India Store (act_…111)", currency: "INR" },
          { id: "act_222", label: "India Brand (act_…222)", currency: "INR" },
        ],
      }),
    );
    expect(button("Approve")!.disabled).toBe(true);
    const select = document.body.querySelector("select") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["", "act_111", "act_222"]);
    await act(async () => {
      select.value = "act_222";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(button("Approve")!.disabled).toBe(false);
    await click("Approve");
    await click("Confirm and approve");
    expect(onAction).toHaveBeenCalledWith("approve", "act_222");
  });

  it("★a pick that is no longer among the current options counts as no pick (Approve off again)", async () => {
    const opts = (ids: string[]) => ids.map((id) => ({ id, label: id }));
    render(launch({ required: true, options: opts(["act_111", "act_222"]) }));
    const select = document.body.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      select.value = "act_222";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(button("Approve")!.disabled).toBe(false);
    act(() => {
      root.render(<DecisionCard decision={launch({ required: true, options: opts(["act_111", "act_333"]) })} currency="INR" unit={{ one: "booking", many: "bookings" }} now={NOW} onAction={onAction} />);
    });
    expect(button("Approve")!.disabled).toBe(true);
  });

  it("★the required pick block shows only on a decision that can still be answered", () => {
    render({ ...launch({ required: true, options: [{ id: "act_111", label: "India Store" }] }), status: "expired" });
    expect(document.body.querySelector('[aria-label="Ad account"]')).toBeNull();
    expect(document.body.querySelector("select")).toBeNull();
  });

  it("★the confirm dialog names the account the campaign runs in, picked or already chosen", async () => {
    render(launch({ required: false, accountId: "act_111", label: "India Store (act_…111)" }));
    await click("Approve");
    expect(document.body.textContent).toContain("Runs in India Store (act_…111)");
    act(() => root.unmount());
    host.remove();
    render(launch({ required: true, options: [{ id: "act_222", label: "UK Store (act_…222)" }] }));
    const select = document.body.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      select.value = "act_222";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("Approve");
    expect(document.body.textContent).toContain("Runs in UK Store (act_…222)");
  });

  it("a launch with an account already chosen approves with no pick", async () => {
    render(launch({ required: false, accountId: "act_111", label: "India Store (act_…111)" }));
    await click("Approve");
    await click("Confirm and approve");
    expect(onAction).toHaveBeenCalledWith("approve", undefined);
  });
});
