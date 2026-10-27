// @vitest-environment jsdom
/**
 * A target typed for one outcome is not carried to another: when an answer changes which outcome is offered first, the box
 * shows the new outcome's default again.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { DraftOffer, FirstRunDraftResponse } from "@/lib/api/growth-v2";

const LEADS: DraftOffer = {
  kind: "leads", source: "win_definition", optimizeFor: "count", label: "Leads", focusSuggestions: [],
  defaultTarget: { kind: "cost_per_outcome", value: 350, low: 100, high: 1500, currency: "INR" }, targetSource: "playbook",
};
const VISITS: DraftOffer = {
  kind: "store_visits", source: "ads_conversions", optimizeFor: "count", label: "Store visits", focusSuggestions: [],
  defaultTarget: { kind: "cost_per_outcome", value: 90, low: 20, high: 400, currency: "INR" }, targetSource: "playbook",
};
const draft = (offers: DraftOffer[], over: Partial<FirstRunDraftResponse> = {}): FirstRunDraftResponse => ({
  alreadyActive: false, currency: "INR", timeZone: { value: "Asia/Kolkata" }, offers, askAboutStores: false,
  playbook: { id: "local", version: 1, title: "Local" }, channels: [],
  ceilingBands: { currency: "INR", bands: [{ key: "starter", amount: 30000 }, { key: "steady", amount: 60000 }, { key: "growth", amount: 120000 }] },
  excludedByGuardrails: [], ...over,
});

const h = vi.hoisted(() => ({ asked: [] as unknown[] }));
vi.mock("@/lib/api/growth-v2", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/growth-v2")>()),
  // Saying customers visit in person puts store visits first; before that, leads are.
  useFirstRunDraft: (body: { customersVisitInPerson?: boolean; playbookId?: string }) => {
    h.asked.push(body);
    return { data: body.customersVisitInPerson ? draft([VISITS, LEADS]) : draft([LEADS]), isError: false, isPlaceholderData: false };
  },
  useConfirmPlan: () => ({ isSuccess: false, isError: false, isPending: false, reset: vi.fn(), mutate: vi.fn() }),
  usePatchRules: () => ({ isPending: false, isError: false, mutate: vi.fn() }),
}));
vi.mock("@/lib/api/growth-v2-signal", () => ({ useSignalReadiness: () => ({ data: undefined }) }));
vi.mock("./signal-step", () => ({ SignalStep: () => null }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { FirstRunScreen } = await import("./first-run-screen");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("first run: the typed target", () => {
  it("★is cleared when the in-person answer changes the outcome, so the new default shows", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<FirstRunScreen />));

    const target = () => document.getElementById("first-run-target") as HTMLInputElement;
    expect(target().value).toBe("350");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(target(), "999");
      target().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(target().value).toBe("999");

    const yes = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Yes")!;
    await act(async () => yes.click());
    expect(target().value).toBe("90");
  });

  it("keeps the typed target when the same in-person answer is given again", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<FirstRunScreen />));
    const target = () => document.getElementById("first-run-target") as HTMLInputElement;
    const no = () => [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === "No")!;
    await act(async () => no().click());
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(target(), "77");
      target().dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => no().click());
    expect(target().value).toBe("77");
  });
});
