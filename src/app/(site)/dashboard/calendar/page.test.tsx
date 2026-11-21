// @vitest-environment jsdom
/**
 * The calendar page: ?compose=<channel> reaches the sheet, the Planned ideas and Recurring pages are tabs (so nothing is reachable by
 * typing a URL), and an empty calendar offers New post and Connect a channel rather than links that lead elsewhere.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import React, { act, Suspense, useSyncExternalStore } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  items: [] as unknown[],
  sheet: vi.fn(),
  listItems: vi.fn(),
  replace: vi.fn(),
  listeners: new Set<() => void>(),
  version: 0,
}));

// The URL is window.location: useSearchParams reads it, router.replace writes it, and both tell the page.
function notifyUrl() {
  h.version++;
  h.listeners.forEach((l) => l());
}
vi.mock("next/navigation", () => ({
  useSearchParams: () => {
    useSyncExternalStore(
      (cb) => {
        h.listeners.add(cb);
        return () => h.listeners.delete(cb);
      },
      () => h.version,
      () => h.version,
    );
    return new URLSearchParams(window.location.search);
  },
  usePathname: () => "/dashboard/calendar",
  useRouter: () => ({
    replace: (url: string) => {
      h.replace(url);
      window.history.replaceState(null, "", url);
      notifyUrl();
    },
  }),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<React.ComponentType<Record<string, unknown>>>) => {
    const Lazy = React.lazy(async () => ({ default: await loader() }));
    return (props: Record<string, unknown>) => (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/scheduler/client", () => ({
  scheduler: { listItems: h.listItems, rescheduleItem: vi.fn() },
}));
vi.mock("@/components/scheduler", () => ({ CalendarView: () => <div data-view="grid" />, TimezoneBanner: () => null }));
vi.mock("@/components/brand/channel-icon", () => ({ ChannelIconCompact: () => null }));
vi.mock("./_components/calendar-item-drawer", () => ({ CalendarItemDrawer: () => null }));
vi.mock("@/components/compose/compose-new-sheet", () => ({
  ComposeNewSheet: (props: { open: boolean; channel?: string | null }) => {
    h.sheet(props);
    return props.open ? <div data-sheet data-channel={props.channel ?? ""} /> : null;
  },
}));
vi.mock("./_components/ideas-panel", () => ({ IdeasPanel: () => <div data-panel="ideas" /> }));
vi.mock("./_components/recurring-panel", () => ({ RecurringPanel: () => <div data-panel="recurring" /> }));

const { default: CalendarPage } = await import("./page");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

async function mount(search: string) {
  window.history.replaceState(null, "", `/dashboard/calendar${search}`);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <CalendarPage />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}
const sheetEl = () => host.querySelector("[data-sheet]");
const panel = () => host.querySelector("[data-panel]")?.getAttribute("data-panel") ?? null;
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);

beforeEach(() => {
  h.items = [];
  h.listItems.mockReset();
  h.listItems.mockImplementation(async () => ({ items: h.items }));
  h.replace.mockClear();
  h.sheet.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("calendar ?compose=", () => {
  it("?compose=threads opens the sheet on Threads and strips the param", async () => {
    await mount("?compose=threads");
    expect(sheetEl()?.getAttribute("data-channel")).toBe("threads");
    expect(window.location.search).toBe("");
  });
  it("?compose=1 opens the sheet to pick a channel", async () => {
    await mount("?compose=1");
    expect(sheetEl()?.getAttribute("data-channel")).toBe("");
  });
  it("an unknown channel opens nothing", async () => {
    await mount("?compose=tiktok");
    expect(sheetEl()).toBeNull();
  });
  it("the header's New post asks for a channel", async () => {
    await mount("");
    expect(sheetEl()).toBeNull();
    await act(async () => button("New post")!.click());
    expect(sheetEl()?.getAttribute("data-channel")).toBe("");
  });
});

describe("calendar tabs", () => {
  it("a ?tab= deep link shows its tab from the first render: the scheduled-items query is never fired", async () => {
    await mount("?tab=recurring");
    expect(panel()).toBe("recurring");
    expect(h.listItems).not.toHaveBeenCalled();
  });
  it("the calendar tab fetches, and its trigger controls a real tabpanel", async () => {
    await mount("");
    expect(h.listItems).toHaveBeenCalled();
    const trigger = [...host.querySelectorAll('[role="tab"]')].find((x) => x.textContent === "Calendar")!;
    const panelEl = [...host.querySelectorAll('[role="tabpanel"]')].find((e) => e.getAttribute("data-state") === "active")!;
    expect(trigger.getAttribute("aria-controls")).toBe(panelEl.id);
  });
  it("a link to the same route with another ?tab= changes the tab", async () => {
    await mount("");
    expect(panel()).toBeNull();
    await act(async () => {
      window.history.replaceState(null, "", "/dashboard/calendar?tab=ideas");
      notifyUrl();
    });
    expect(panel()).toBe("ideas");
  });
  it("opens on the calendar", async () => {
    await mount("");
    expect(panel()).toBeNull();
    expect(host.textContent).toContain("Planned ideas");
    expect(host.textContent).toContain("Recurring");
  });
  it.each(["ideas", "recurring"])("?tab=%s opens that tab", async (t) => {
    await mount(`?tab=${t}`);
    expect(panel()).toBe(t);
    expect(host.textContent).not.toContain("Nothing scheduled yet");
  });
  it("pressing a tab writes it to the URL with router.replace and switches to it; Calendar clears it", async () => {
    await mount("");
    const press = async (name: string) => {
      const tab = [...host.querySelectorAll('[role="tab"]')].find((x) => x.textContent === name)!;
      await act(async () => {
        tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
    };
    await press("Recurring");
    expect(h.replace).toHaveBeenLastCalledWith("/dashboard/calendar?tab=recurring");
    expect(panel()).toBe("recurring");
    await press("Calendar");
    expect(h.replace).toHaveBeenLastCalledWith("/dashboard/calendar");
    expect(panel()).toBeNull();
  });
});

describe("empty calendar", () => {
  it("offers New post and Connect a channel, and no stale links", async () => {
    await mount("");
    expect(host.textContent).toContain("Nothing scheduled yet");
    const links = [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toContain("/dashboard/integrations");
    expect(links).not.toContain("/dashboard/content");
    expect(host.textContent).not.toContain("Content composer");
    expect(host.textContent).not.toContain("Beehiiv");
    const buttons = [...host.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "New post");
    expect(buttons.length).toBe(2);
  });
});
