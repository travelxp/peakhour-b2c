// @vitest-environment jsdom
/**
 * MR-G1 (V2): the LinkedIn Ads status line counts only the business's enabled accounts, and with none enabled still offers
 * Refresh status (and the Create Ad Account link when the login lists none).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("./manage-pages-dialog", () => ({ ManagePagesDialog: () => null }));

const { LinkedInAdsStatus } = await import("./linkedin-panels");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const RUN = ["RUNNABLE"];
const mount = (extra: Record<string, unknown>, onRefresh = vi.fn()) => {
  act(() => root.render(<LinkedInAdsStatus extra={extra} onRefresh={onRefresh} refreshing={false} />));
  return onRefresh;
};

describe("LinkedInAdsStatus", () => {
  it("counts only the enabled accounts", () => {
    mount({
      adAccounts: [
        { id: "1", name: "A", status: "ACTIVE", servingStatuses: RUN },
        { id: "2", name: "B", status: "ACTIVE", servingStatuses: RUN },
        { id: "3", name: "C", status: "ACTIVE", servingStatuses: ["BILLING_HOLD"] },
      ],
      adAccountChoice: { enabledIds: ["1"], defaultId: "1" },
    });
    expect(container.textContent).toContain("1 ad account ready");
    expect(container.textContent).not.toContain("issue");
  });

  it("an enabled account with a billing hold is an issue; one that is not enabled is not", () => {
    mount({
      adAccounts: [
        { id: "1", name: "A", status: "ACTIVE", servingStatuses: RUN },
        { id: "3", name: "C", status: "ACTIVE", servingStatuses: ["BILLING_HOLD"] },
      ],
      adAccountChoice: { enabledIds: ["1"], defaultId: "1" },
    });
    expect(container.textContent).not.toContain("issue");
    mount({
      adAccounts: [
        { id: "1", name: "A", status: "ACTIVE", servingStatuses: RUN },
        { id: "3", name: "C", status: "ACTIVE", servingStatuses: ["BILLING_HOLD"] },
      ],
      adAccountChoice: { enabledIds: ["1", "3"], defaultId: "1" },
    });
    expect(container.textContent).toContain("1 issue");
  });

  it("★no enabled account: still the Refresh status button, and no Create link while the login lists accounts", () => {
    const onRefresh = mount({
      adAccounts: [{ id: "1", status: "ACTIVE", servingStatuses: RUN }, { id: "2", status: "ACTIVE", servingStatuses: RUN }],
    });
    const btn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Refresh status"))!;
    expect(btn).toBeDefined();
    act(() => btn.click());
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).not.toContain("No Ad Account found");
  });

  it("★the login lists none: Refresh status and the Create Ad Account link", () => {
    mount({ adAccounts: [] });
    expect(container.textContent).toContain("Refresh status");
    expect(container.querySelector('a[href*="linkedin.com/campaignmanager"]')).not.toBeNull();
  });
});
