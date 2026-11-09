// @vitest-environment jsdom
/**
 * The quiet-hours form follows what is stored: after a save, a refetch or a change from another tab, the two time boxes
 * show the saved times, not what the merchant had typed before.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FIXTURE_RULES } from "@/lib/growth-v2-fixtures";
import type { RulesResponse } from "@/lib/api/growth-v2";

vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "biz-1", name: "Acme Tea" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/growth/rules", useRouter: () => ({ push: vi.fn() }) }));

const { RulesBody } = await import("./rules-screen");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const withQuiet = (quietHours: RulesResponse["guardrails"]["quietHours"]): RulesResponse => ({ ...FIXTURE_RULES, guardrails: { ...FIXTURE_RULES.guardrails, quietHours } });
async function render(rules: RulesResponse) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <RulesBody rules={rules} preview={false} />
      </QueryClientProvider>,
    );
  });
}
const box = (label: string) => document.body.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
async function type(el: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("quiet hours form", () => {
  it("★re-syncs to the stored times when they change, and keeps what is being typed while they do not", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);

    await render(withQuiet({ start: "22:00", end: "08:00" }));
    expect(box("Quiet hours start").value).toBe("22:00");

    await type(box("Quiet hours start"), "21:30");
    await render(withQuiet({ start: "22:00", end: "08:00" })); // an unrelated refetch: the draft survives
    expect(box("Quiet hours start").value).toBe("21:30");

    await render(withQuiet({ start: "23:00", end: "06:00" })); // the save landed, or another tab changed it
    expect(box("Quiet hours start").value).toBe("23:00");
    expect(box("Quiet hours end").value).toBe("06:00");
  });
});
