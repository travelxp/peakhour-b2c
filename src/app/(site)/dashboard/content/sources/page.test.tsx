// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ source: "s2" as string | null, rows: [] as unknown[] }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (k: string) => (k === "source" ? h.source : null) }),
}));
vi.mock("./api", () => ({
  listSources: async () => ({ rows: h.rows, total: h.rows.length }),
  getCitations: async () => ({ count: 0, windowDays: 30, since: "", asOf: "" }),
}));
vi.mock("@/components/upgrade/feature-gate", () => ({
  FeatureGate: ({ children }: { children: unknown }) => <>{children as never}</>,
}));
vi.mock("@/components/upgrade/upgrade-button", () => ({ UpgradeButton: () => null }));
vi.mock("./components/add-source-drawer", () => ({ AddSourceDrawer: () => null }));
vi.mock("./components/insights-panel", () => ({ InsightsPanel: () => null }));
vi.mock("@/components/dashboard/page-intro", () => ({ PageIntro: () => null }));
vi.mock("@/components/dashboard/tab-panel-stubs", () => ({ TabPanelStubs: () => null }));
vi.mock("./components/source-row", () => ({
  SourceRow: ({ source, highlighted }: { source: { _id: string }; highlighted?: boolean }) => (
    <div id={`source-${source._id}`} data-highlighted={highlighted ? "true" : undefined} />
  ),
}));

const Page = (await import("./page")).default;

let root: Root;
let container: HTMLDivElement;
const scroll = vi.fn();

const row = (id: string, status: string) => ({
  _id: id,
  type: "website",
  identifier: id,
  displayName: id,
  status,
  trustScore: 0.5,
  fetchFrequency: "daily",
});

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollIntoView = scroll;
  scroll.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <Page />
      </QueryClientProvider>,
    );
  });
  await act(async () => {});
}

describe("?source= deep link", () => {
  it("opens the source's tab, highlights and scrolls to it", async () => {
    h.rows = [row("s1", "active"), row("s2", "inactive")];
    await mount();
    expect(container.querySelector("#source-s2")?.getAttribute("data-highlighted")).toBe("true");
    expect(container.querySelector("#source-s1")).toBeNull();
    expect(scroll).toHaveBeenCalled();
  });

  it("no param highlights nothing", async () => {
    h.source = null;
    h.rows = [row("s1", "active")];
    await mount();
    expect(container.querySelector("[data-highlighted]")).toBeNull();
    expect(scroll).not.toHaveBeenCalled();
    h.source = "s2";
  });
});
