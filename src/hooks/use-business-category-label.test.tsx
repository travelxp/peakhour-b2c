// @vitest-environment jsdom
/**
 * FR2: Settings' Category row reads the label from the shared `/v1/dashboard/org` query, so an edit made elsewhere (the "Your business" card
 * invalidates that query) shows while the Settings page stays mounted. WHAT A PAGE'S OWN ONCE-LOADED COPY GETS WRONG: it keeps the old label.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ get: vi.fn(), category: "other" }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ org: { _id: "org-1" }, orgs: [{ _id: "org-1", role: "owner" }], business: { _id: "biz-1" }, isAuthenticated: true }) }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api: { get: h.get } }));

const { useBusinessCategoryLabel, DASHBOARD_ORG_KEY } = await import("./use-dashboard-org");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS = [
  { value: "hospitality_travel", label: "Hospitality & Travel" },
  { value: "other", label: "Other" },
];

function Row() {
  return <p data-testid="row">{useBusinessCategoryLabel() ?? "none"}</p>;
}

let root: Root;
let host: HTMLElement;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function mount(qc: QueryClient) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={qc}>
        <Row />
      </QueryClientProvider>,
    ),
  );
  await settle();
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });
const text = () => host.querySelector("[data-testid=row]")!.textContent;

describe("the Settings category label", () => {
  it("reads the category in words from the shared org query", async () => {
    h.category = "other";
    h.get.mockImplementation(async () => ({ businessCategory: h.category, businessCategoryOptions: OPTIONS }));
    await mount(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    expect(text()).toBe("Other");
  });

  it("★★follows an edit made elsewhere while the page stays mounted: the card's invalidation brings the new label", async () => {
    h.category = "other";
    h.get.mockImplementation(async () => ({ businessCategory: h.category, businessCategoryOptions: OPTIONS }));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await mount(qc);
    expect(text()).toBe("Other");
    // "Your business" saves a new category and invalidates the shared key, as business-category-card does
    h.category = "hospitality_travel";
    await act(async () => {
      await qc.invalidateQueries({ queryKey: [DASHBOARD_ORG_KEY] });
    });
    await settle();
    expect(text()).toBe("Hospitality & Travel");
  });

  it("a category outside the options reads as itself, with its underscores taken out", async () => {
    h.get.mockImplementation(async () => ({ businessCategory: "pet_grooming", businessCategoryOptions: OPTIONS }));
    await mount(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    expect(text()).toBe("pet grooming");
  });
});

describe("the Settings page", () => {
  it("draws the Category row from that hook, not from its own once-loaded copy of the org", () => {
    const src = readFileSync("src/app/(site)/dashboard/settings/page.tsx", "utf8");
    expect(src).toContain("useBusinessCategoryLabel()");
    expect(src).not.toMatch(/categoryLabel\(/);
    expect(src).not.toMatch(/orgDetails\??\.businessCategory/);
  });
});
