// @vitest-environment jsdom
/**
 * First run's shared-network opt-in (PL-6): unticked unless the business already shares, ticking records the consent
 * through the existing route with the server's own version, and not ticking sends nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

const h = vi.hoisted(() => ({
  status: { data: undefined as unknown, isPending: false },
  consent: { isPending: false, isError: false, variables: undefined as boolean | undefined, mutate: vi.fn<(share: boolean) => void>() },
  post: vi.fn<(path: string, body?: unknown) => Promise<unknown>>(),
  get: vi.fn<(path: string) => Promise<unknown>>(),
}));
vi.mock("@/lib/api", () => ({ api: { post: h.post, get: h.get } }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "b1" } }) }));

const pinModule = await import("@/lib/api/pin");
vi.spyOn(pinModule, "usePinStatus").mockImplementation(() => h.status as never);
vi.spyOn(pinModule, "usePinConsent").mockImplementation(() => h.consent as never);
const { ShareResultsOptIn, SHARE_LABEL, SHARE_EXPLAINER } = await import("./share-results-opt-in");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  h.status = { data: { pin: null }, isPending: false };
  h.consent = { isPending: false, isError: false, variables: undefined, mutate: vi.fn<(share: boolean) => void>() };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const box = () => host.querySelector("#first-run-share") as HTMLButtonElement;
const render = async () => act(async () => root.render(<ShareResultsOptIn />));

describe("the share-results box", () => {
  it("is unticked by default, says what it shares and when it shows, and sends nothing until ticked", async () => {
    await render();
    expect(box().getAttribute("aria-checked")).toBe("false");
    expect(host.textContent).toContain(SHARE_LABEL);
    expect(host.textContent).toContain(SHARE_EXPLAINER);
    expect(SHARE_EXPLAINER).toBe("Only shown once at least 20 similar businesses take part. No business is ever named.");
    expect(h.consent.mutate).not.toHaveBeenCalled();
  });

  it("ticking records the consent", async () => {
    await render();
    await act(async () => box().click());
    expect(h.consent.mutate).toHaveBeenCalledWith(true);
  });

  it("a business that already shares sees it ticked, and unticking withdraws", async () => {
    h.status = { data: { pin: { consentStatus: { pin_contribution: "opted_in" } } }, isPending: false };
    await render();
    expect(box().getAttribute("aria-checked")).toBe("true");
    await act(async () => box().click());
    expect(h.consent.mutate).toHaveBeenCalledWith(false);
  });

  it("a withdrawn business is unticked; the box is disabled while the status loads or an answer saves, and a failed save says so", async () => {
    h.status = { data: { pin: { consentStatus: { pin_contribution: "revoked" } } }, isPending: false };
    await render();
    expect(box().getAttribute("aria-checked")).toBe("false");
    h.status = { data: undefined, isPending: true };
    await render();
    expect(box().disabled).toBe(true);
    h.status = { data: { pin: null }, isPending: false };
    h.consent = { isPending: true, isError: false, variables: true, mutate: vi.fn<(share: boolean) => void>() };
    await render();
    expect(box().getAttribute("aria-checked"), "the answer being saved, not the status it replaces").toBe("true");
    h.consent = { isPending: false, isError: true, variables: true, mutate: vi.fn<(share: boolean) => void>() };
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/could not save/);
  });
});

describe("pinApi", () => {
  it("posts to the existing consent routes with no version, so the server records the one the Shopify page records", async () => {
    h.post.mockResolvedValue({ status: "opted_in" });
    await pinModule.pinApi.optIn("first_run");
    await pinModule.pinApi.withdraw("first_run");
    expect(h.post.mock.calls).toEqual([
      ["/v1/pin/consent", { consentType: "pin_contribution", source: "first_run" }],
      ["/v1/pin/consent/withdraw", { consentType: "pin_contribution", source: "first_run" }],
    ]);
  });

  it("isSharing is true only for an opt-in", () => {
    expect(pinModule.isSharing(undefined)).toBe(false);
    expect(pinModule.isSharing({ pin: null })).toBe(false);
    expect(pinModule.isSharing({ pin: { consentStatus: { pin_contribution: "pending" } } })).toBe(false);
    expect(pinModule.isSharing({ pin: { consentStatus: { pin_contribution: "opted_in" } } })).toBe(true);
  });
});
