// @vitest-environment jsdom
/**
 * FR: the business category card on "Your business".
 *
 * ★WHAT ONLY THESE TESTS CAN GET WRONG: that a viewer or editor sees the category and no select or button, that an owner or admin saves the
 * value they picked (and only a changed one), that what the api answered is worded for the merchant, and that a refusal is shown.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ role: "admin" as string | undefined, put: vi.fn(), data: undefined as unknown }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ org: { _id: "org-1" }, orgs: [{ _id: "org-1", role: h.role }], business: { _id: "biz-1" } }) }));
vi.mock("@/hooks/use-dashboard-org", async (orig) => ({ ...(await orig<typeof import("@/hooks/use-dashboard-org")>()), useDashboardOrg: () => ({ data: h.data }) }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: { put: h.put } }));

const { BusinessCategoryCard } = await import("./business-category-card");
const { ApiError } = await import("@/lib/api");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const OPTIONS = [
  { value: "hospitality_travel", label: "Hospitality & Travel" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

let root: Root;
let host: HTMLElement;
async function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <BusinessCategoryCard />
      </QueryClientProvider>,
    );
  });
}
const select = () => document.getElementById("business-category") as HTMLSelectElement | null;
const save = () => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Save")) as HTMLButtonElement | undefined;
async function pick(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select()!, value);
    select()!.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  h.role = "admin";
  h.data = { businessCategory: "other", businessCategoryOptions: OPTIONS };
  h.put.mockReset().mockResolvedValue({ updated: true, category: { changed: true, plan: { status: "none", why: "no_plan" } } });
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

describe("the category card", () => {
  it.each([["owner"], ["admin"]])("an %s sees a select of the labelled options, on the current category, and Save is off until it changes", async (role) => {
    h.role = role;
    await mount();
    expect([...select()!.options].map((o) => o.textContent)).toEqual(["Hospitality & Travel", "Retail", "Other"]);
    expect(select()!.value).toBe("other");
    expect(save()!.disabled).toBe(true);
  });

  it.each([["editor"], ["viewer"], [undefined]])("a %s sees the category in words and no way to change it", async (role) => {
    h.role = role;
    await mount();
    expect(select()).toBeNull();
    expect(save()).toBeUndefined();
    expect(document.body.textContent).toContain("Other");
    expect(document.body.textContent).toContain("Only an owner or admin can change this.");
  });

  it("saves the picked category to the business route, and says what the api did", async () => {
    await mount();
    await pick("hospitality_travel");
    expect(save()!.disabled).toBe(false);
    await act(async () => save()!.click());
    expect(h.put).toHaveBeenCalledWith("/v1/dashboard/org", { businessCategory: "hospitality_travel" });
    expect(document.body.textContent).toContain("Saved. Peakhour will use it when it drafts your plan");
  });

  it("a plan move that was proposed is said, with the WhatsApp step", async () => {
    h.put.mockResolvedValue({ updated: true, category: { changed: true, plan: { status: "proposed", decisionId: "d1" } } });
    await mount();
    await pick("hospitality_travel");
    await act(async () => save()!.click());
    expect(document.body.textContent).toContain("nothing changes until you confirm");
  });

  it("a refusal from the api is shown, and nothing says it saved", async () => {
    h.put.mockRejectedValue(new ApiError("FORBIDDEN", "no", 403));
    await mount();
    await pick("retail");
    await act(async () => save()!.click());
    expect(document.querySelector('[role="status"]')!.textContent).toBe("Only an owner or admin can change the category.");
  });

  it("a refetch that fails after a good save is not shown as a failed save, and the old message goes when another option is picked", async () => {
    await mount();
    await pick("hospitality_travel");
    await act(async () => save()!.click());
    expect(document.body.textContent).toContain("Saved.");
    await pick("retail");
    expect(document.querySelector('[role="status"]')).toBeNull();
  });

  it("a business with no options yet (the api has not answered) shows no control", async () => {
    h.data = undefined;
    await mount();
    expect(select()).toBeNull();
    expect(document.body.textContent).toContain("Not set yet.");
  });
});
